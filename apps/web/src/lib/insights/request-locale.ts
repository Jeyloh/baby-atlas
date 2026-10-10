import { cookies } from "next/headers";
import {
  defaultLocale,
  isLocale,
  localeCookie,
  type Locale,
} from "@/i18n/config";

export async function getRequestLocale(): Promise<Locale> {
  const value = (await cookies()).get(localeCookie)?.value;
  return isLocale(value) ? value : defaultLocale;
}
