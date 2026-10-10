import { describe, it, expect } from "vitest";
import type { ThreadMessage } from "@assistant-ui/react";
import { dataUrlToImagePart, toChatMessages } from "./to-chat-messages";
import { fakeImage } from "./test-fixtures";

const image = fakeImage("image/jpeg");
const dataUrl = `data:image/jpeg;base64,${image.data}`;

const userMessage = (overrides: Record<string, unknown>) =>
  ({
    id: "u1",
    role: "user",
    createdAt: new Date(),
    content: [],
    attachments: [],
    metadata: { custom: {} },
    ...overrides,
  }) as unknown as ThreadMessage;

const assistantMessage = (content: unknown[]) =>
  ({
    id: "a1",
    role: "assistant",
    createdAt: new Date(),
    content,
    status: { type: "complete", reason: "stop" },
    metadata: { unstable_state: null, unstable_annotations: [], unstable_data: [], steps: [], custom: {} },
  }) as unknown as ThreadMessage;

describe("dataUrlToImagePart", () => {
  it("splits a data URL into media type and base64", () => {
    expect(dataUrlToImagePart(dataUrl)).toEqual(image);
  });

  it("rejects unsupported media types and non-data URLs", () => {
    expect(dataUrlToImagePart("data:image/heic;base64,AAAA")).toBeNull();
    expect(dataUrlToImagePart("https://example.com/a.jpg")).toBeNull();
  });
});

describe("toChatMessages", () => {
  it("collects text and attachment images from a user message", () => {
    const messages = toChatMessages([
      userMessage({
        content: [{ type: "text", text: "Hva er dette?" }],
        attachments: [
          { id: "att", type: "image", name: "a.jpg", status: { type: "complete" }, content: [{ type: "image", image: dataUrl }] },
        ],
      }),
    ]);

    expect(messages).toEqual([
      { role: "user", content: [image, { type: "text", text: "Hva er dette?" }] },
    ]);
  });

  it("drops empty messages and tool calls from assistant messages", () => {
    const messages = toChatMessages([
      userMessage({ content: [{ type: "text", text: "Logg bleie" }] }),
      assistantMessage([
        { type: "text", text: "Logger ..." },
        { type: "tool-call", toolCallId: "t", toolName: "log-diaper", args: {}, argsText: "{}" },
      ]),
      assistantMessage([{ type: "tool-call", toolCallId: "t2", toolName: "x", args: {}, argsText: "{}" }]),
    ]);

    expect(messages).toEqual([
      { role: "user", content: [{ type: "text", text: "Logg bleie" }] },
      { role: "assistant", content: [{ type: "text", text: "Logger ..." }] },
    ]);
  });
});
