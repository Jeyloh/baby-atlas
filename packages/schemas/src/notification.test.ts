import { describe, it, expect } from "vitest";
import { isAllowedPushEndpoint, subscribePushSchema } from "./notification";

describe("isAllowedPushEndpoint", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
    "https://web.push.apple.com/abc",
  ])("accepts %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(true);
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://example.com/push",
    "https://evilfcm.googleapis.com.example.com/x",
    "https://notfcm.googleapis.com/x",
    "https://fcm.googleapis.com:8443/x",
    "https://user:pw@fcm.googleapis.com/x",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/x",
    "not a url",
  ])("rejects %s", (endpoint) => {
    expect(isAllowedPushEndpoint(endpoint)).toBe(false);
  });
});

describe("subscribePushSchema", () => {
  it("rejects an endpoint on an unknown host", () => {
    const result = subscribePushSchema.safeParse({
      endpoint: "https://example.com/push",
      keys: { p256dh: "a", auth: "b" },
    });
    expect(result.success).toBe(false);
  });
});
