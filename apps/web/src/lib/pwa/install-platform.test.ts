import { describe, expect, it } from "vitest";
import { getInstallHint } from "./install-platform";

const SAFARI_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const CHROME_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.6668.69 Mobile/15E148 Safari/604.1";
const IPAD_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const INSTAGRAM =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0";
const MESSENGER =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/480.0]";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";

const base = { maxTouchPoints: 5, standalone: false, nativeShell: false };

describe("getInstallHint", () => {
  it("shows the share steps in Safari and Chrome on iPhone", () => {
    expect(getInstallHint({ ...base, userAgent: SAFARI_IPHONE })).toBe("share");
    expect(getInstallHint({ ...base, userAgent: CHROME_IPHONE })).toBe("share");
  });

  it("treats a touch Mac as an iPad", () => {
    expect(getInstallHint({ ...base, userAgent: IPAD_SAFARI })).toBe("share");
    expect(getInstallHint({ ...base, maxTouchPoints: 0, userAgent: IPAD_SAFARI })).toBeNull();
  });

  it("asks to open Safari from in-app browsers", () => {
    expect(getInstallHint({ ...base, userAgent: INSTAGRAM })).toBe("openInSafari");
    expect(getInstallHint({ ...base, userAgent: MESSENGER })).toBe("openInSafari");
  });

  it("shows nothing when installed, in the native shell or off iOS", () => {
    expect(getInstallHint({ ...base, standalone: true, userAgent: SAFARI_IPHONE })).toBeNull();
    expect(getInstallHint({ ...base, nativeShell: true, userAgent: INSTAGRAM })).toBeNull();
    expect(getInstallHint({ ...base, userAgent: ANDROID })).toBeNull();
  });
});
