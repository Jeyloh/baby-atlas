import { describe, it, expect } from "vitest";
import { getVapidConfig, topicFor } from "./send";

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
