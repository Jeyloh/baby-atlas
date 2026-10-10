import type messages from "../../messages/nb";
import type { Locale } from "./config";

// Bokmål is the source of truth for message keys. English must match it.
declare module "next-intl" {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}
