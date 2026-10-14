import { createTranslator } from "next-intl";
import { type Locale } from "@/i18n/config";
import nb from "../../../messages/nb";
import en from "../../../messages/en";

const catalogs: Record<Locale, typeof nb> = { nb, en };

type Translate = (key: string, values?: Record<string, string | number>) => string;

function translatorFor(locale: Locale, namespace: string): Translate {
  return createTranslator({
    locale,
    messages: catalogs[locale],
    namespace,
    onError: (error) => console.error("[notifications] translation", error.message),
    getMessageFallback: ({ namespace: ns, key }) => `${ns}.${key}`,
  } as Parameters<typeof createTranslator>[0]) as unknown as Translate;
}

/** `@<namespace>:<key>`: a param whose text comes from another namespace. */
const MESSAGE_REF = /^@([A-Za-z]+):(.+)$/;

/**
 * Translates a message key from the `notifications` namespace for a
 * recipient's locale. Keys come from evaluators, so a typo must not break a
 * whole run: it logs and falls back to the key.
 *
 * A string param written as `@<namespace>:<key>` (for example
 * `@tips:week.12.title`) is first replaced by that message in the same locale,
 * so content that lives in its own namespace can be quoted in a push.
 */
export function translatePush(
  locale: Locale,
  key: string,
  params: Record<string, string | number> = {}
): string {
  const resolved: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(params)) {
    const ref = typeof value === "string" ? MESSAGE_REF.exec(value) : null;
    resolved[name] = ref ? translatorFor(locale, ref[1]!)(ref[2]!) : value;
  }
  return translatorFor(locale, "notifications")(key, resolved);
}
