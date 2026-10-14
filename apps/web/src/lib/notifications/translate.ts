import { createTranslator } from "next-intl";
import { type Locale } from "@/i18n/config";
import type { MessageRef } from "./types";
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

/** Namespaces and key shapes a MessageRef may point at. */
const REF_KEYS: Record<MessageRef["ref"], RegExp> = {
  tips: /^(week|month)\.\d{1,2}\.(title|body)$/,
};

function isMessageRef(value: unknown): value is MessageRef {
  return typeof value === "object" && value !== null && "ref" in value && "key" in value;
}

/**
 * Translates a message key from the `notifications` namespace for a
 * recipient's locale. Keys come from evaluators, so a typo must not break a
 * whole run: it logs and falls back to the key.
 *
 * Plain string params are always literal (a child may be named anything). To
 * quote content from another namespace, pass a MessageRef; only allowlisted
 * namespaces and key shapes resolve.
 */
export function translatePush(
  locale: Locale,
  key: string,
  params: Record<string, string | number | MessageRef> = {}
): string {
  const resolved: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(params)) {
    if (!isMessageRef(value)) {
      resolved[name] = value;
    } else if (REF_KEYS[value.ref]?.test(value.key)) {
      resolved[name] = translatorFor(locale, value.ref)(value.key);
    } else {
      console.error("[notifications] rejected message ref", value.ref);
      resolved[name] = "";
    }
  }
  return translatorFor(locale, "notifications")(key, resolved);
}