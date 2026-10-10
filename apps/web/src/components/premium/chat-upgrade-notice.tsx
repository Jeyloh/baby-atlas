"use client";

import { useTranslations } from "next-intl";
import { UpgradeCard } from "./upgrade-card";

export function ChatUpgradeNotice() {
  const t = useTranslations("premium");

  return (
    <div className="space-y-3 px-4 pb-4">
      <p role="alert" className="text-sm text-muted-foreground">
        {t("chatRequired")}
      </p>
      <UpgradeCard />
    </div>
  );
}
