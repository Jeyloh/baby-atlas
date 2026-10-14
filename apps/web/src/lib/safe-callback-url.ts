/**
 * A post-login destination, only if it is a path on this site, so a crafted
 * link cannot send people to another site. Browsers read `/\` like `//`, so
 * backslashes are rejected as well.
 */
export function safeCallbackUrl(value: string | null | undefined): string {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/dashboard";
}

/** The login page address that returns to `path` after signing in. */
export function loginUrlFor(path: string | null | undefined): string {
  const target = safeCallbackUrl(path);
  return target === "/dashboard" ? "/login" : `/login?callbackUrl=${encodeURIComponent(target)}`;
}
