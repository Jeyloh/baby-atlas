"use client";

import Link from "next/link";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import { ChevronRight, MessageSquareText, Sparkles, Syringe, Toilet, type LucideIcon } from "lucide-react";

const MODULES: { path: string; key: "speech" | "potty" | "vaccines" | "insights"; icon: LucideIcon }[] = [
  { path: "vaccines", key: "vaccines", icon: Syringe },
  { path: "speech", key: "speech", icon: MessageSquareText },
  { path: "potty", key: "potty", icon: Toilet },
  { path: "insights", key: "insights", icon: Sparkles },
];

export function ModuleLinks({ childId }: { childId: string }) {
  const t = useTranslations("dashboard.modules");

  return (
    <section aria-labelledby="modules-title" className="space-y-2">
      <h2 id="modules-title" className="text-base font-semibold">
        {t("title")}
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {MODULES.map(({ path, key, icon: Icon }) => (
          <li key={key}>
            <Link
              href={`/dashboard/${childId}/${path}` as Route}
              className="flex min-h-14 items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-muted"
            >
              <Icon className="h-5 w-5 text-primary" aria-hidden />
              <span className="flex-1">
                <span className="block text-sm font-medium">{t(`${key}.title`)}</span>
                <span className="block text-xs text-muted-foreground">{t(`${key}.description`)}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
