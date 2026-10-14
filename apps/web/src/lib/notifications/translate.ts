import { createTranslator } from "next-intl";
import { type Locale } from "@/i18n/config";
import nb from "../../../messages/nb";
import en from "../../../messages/en";

const catalogs: Record<Locale, typeof nb> = { nb, en };

/**
 * Translates a message key from the `notifications` namespace for a
 * recipient's locale. Keys come from evaluators, so a typo must not break a
 * whole run: it logs and falls back to the key.
 */
export function translatePush(
  locale: Locale,
  key: string,
  params: Record<string, string | number> = {}
): string {
  const t = createTranslator({
    locale,
    messages: catalogs[locale],
    namespace: "notifications",
    onError: (error) => console.error("[notifications] translation", error.message),
    getMessageFallback: ({ namespace, key: missing }) => `${namespace}.${missing}`,
  }) as unknown as (key: string, values?: Record<string, string | number>) => string;
  return t(key, params);
}
