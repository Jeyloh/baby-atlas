import { auth } from "@/lib/auth";
import { prisma } from "@baby-atlas/db";
import Anthropic from "@anthropic-ai/sdk";
import { registerTools, handleToolCall } from "@baby-atlas/mcp-server/tools";
import { scopeToolCall, isReadOnlyTool, UNSCOPED_TOOLS } from "@/lib/agent/scope-tool-call";
import { checkUserSubscription } from "@/lib/subscription";
import { buildSystemPrompt } from "@/lib/insights/system-prompt";
import { getRequestLocale } from "@/lib/insights/request-locale";
import { toAnthropicMessages } from "@/lib/chat/anthropic-messages";
import { trimConversation } from "@/lib/chat/conversation";
import type { ModelId } from "@/lib/chat/limits";
import { chatRequestSchema } from "@/lib/chat/schema";
import type { ChatStreamEvent } from "@/lib/chat/stream-events";

export const runtime = "nodejs";
// Configure based on your Vercel plan: Hobby=10, Pro=60, Enterprise=900
export const maxDuration = 60;

const MODEL_MAP: Record<ModelId, string> = {
  haiku: "claude-haiku-5-5",
  sonnet: "claude-sonnet-5-5",
  opus: "claude-opus-5-5",
};

function jsonError(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Convert MCP tool definitions to Anthropic tool format
function convertToolsToAnthropicFormat(readOnly: boolean): Anthropic.Tool[] {
  const mcpTools = registerTools().filter(
    (tool) => !UNSCOPED_TOOLS.has(tool.name) && (!readOnly || isReadOnlyTool(tool.name))
  );
  return mcpTools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? "",
    input_schema: tool.inputSchema as Anthropic.Tool["input_schema"],
  }));
}

// Generate system prompt for the chat
function generateSystemPrompt(
  childId: string,
  childName: string,
  childBirthDate: Date | null
): string {
  const age = childBirthDate ? formatAge(childBirthDate) : "unknown age";

  return `You are Baby Atlas, a helpful assistant for tracking baby activities.
You are helping track activities for ${childName}, who is ${age}.

IMPORTANT: The current child's ID is: ${childId}
Always use this childId when calling tools. Do NOT call list-children to look up the ID.

Available tools allow you to:
- Log and query sleep (start-sleep, end-sleep, log-sleep, get-sleep-summary)
- Log and query feedings (log-breastfeeding, log-bottle, log-solids, get-feeding-summary)
- Log and query diapers (log-diaper, get-diaper-summary)
- Log and query pumping (start-pumping, end-pumping, log-pumping, get-pumping-summary)
- Manage medicines (create-medicine, list-medicines, log-medicine, get-medicine-records)
- Log growth measurements (log-growth, get-growth-records, get-latest-growth)
- Log temperature (log-temperature, get-temperature-records, get-latest-temperature)
- Log activities like tummy time, bath, play (start-activity, end-activity, log-activity, get-activity-summary)
- Get daily summaries (get-daily-summary)

When logging activities:
- For times, assume "now" if not specified
- For durations, help the user estimate if they say things like "for about 30 minutes"
- Be concise but friendly in responses
- Confirm what was logged after each action

Current time: ${new Date().toISOString()}`;
}

function formatAge(birthDate: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - birthDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 7) {
    return `${diffDays} day${diffDays !== 1 ? "s" : ""} old`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks !== 1 ? "s" : ""} old`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} month${months !== 1 ? "s" : ""} old`;
  } else {
    const years = Math.floor(diffDays / 365);
    const months = Math.floor((diffDays % 365) / 30);
    if (months > 0) {
      return `${years} year${years !== 1 ? "s" : ""} and ${months} month${months !== 1 ? "s" : ""} old`;
    }
    return `${years} year${years !== 1 ? "s" : ""} old`;
  }
}

