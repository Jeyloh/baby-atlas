import { afterEach, describe, it, expect, vi } from "vitest";

const sendNotification = vi.hoisted(() => vi.fn());
vi.mock("web-push", () => ({ default: { sendNotification } }));

import { getVapidConfig, sendWebPush, topicFor } from "./send";

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;

describe("getVapidConfig", () => {
  const full = {
    VAPID_SUBJECT: "mailto:hei@example.com",
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "pub",
    VAPID_PRIVATE_KEY: "priv",
  };

  it("returns the keys when all three are set", () => {
    expect(getVapidConfig(env(full))).toEqual({
      subject: "mailto:hei@example.com",
      publicKey: "pub",
      privateKey: "priv",
    });
  });

  it("is null (push disabled) when anything is missing", () => {
    for (const key of Object.keys(full)) {
      const partial = { ...full } as Record<string, string>;
      delete partial[key];
      expect(getVapidConfig(env(partial))).toBeNull();
    }
    expect(getVapidConfig(env({}))).toBeNull();
  });

  it("is null when the subject is not a mailto: or https: URL", () => {
    expect(getVapidConfig(env({ ...full, VAPID_SUBJECT: "hei@example.com" }))).toBeNull();
  });
});

describe("topicFor", () => {
  it("is stable, URL-safe and at most 32 characters", () => {
    const topic = topicFor("timer:clq1234567890abcdefghij05:2x");
    expect(topic).toBe(topicFor("timer:clq1234567890abcdefghij05:2x"));
    expect(topic).toMatch(/^[A-Za-z0-9_-]{1,32}$/);
    expect(topic).not.toBe(topicFor("timer:clq1234567890abcdefghij05:1x"));
  });
});

describe("sendWebPush", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    sendNotification.mockReset();
  });

  const subscription = {
    id: "s1",
    endpoint: "https://fcm.googleapis.com/fcm/send/abc",
    p256dh: "k",
    auth: "a",
    lastSuccessAt: null,
    createdAt: new Date(),
  };
  const payload = { title: "t", body: "b", tag: "x", url: "/dashboard" };

  function configure() {
    vi.stubEnv("VAPID_SUBJECT", "mailto:hei@example.com");
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "pub");
    vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
  }

  it("gives each request a 10 second timeout", async () => {
    configure();
    sendNotification.mockResolvedValue({});
    await sendWebPush(subscription, payload, { ttlSeconds: 3600 });
    expect(sendNotification.mock.calls[0]![2]).toMatchObject({ timeout: 10_000, TTL: 3600 });
  });

  it("reports 404 and 410 as gone and other statuses as not gone", async () => {
    configure();
    sendNotification.mockRejectedValueOnce({ statusCode: 410 });
    expect(await sendWebPush(subscription, payload, { ttlSeconds: 1 })).toEqual({ ok: false, gone: true, statusCode: 410 });
    sendNotification.mockRejectedValueOnce({ statusCode: 503 });
    expect(await sendWebPush(subscription, payload, { ttlSeconds: 1 })).toEqual({ ok: false, gone: false, statusCode: 503 });
    sendNotification.mockRejectedValueOnce(new Error("socket hang up"));
    expect(await sendWebPush(subscription, payload, { ttlSeconds: 1 })).toEqual({ ok: false, gone: false, statusCode: undefined });
  });
});
