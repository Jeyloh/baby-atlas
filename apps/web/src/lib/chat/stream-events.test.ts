import { describe, it, expect } from "vitest";
import {
  applyStreamEvent,
  parseSseStream,
  type AssistantPart,
  type ChatStreamEvent,
} from "./stream-events";

function streamOf(chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(chunks: string[]) {
  const events: ChatStreamEvent[] = [];
  for await (const event of parseSseStream(streamOf(chunks))) events.push(event);
  return events;
}

const sse = (event: object) => `data: ${JSON.stringify(event)}\n\n`;

describe("parseSseStream", () => {
  it("parses events and ignores [DONE]", async () => {
    const events = await collect([
      sse({ type: "text_delta", text: "Hei" }),
      "data: [DONE]\n\n",
    ]);
    expect(events).toEqual([{ type: "text_delta", text: "Hei" }]);
  });

  it("handles events split across chunks", async () => {
    const line = sse({ type: "text_delta", text: "Hei" });
    const events = await collect([line.slice(0, 10), line.slice(10)]);
    expect(events).toEqual([{ type: "text_delta", text: "Hei" }]);
  });

  it("skips invalid JSON", async () => {
    const events = await collect(["data: {oops\n\n", sse({ type: "text_delta", text: "ok" })]);
    expect(events).toEqual([{ type: "text_delta", text: "ok" }]);
  });

  it("reads a final event without a trailing newline", async () => {
    const events = await collect([`data: ${JSON.stringify({ type: "error", error: "x" })}`]);
    expect(events).toEqual([{ type: "error", error: "x" }]);
  });
});

function reduce(events: ChatStreamEvent[]) {
  return events.reduce<readonly AssistantPart[]>(applyStreamEvent, []);
}

describe("applyStreamEvent", () => {
  it("appends text deltas to the last text part", () => {
    const parts = reduce([
      { type: "text_delta", text: "Hello " },
      { type: "text_delta", text: "World" },
    ]);
    expect(parts).toEqual([{ type: "text", text: "Hello World" }]);
  });

  it("adds a tool call and completes it", () => {
    const parts = reduce([
      { type: "tool_use_start", id: "t1", name: "log-diaper" },
      { type: "tool_executing", id: "t1", name: "log-diaper", input: { diaperType: "WET" } },
      { type: "tool_result", id: "t1", name: "log-diaper", result: "ok" },
    ]);
    expect(parts).toEqual([
      {
        type: "tool-call",
        toolCallId: "t1",
        toolName: "log-diaper",
        args: { diaperType: "WET" },
        argsText: '{"diaperType":"WET"}',
        result: "ok",
        isError: false,
      },
    ]);
  });

  it("marks a failed tool call as an error", () => {
    const parts = reduce([
      { type: "tool_use_start", id: "t1", name: "log-diaper" },
      { type: "tool_error", id: "t1", name: "log-diaper", error: "Child not found" },
    ]);
    expect(parts[0]).toMatchObject({ result: "Child not found", isError: true });
  });

  it("keeps text, tool and text in order", () => {
    const parts = reduce([
      { type: "text_delta", text: "Logger ... " },
      { type: "tool_use_start", id: "t1", name: "log-diaper" },
      { type: "tool_result", id: "t1", name: "log-diaper", result: "ok" },
      { type: "text_delta", text: "Ferdig!" },
    ]);
    expect(parts.map((part) => part.type)).toEqual(["text", "tool-call", "text"]);
  });

  it("returns the same array for events that change nothing", () => {
    const parts: readonly AssistantPart[] = [{ type: "text", text: "x" }];
    expect(applyStreamEvent(parts, { type: "message_start", id: "m1" })).toBe(parts);
  });
});
