import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatModelRunOptions, ChatModelRunResult } from "@assistant-ui/react";
import { createChatModelAdapter, PremiumRequiredError } from "./chat-model-adapter";
import { fakeImage } from "./test-fixtures";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const errorMessages = { generic: "Noe gikk galt", tooManyImages: "For mange bilder" };

function sseResponse(events: object[]) {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return { ok: true, status: 200, body };
}

const userText = (text: string) => ({
  id: "u",
  role: "user",
  createdAt: new Date(),
  content: [{ type: "text", text }],
  attachments: [],
  metadata: { custom: {} },
});

function run(messages: unknown[], signal = new AbortController().signal) {
  const onPremiumRequired = vi.fn();
  const adapter = createChatModelAdapter({
    childId: "child-1",
    getModel: () => "opus",
    onPremiumRequired,
    errorMessages,
  });
  const generator = adapter.run({
    messages,
    abortSignal: signal,
  } as unknown as ChatModelRunOptions) as AsyncGenerator<ChatModelRunResult, void>;
  return { generator, onPremiumRequired };
}

async function drain(generator: AsyncGenerator<ChatModelRunResult, void>) {
  const results: ChatModelRunResult[] = [];
  for await (const result of generator) results.push(result);
  return results;
}

describe("createChatModelAdapter", () => {
  beforeEach(() => mockFetch.mockReset());

  it("posts the model and trimmed conversation", async () => {
    mockFetch.mockResolvedValueOnce(sseResponse([]));
    await drain(run([userText("Hei")]).generator);

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe("/api/chat");
    expect(JSON.parse(init.body)).toEqual({
      childId: "child-1",
      model: "opus",
      messages: [{ role: "user", content: [{ type: "text", text: "Hei" }] }],
    });
  });

  it("yields cumulative content while streaming", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([
        { type: "text_delta", text: "Hei " },
        { type: "text_delta", text: "der" },
      ])
    );
    const results = await drain(run([userText("Hei")]).generator);

    expect(results.map((r) => r.content)).toEqual([
      [{ type: "text", text: "Hei " }],
      [{ type: "text", text: "Hei der" }],
    ]);
  });

  it("reports premium required on 402", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 402, json: async () => ({}) });
    const { generator, onPremiumRequired } = run([userText("Hei")]);

    await expect(drain(generator)).rejects.toBeInstanceOf(PremiumRequiredError);
    expect(onPremiumRequired).toHaveBeenCalledOnce();
  });

  it("throws the server error message on other failures", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "Invalid chat request" }),
    });
    await expect(drain(run([userText("Hei")]).generator)).rejects.toThrow(
      "Invalid chat request"
    );
  });

  it("falls back to the generic message when the error body is not JSON", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    });
    await expect(drain(run([userText("Hei")]).generator)).rejects.toThrow("Noe gikk galt");
  });

  it("throws stream error events", async () => {
    mockFetch.mockResolvedValueOnce(sseResponse([{ type: "error", error: "Connection lost" }]));
    await expect(drain(run([userText("Hei")]).generator)).rejects.toThrow("Connection lost");
  });

  it("rejects more than 4 images before calling the API", async () => {
    const dataUrl = `data:image/jpeg;base64,${fakeImage().data}`;
    const message = {
      ...userText("Hei"),
      attachments: Array.from({ length: 5 }, (_, i) => ({
        id: String(i),
        type: "image",
        name: `${i}.jpg`,
        status: { type: "complete" },
        content: [{ type: "image", image: `${dataUrl}${"A".repeat(4 * i)}` }],
      })),
    };

    await expect(drain(run([message]).generator)).rejects.toThrow("For mange bilder");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("ends quietly when the request is aborted", async () => {
    const controller = new AbortController();
    mockFetch.mockImplementationOnce(async () => {
      controller.abort();
      throw new DOMException("Aborted", "AbortError");
    });

    const results = await drain(run([userText("Hei")], controller.signal).generator);
    expect(results).toEqual([]);
  });
});
