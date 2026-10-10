"use client";

import { useTranslations } from "next-intl";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const FEATURE_KEYS = ["insights", "chat", "stats"] as const;

export function UpgradeCard({ className }: { className?: string }) {
  const t = useTranslations("premium");

  return (
    <Card className={cn("border-primary/30", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("intro")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2 text-sm">
          {FEATURE_KEYS.map((key) => (
            <li key={key} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{t(`features.${key}`)}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm font-medium">{t("loggingFree")}</p>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2">
        <Button disabled>{t("upgrade")}</Button>
        <p className="text-xs text-muted-foreground">{t("comingSoon")}</p>
      </CardFooter>
    </Card>
  );
}
