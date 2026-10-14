import { describe, it, expect } from "vitest";
import { urlBase64ToUint8Array } from "./client";

describe("urlBase64ToUint8Array", () => {
  it("decodes URL-safe base64 without padding", () => {
    // bytes 0xfb 0xff 0xfe encode to "-__-" in URL-safe base64 ("+//+" in standard)
    expect([...urlBase64ToUint8Array("-__-")]).toEqual([0xfb, 0xff, 0xfe]);
  });

  it("adds the missing padding", () => {
    expect([...urlBase64ToUint8Array("aGk")]).toEqual([104, 105]);
  });
});
