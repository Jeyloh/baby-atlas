// @vitest-environment node
import { describe, it, expect } from "vitest";
import { detectImageType, isAllowedDeclaredType } from "./image-type";
import { fakeHeic, plainImage } from "./test-images";

describe("detectImageType", () => {
  it("recognises jpeg, png, webp and heic by their magic bytes", async () => {
    expect(detectImageType(await plainImage("jpeg"))).toBe("image/jpeg");
    expect(detectImageType(await plainImage("png"))).toBe("image/png");
    expect(detectImageType(await plainImage("webp"))).toBe("image/webp");
    expect(detectImageType(fakeHeic())).toBe("image/heic");
  });

  it("recognises other HEIF brands", () => {
    const heif = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypmif1"), Buffer.alloc(8)]);
    expect(detectImageType(heif)).toBe("image/heic");
  });

  it.each([
    ["GIF", Buffer.from("GIF89a" + "x".repeat(20))],
    ["SVG", Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')],
    ["HTML", Buffer.from("<html><script>alert(1)</script></html>")],
    ["MP4", Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(8)])],
    ["a RIFF wave file", Buffer.from("RIFF\0\0\0\0WAVEfmt ")],
    ["empty bytes", Buffer.alloc(0)],
  ])("rejects %s", (_name, bytes) => {
    expect(detectImageType(bytes)).toBeNull();
  });
});

describe("isAllowedDeclaredType", () => {
  it("allows the five image types and an empty type", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", ""]) {
      expect(isAllowedDeclaredType(type)).toBe(true);
    }
  });

  it("rejects everything else", () => {
    for (const type of ["image/gif", "image/svg+xml", "text/html", "application/pdf"]) {
      expect(isAllowedDeclaredType(type)).toBe(false);
    }
  });
});
