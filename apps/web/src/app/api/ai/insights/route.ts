import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "@baby-atlas/db";
import { auth } from "@/lib/auth";
import { checkUserSubscription } from "@/lib/subscription";
import { buildInsightsContext } from "@/lib/insights/build-context";
import { loadInsightsData } from "@/lib/insights/load-data";
import { buildSystemPrompt } from "@/lib/insights/system-prompt";
import { getRequestLocale } from "@/lib/insights/request-locale";

export const runtime = "nodejs";
export const maxDuration = 60;

const INSIGHTS_MODEL = "claude-sonnet-5-5";

const bodySchema = z.object({
  childId: z.string().min(1),
  question: z.string().trim().max(500).optional(),
});

const DEFAULT_QUESTIONS = {
  nb: "Gi meg en kort oppsummering av de siste 14 dagene og noen konkrete tips.",
  en: "Give me a short summary of the last 14 days and a few concrete tips.",
} as const;

function json(body: unknown, status: number) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return json({ error: "unauthorized" }, 401);
  }
  const userId = session.user.id;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return json({ error: "invalid_body" }, 400);
  }
  const { childId, question } = parsed.data;

  const child = await prisma.child.findUnique({
    where: { id: childId },
    include: { household: { include: { members: { where: { userId } } } } },
  });
  if (!child || child.household.members.length === 0) {
    return json({ error: "forbidden" }, 403);
  }

  const { isPremium } = await checkUserSubscription(userId);
  if (!isPremium) {
    return json({ error: "premium_required" }, 402);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: "ai_not_configured" }, 503);
  }

  const locale = await getRequestLocale();
  const now = new Date();
  const data = await loadInsightsData(prisma, child, now);
  const context = buildInsightsContext(data);

  const userMessage = `Data for ${child.name}:\n\n${context}\n\nQuestion: ${
    question || DEFAULT_QUESTIONS[locale]
  }`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

      try {
        const messageStream = anthropic.messages.stream(
          {
            model: INSIGHTS_MODEL,
            max_tokens: 8000,
            system: buildSystemPrompt(locale),
            messages: [{ role: "user", content: userMessage }],
          },
          { signal: request.signal }
        );

        for await (const event of messageStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            send({ type: "text_delta", text: event.delta.text });
          }
        }

        const final = await messageStream.finalMessage();
        if ((final.stop_reason as string) === "refusal") {
          send({ type: "error", error: "refused" });
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (error) {
        console.error("Insights stream error:", error);
        send({ type: "error", error: "ai_failed" });
      } finally {
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
}
