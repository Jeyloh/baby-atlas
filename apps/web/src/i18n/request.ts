import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, localeCookie, timeZone } from "./config";

// No locale segment in URLs: the locale comes from a cookie and defaults to
// Norwegian Bokmål. Users switch language in profile settings.
export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get(localeCookie)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    timeZone,
    messages: (await import(`../../messages/${locale}/index.ts`)).default,
  };
});
