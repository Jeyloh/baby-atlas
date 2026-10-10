"use client";

import Link from "next/link";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import { BookHeart, ChevronRight, MessageSquareText, Sparkles, Syringe, Toilet, type LucideIcon } from "lucide-react";

const MODULES: {
  path: string;
  key: "journal" | "speech" | "potty" | "vaccines" | "insights";
  icon: LucideIcon;
}[] = [
  { path: "journal", key: "journal", icon: BookHeart },
  { path: "vaccines", key: "vaccines", icon: Syringe },
  { path: "speech", key: "speech", icon: MessageSquareText },
  { path: "potty", key: "potty", icon: Toilet },
  { path: "insights", key: "insights", icon: Sparkles },
];

export function ModuleLinks({ childId }: { childId: string }) {
  const t = useTranslations("dashboard.modules");

  return (
    <section aria-labelledby="modules-title" className="space-y-2">
      <h2 id="modules-title" className="text-lg font-semibold">
        {t("title")}
      </h2>
      {/* One grouped list, like a settings screen: these are destinations, not data */}
      <ul className="divide-y overflow-hidden rounded-lg border bg-card">
        {MODULES.map(({ path, key, icon: Icon }) => (
          <li key={key}>
            <Link
              href={`/dashboard/${childId}/${path}` as Route}
              className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                <Icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
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