export async function POST(request: Request) {
  try {
    // Validate session
    const session = await auth();
    if (!session?.user?.id) {
      return jsonError(401, "Unauthorized");
    }

    const rawBody = await request.json().catch(() => null);
    const parsed = chatRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue?.path.join(".");
      return jsonError(
        400,
        `Invalid chat request${issue ? `: ${path ? `${path}: ` : ""}${issue.message}` : ""}`
      );
    }
    const { childId, model } = parsed.data;

    // Verify user has access to this child via household membership
    const child = await prisma.child.findUnique({
      where: { id: childId },
      include: {
        household: {
          include: {
            members: {
              where: { userId: session.user.id },
            },
          },
        },
      },
    });

    if (!child || child.household.members.length === 0) {
      return new Response(
        JSON.stringify({ error: "Access denied to this child" }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { isPremium } = await checkUserSubscription(session.user.id);
    if (!isPremium) {
      return new Response(JSON.stringify({ error: "premium_required" }), {
        status: 402,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Check for API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Chat feature not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const systemPrompt = buildSystemPrompt(
      await getRequestLocale(),
      generateSystemPrompt(childId, child.name, child.birthDate)
    );
    // Same rule as the tRPC procedures: viewers can read but not log
    const readOnly = child.household.members[0]?.role === "VIEWER";
    const tools = convertToolsToAnthropicFormat(readOnly);

    // Build messages array
    const messages = toAnthropicMessages(trimConversation(parsed.data.messages));

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: ChatStreamEvent) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        try {
          let currentMessages = [...messages];
          let continueLoop = true;

          while (continueLoop) {
            // Create a streaming message
            const streamResponse = anthropic.messages.stream(
              {
                model: MODEL_MAP[model],
                max_tokens: 4096,
                system: systemPrompt,
                tools,
                messages: currentMessages,
              },
              { signal: request.signal }
            );

            for await (const event of streamResponse) {
              if (event.type === "content_block_delta") {
                if (event.delta.type === "text_delta") {
                  send({ type: "text_delta", text: event.delta.text });
                }
              } else if (event.type === "message_start") {
                send({ type: "message_start", id: event.message.id });
              } else if (
                event.type === "content_block_start" &&
                event.content_block.type === "tool_use"
              ) {
                send({
                  type: "tool_use_start",
                  id: event.content_block.id,
                  name: event.content_block.name,
                });
              }
            }

            const fullResponse = await streamResponse.finalMessage();

            // Check if we need to handle tool use
            const toolUseBlocks = fullResponse.content.filter(
              (block): block is Anthropic.ToolUseBlock =>
                block.type === "tool_use"
            );

            if (toolUseBlocks.length > 0 && fullResponse.stop_reason === "tool_use") {
              // Process tool calls
              const toolResults: Anthropic.ToolResultBlockParam[] = [];

              for (const toolUse of toolUseBlocks) {
                const toolInput = toolUse.input as Record<string, unknown>;

                if (request.signal.aborted) {
                  controller.close();
                  return;
                }

                send({
                  type: "tool_executing",
                  id: toolUse.id,
                  name: toolUse.name,
                  input: toolInput,
                });

                try {
                  // Execute the tool, scoped to the verified child
                  const result = await handleToolCall(
                    toolUse.name,
                    await scopeToolCall(prisma, toolUse.name, toolInput, childId, { readOnly }),
                    prisma
                  );

                  const resultText = result.content[0]?.text ?? "No result";

                  send({
                    type: "tool_result",
                    id: toolUse.id,
                    name: toolUse.name,
                    result: resultText,
                  });

                  toolResults.push({
                    type: "tool_result",
                    tool_use_id: toolUse.id,
                    content: resultText,
                  });
                } catch (error) {
                  const errorMessage =
                    error instanceof Error ? error.message : "Tool execution failed";

                  send({
                    type: "tool_error",
                    id: toolUse.id,
                    name: toolUse.name,
                    error: errorMessage,
                  });

                  toolResults.push({
                    type: "tool_result",
                    tool_use_id: toolUse.id,
                    content: `Error: ${errorMessage}`,
                    is_error: true,
                  });
                }
              }

              // Add assistant message and tool results to continue the conversation
              currentMessages = [
                ...currentMessages,
                { role: "assistant" as const, content: fullResponse.content },
                { role: "user" as const, content: toolResults },
              ];
            } else {
              // No more tool use, we're done
              continueLoop = false;
            }
          }

          // Signal end of stream
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          if (request.signal.aborted) {
            try {
              controller.close();
            } catch {
              // already closed by the disconnect
            }
            return;
          }
          console.error("Chat stream error:", error);
          send({
            type: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
