/**
 * What an iPhone or iPad user needs to do to put the app on the home screen.
 * iOS has no install prompt API, so the app can only show the steps.
 * - "share": a browser with the share sheet item "Add to Home Screen"
 *   (Safari, and Chrome, Firefox and Edge since iOS 16.4)
 * - "openInSafari": an in-app browser (Facebook, Instagram, Messenger and
 *   others), where iOS hides that item
 * - null: not iOS, already installed, or the native shell
 */
export type InstallHint = "share" | "openInSafari" | null;

const IN_APP_BROWSER = /FBAN|FBAV|FBIOS|Instagram|Messenger|Snapchat|Line\/|LinkedInApp|GSA\//;

export function getInstallHint(env: {
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean;
  nativeShell: boolean;
}): InstallHint {
  if (env.standalone || env.nativeShell) return null;

  // iPadOS reports itself as a Mac, so touch support tells them apart
  const iOS =
    /iPhone|iPad|iPod/.test(env.userAgent) ||
    (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1);
  if (!iOS) return null;

  // Web views inside other apps usually drop the "Safari/" token
  if (IN_APP_BROWSER.test(env.userAgent) || !/Safari\//.test(env.userAgent)) {
    return "openInSafari";
  }
  return "share";
}

export function detectInstallHint(): InstallHint {
  const nav = navigator as Navigator & { standalone?: boolean };
  const capacitor = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return getInstallHint({
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    standalone: nav.standalone === true || window.matchMedia("(display-mode: standalone)").matches,
    nativeShell: capacitor?.isNativePlatform?.() === true,
  });
}
