import { afterEach, describe, it, expect, vi } from "vitest";
import { PUSH_OWNER_KEY, dropBrowserPushSubscription, urlBase64ToUint8Array, usesApplicationServerKey } from "./client";

describe("urlBase64ToUint8Array", () => {
  it("decodes URL-safe base64 without padding", () => {
    // bytes 0xfb 0xff 0xfe encode to "-__-" in URL-safe base64 ("+//+" in standard)
    expect([...urlBase64ToUint8Array("-__-")]).toEqual([0xfb, 0xff, 0xfe]);
  });

  it("adds the missing padding", () => {
    expect([...urlBase64ToUint8Array("aGk")]).toEqual([104, 105]);
  });
});

describe("usesApplicationServerKey", () => {
  const key = "-__-"; // bytes fb ff fe
  const subscription = (bytes: number[] | undefined) =>
    ({ options: { applicationServerKey: bytes ? new Uint8Array(bytes).buffer : null } }) as unknown as PushSubscription;

  it("matches the key the subscription was made with", () => {
    expect(usesApplicationServerKey(subscription([0xfb, 0xff, 0xfe]), key)).toBe(true);
  });

  it("does not match another key, a different length or no key", () => {
    expect(usesApplicationServerKey(subscription([0xfb, 0xff, 0x00]), key)).toBe(false);
    expect(usesApplicationServerKey(subscription([0xfb, 0xff]), key)).toBe(false);
    expect(usesApplicationServerKey(subscription(undefined), key)).toBe(false);
  });
});

describe("dropBrowserPushSubscription", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("unsubscribes the browser and clears the push owner flag", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("navigator", {
      serviceWorker: {
        getRegistration: async () => ({
          pushManager: { getSubscription: async () => ({ endpoint: "https://fcm.googleapis.com/x", unsubscribe }) },
        }),
      },
    });
    localStorage.setItem(PUSH_OWNER_KEY, "user-1");

    expect(await dropBrowserPushSubscription()).toBe("https://fcm.googleapis.com/x");
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(localStorage.getItem(PUSH_OWNER_KEY)).toBeNull();
  });

  it("does nothing, without throwing, when the browser has no service worker", async () => {
    vi.stubGlobal("navigator", {});
    expect(await dropBrowserPushSubscription()).toBeUndefined();
  });

  it("swallows errors", async () => {
    vi.stubGlobal("navigator", {
      serviceWorker: { getRegistration: async () => { throw new Error("nope"); } },
    });
    expect(await dropBrowserPushSubscription()).toBeUndefined();
  });
});
