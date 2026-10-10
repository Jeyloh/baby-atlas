import { describe, it, expect } from "vitest";
import { chatRequestSchema } from "./schema";
import { MAX_IMAGE_BYTES, MAX_IMAGES_PER_MESSAGE } from "./limits";
import { fakeImage } from "./test-fixtures";

const request = (content: unknown[], extra: Record<string, unknown> = {}) => ({
  childId: "child-1",
  messages: [{ role: "user", content }],
  ...extra,
});

const text = { type: "text", text: "Hva er dette?" };

describe("chatRequestSchema", () => {
  it("accepts text only and defaults the model to sonnet", () => {
    const result = chatRequestSchema.safeParse(request([text]));
    expect(result.success).toBe(true);
    expect(result.success && result.data.model).toBe("sonnet");
  });

  it.each(["image/jpeg", "image/png", "image/webp", "image/gif"] as const)(
    "accepts %s",
    (mediaType) => {
      const result = chatRequestSchema.safeParse(
        request([fakeImage(mediaType), text])
      );
      expect(result.success).toBe(true);
    }
  );

  it("accepts an image without text", () => {
    expect(chatRequestSchema.safeParse(request([fakeImage()])).success).toBe(true);
  });

  it("rejects an unsupported media type", () => {
    const image = { ...fakeImage(), mediaType: "image/heic" };
    expect(chatRequestSchema.safeParse(request([image, text])).success).toBe(false);
  });

  it("rejects more than 4 images in one message", () => {
    const images = Array.from({ length: MAX_IMAGES_PER_MESSAGE + 1 }, () => fakeImage());
    expect(chatRequestSchema.safeParse(request(images)).success).toBe(false);
  });

  it("accepts exactly 4 images", () => {
    const images = Array.from({ length: MAX_IMAGES_PER_MESSAGE }, () => fakeImage());
    expect(chatRequestSchema.safeParse(request(images)).success).toBe(true);
  });

  it("rejects an image over 5 MB after decoding", () => {
    const image = fakeImage("image/jpeg", MAX_IMAGE_BYTES + 1);
    expect(chatRequestSchema.safeParse(request([image])).success).toBe(false);
  });

  it("accepts an image of exactly 5 MB", () => {
    const image = fakeImage("image/jpeg", MAX_IMAGE_BYTES);
    expect(chatRequestSchema.safeParse(request([image])).success).toBe(true);
  });

  it("rejects data that is not base64", () => {
    const image = { ...fakeImage(), data: "not base64!!" };
    expect(chatRequestSchema.safeParse(request([image])).success).toBe(false);
  });

  it("rejects data that does not match the media type", () => {
    const image = { ...fakeImage("image/png"), mediaType: "image/jpeg" };
    expect(chatRequestSchema.safeParse(request([image])).success).toBe(false);
  });

  it("rejects images in assistant messages", () => {
    const body = {
      childId: "child-1",
      messages: [
        { role: "assistant", content: [fakeImage()] },
        { role: "user", content: [text] },
      ],
    };
    expect(chatRequestSchema.safeParse(body).success).toBe(false);
  });

  it("requires the last message to be from the user", () => {
    const body = {
      childId: "child-1",
      messages: [
        { role: "user", content: [text] },
        { role: "assistant", content: [{ type: "text", text: "Hei" }] },
      ],
    };
    expect(chatRequestSchema.safeParse(body).success).toBe(false);
  });

  it("rejects an unknown model", () => {
    expect(chatRequestSchema.safeParse(request([text], { model: "gpt" })).success).toBe(
      false
    );
  });

  it("rejects a missing childId", () => {
    expect(
      chatRequestSchema.safeParse({ messages: [{ role: "user", content: [text] }] })
        .success
    ).toBe(false);
  });
});
