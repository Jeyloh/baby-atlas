import type { TextMessagePart, ToolCallMessagePart } from "@assistant-ui/react";

export type ChatStreamEvent =
  | { type: "message_start"; id: string }
  | { type: "text_delta"; text: string }
  | { type: "tool_use_start"; id: string; name: string }
  | { type: "tool_executing"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; id: string; name: string; result: string }
  | { type: "tool_error"; id: string; name: string; error: string }
  | { type: "error"; error: string };

export type AssistantPart = TextMessagePart | ToolCallMessagePart;

export async function* parseSseStream(
  body: ReadableStream<Uint8Array>
): AsyncGenerator<ChatStreamEvent, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const parseLine = (line: string): ChatStreamEvent | null => {
    if (!line.startsWith("data: ")) return null;
    const data = line.slice(6).trim();
    if (!data || data === "[DONE]") return null;
    try {
      return JSON.parse(data) as ChatStreamEvent;
    } catch {
      return null;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const event = parseLine(line);
        if (event) yield event;
      }
    }
    const last = parseLine(buffer + decoder.decode());
    if (last) yield last;
  } finally {
    reader.releaseLock();
  }
}

export function applyStreamEvent(
  parts: readonly AssistantPart[],
  event: ChatStreamEvent
): readonly AssistantPart[] {
  switch (event.type) {
    case "text_delta": {
      const last = parts[parts.length - 1];
      if (last?.type === "text") {
        return [...parts.slice(0, -1), { ...last, text: last.text + event.text }];
      }
      return [...parts, { type: "text", text: event.text }];
    }
    case "tool_use_start":
      return [
        ...parts,
        {
          type: "tool-call",
          toolCallId: event.id,
          toolName: event.name,
          args: {},
          argsText: "",
        },
      ];
    case "tool_executing":
      return updateToolCall(parts, event.id, {
        args: event.input as ToolCallMessagePart["args"],
        argsText: JSON.stringify(event.input),
      });
    case "tool_result":
      return updateToolCall(parts, event.id, {
        result: event.result,
        isError: false,
      });
    case "tool_error":
      return updateToolCall(parts, event.id, {
        result: event.error,
        isError: true,
      });
    default:
      return parts;
  }
}

function updateToolCall(
  parts: readonly AssistantPart[],
  toolCallId: string,
  patch: Partial<ToolCallMessagePart>
): readonly AssistantPart[] {
  return parts.map((part) =>
    part.type === "tool-call" && part.toolCallId === toolCallId
      ? { ...part, ...patch }
      : part
  );
}
