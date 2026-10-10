import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeImage } from "@/lib/chat/test-fixtures";
import { OLD_IMAGE_PLACEHOLDER } from "@/lib/chat/limits";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findChild: vi.fn(),
  checkUserSubscription: vi.fn(),
  stream: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@baby-atlas/db", () => ({
  prisma: { child: { findUnique: mocks.findChild } },
}));
vi.mock("@/lib/subscription", () => ({
  checkUserSubscription: mocks.checkUserSubscription,
}));
vi.mock("@/lib/insights/request-locale", () => ({
  getRequestLocale: async () => "nb",
}));
vi.mock("@baby-atlas/mcp-server/tools", () => ({
  registerTools: () => [],
  handleToolCall: vi.fn(),
}));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { stream: mocks.stream };
  },
}));

import { POST } from "./route";

const text = (value: string) => ({ type: "text", text: value });
const user = (...content: unknown[]) => ({ role: "user", content });
const assistant = (value: string) => ({ role: "assistant", content: [text(value)] });

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

function fakeStream(chunks: string[]) {
  return {
    async *[Symbol.asyncIterator]() {
      yield { type: "message_start", message: { id: "msg_1" } };
      for (const chunk of chunks) {
        yield { type: "content_block_delta", delta: { type: "text_delta", text: chunk } };
      }
    },
    finalMessage: async () => ({ content: [], stop_reason: "end_turn" }),
  };
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";
    mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
    mocks.findChild.mockResolvedValue({
      id: "child-1",
      name: "Mia",
      birthDate: new Date("2026-01-01"),
      household: { members: [{ userId: "user-1", role: "OWNER" }] },
    });
    mocks.checkUserSubscription.mockResolvedValue({ isPremium: true });
    mocks.stream.mockReturnValue(fakeStream(["Hei"]));
  });

  const valid = { childId: "child-1", messages: [user(text("Hei"))] };

  it("returns 401 without a session", async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await post(valid)).status).toBe(401);
  });

  it("returns 400 for an unsupported image type", async () => {
    const heic = { ...fakeImage(), mediaType: "image/heic" };
    const response = await post({ ...valid, messages: [user(heic, text("Hei"))] });
    expect(response.status).toBe(400);
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it("returns 400 for more than 4 images", async () => {
    const images = Array.from({ length: 5 }, () => fakeImage());
    const response = await post({ ...valid, messages: [user(...images)] });
    expect(response.status).toBe(400);
  });

  it("returns 400 for an image over 5 MB", async () => {
    const huge = fakeImage("image/jpeg", 5 * 1024 * 1024 + 1);
    const response = await post({ ...valid, messages: [user(huge)] });
    expect(response.status).toBe(400);
  });

  it("returns 400 for a body that is not JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", { method: "POST", body: "nope" })
    );
    expect(response.status).toBe(400);
  });

  it("returns 403 when the user is not in the household", async () => {
    mocks.findChild.mockResolvedValue({
      id: "child-1",
      name: "Mia",
      birthDate: null,
      household: { members: [] },
    });
    expect((await post(valid)).status).toBe(403);
  });

  it("returns 402 premium_required for free users", async () => {
    mocks.checkUserSubscription.mockResolvedValue({ isPremium: false });
    const response = await post(valid);
    expect(response.status).toBe(402);
    expect(await response.json()).toEqual({ error: "premium_required" });
  });

  it("streams text and sends images to Claude as base64 image blocks", async () => {
    const image = fakeImage("image/png");
    const response = await post({
      ...valid,
      model: "opus",
      messages: [user(image, text("Hva er dette?"))],
    });

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain('"type":"text_delta","text":"Hei"');
    expect(body).toContain("data: [DONE]");

    const [params] = mocks.stream.mock.calls[0]!;
    expect(params.model).toBe("claude-opus-5-5");
    expect(params.messages).toEqual([
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: "image/png", data: image.data },
          },
          { type: "text", text: "Hva er dette?" },
        ],
      },
    ]);
  });

  it("limits history to 20 messages and replaces old images", async () => {
    const history = Array.from({ length: 30 }, (_, i) =>
      i % 2 === 0 ? user(text(`u${i}`)) : assistant(`a${i}`)
    );
    const messages = [
      user(fakeImage(), text("old photo")),
      assistant("r"),
      ...history,
      user(fakeImage(), text("recent 1")),
      assistant("r"),
      user(fakeImage(), text("recent 2")),
    ];
    await post({ ...valid, messages });

    const sent = mocks.stream.mock.calls[0]![0].messages as {
      role: string;
      content: { type: string; text?: string }[] | string;
    }[];
    expect(sent.length).toBeLessThanOrEqual(20);
    expect(sent[0]!.role).toBe("user");

    const imageBlocks = sent.flatMap((m) =>
      Array.isArray(m.content) ? m.content.filter((b) => b.type === "image") : []
    );
    expect(imageBlocks).toHaveLength(2);
    expect(JSON.stringify(sent)).not.toContain("old photo");
  });

  it("replaces images from older turns with the placeholder", async () => {
    await post({
      ...valid,
      messages: [
        user(fakeImage(), text("one")),
        assistant("r"),
        user(fakeImage(), text("two")),
        assistant("r"),
        user(fakeImage(), text("three")),
      ],
    });

    const sent = mocks.stream.mock.calls[0]![0].messages;
    expect(sent[0].content).toEqual([
      { type: "text", text: "one" },
      { type: "text", text: OLD_IMAGE_PLACEHOLDER },
    ]);
    expect(sent[2].content[0].type).toBe("image");
    expect(sent[4].content[0].type).toBe("image");
  });
});
