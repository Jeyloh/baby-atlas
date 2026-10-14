export const locales = ["nb", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "nb";
export const localeCookie = "NEXT_LOCALE";
export const timeZone = "Europe/Oslo";

export function isLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}

/** The locale for a stored value, or the default when it is missing or unknown. */
export function toLocale(value: string | null | undefined): Locale {
  return isLocale(value ?? undefined) ? (value as Locale) : defaultLocale;
}
