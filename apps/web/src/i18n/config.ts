export const locales = ["nb", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "nb";
export const localeCookie = "NEXT_LOCALE";
export const timeZone = "Europe/Oslo";

export function isLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}
