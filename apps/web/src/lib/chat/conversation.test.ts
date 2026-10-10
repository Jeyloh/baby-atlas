import { describe, it, expect } from "vitest";
import { trimConversation } from "./conversation";
import { toAnthropicMessages } from "./anthropic-messages";
import { MAX_HISTORY_MESSAGES, OLD_IMAGE_PLACEHOLDER } from "./limits";
import type { ChatMessage } from "./schema";
import { fakeImage } from "./test-fixtures";

const user = (label: string, withImage = false): ChatMessage => ({
  role: "user",
  content: [...(withImage ? [fakeImage()] : []), { type: "text", text: label }],
});
const assistant = (label: string): ChatMessage => ({
  role: "assistant",
  content: [{ type: "text", text: label }],
});

const imageCount = (message: ChatMessage) =>
  message.content.filter((part) => part.type === "image").length;

describe("trimConversation", () => {
  it("keeps short conversations unchanged", () => {
    const messages = [user("a"), assistant("b"), user("c")];
    expect(trimConversation(messages)).toEqual(messages);
  });

  it("keeps at most the last 20 messages", () => {
    const messages = Array.from({ length: 42 }, (_, i) =>
      i % 2 === 0 ? user(`u${i}`) : assistant(`a${i}`)
    );
    const trimmed = trimConversation(messages);
    expect(trimmed).toHaveLength(MAX_HISTORY_MESSAGES);
    expect(trimmed[0]).toEqual(messages[22]);
    expect(trimmed[trimmed.length - 1]).toEqual(messages[41]);
  });

  it("starts with a user message after trimming", () => {
    const messages = Array.from({ length: 22 }, (_, i) =>
      i % 2 === 0 ? assistant(`a${i}`) : user(`u${i}`)
    );
    const trimmed = trimConversation([user("first"), ...messages]);
    expect(trimmed[0]?.role).toBe("user");
    expect(trimmed.length).toBeLessThanOrEqual(MAX_HISTORY_MESSAGES);
  });

  it("replaces images older than the last 2 user turns with a placeholder", () => {
    const messages = [
      user("one", true),
      assistant("r1"),
      user("two", true),
      assistant("r2"),
      user("three", true),
    ];
    const trimmed = trimConversation(messages);

    expect(imageCount(trimmed[0]!)).toBe(0);
    expect(trimmed[0]!.content).toContainEqual({
      type: "text",
      text: OLD_IMAGE_PLACEHOLDER,
    });
    expect(imageCount(trimmed[2]!)).toBe(1);
    expect(imageCount(trimmed[4]!)).toBe(1);
  });

  it("adds one placeholder per message even with several images", () => {
    const manyImages: ChatMessage = {
      role: "user",
      content: [fakeImage(), fakeImage(), { type: "text", text: "old" }],
    };
    const trimmed = trimConversation([
      manyImages,
      assistant("r"),
      user("two"),
      assistant("r"),
      user("three"),
    ]);
    const placeholders = trimmed[0]!.content.filter(
      (part) => part.type === "text" && part.text === OLD_IMAGE_PLACEHOLDER
    );
    expect(placeholders).toHaveLength(1);
    expect(imageCount(trimmed[0]!)).toBe(0);
  });

  it("does not touch images when there are two user turns or fewer", () => {
    const messages = [user("one", true), assistant("r"), user("two", true)];
    const trimmed = trimConversation(messages);
    expect(imageCount(trimmed[0]!)).toBe(1);
    expect(imageCount(trimmed[2]!)).toBe(1);
  });
});

describe("toAnthropicMessages", () => {
  it("sends images as base64 image blocks before the text", () => {
    const image = fakeImage("image/png");
    const [message] = toAnthropicMessages([
      { role: "user", content: [{ type: "text", text: "Se her" }, image] },
    ]);

    expect(message).toEqual({
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: "image/png", data: image.data },
        },
        { type: "text", text: "Se her" },
      ],
    });
  });

  it("sends assistant messages as plain text", () => {
    const [message] = toAnthropicMessages([assistant("Hei")]);
    expect(message).toEqual({ role: "assistant", content: "Hei" });
  });
});
