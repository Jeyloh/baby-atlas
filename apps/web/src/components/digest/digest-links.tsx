"use client";

import Link from "next/link";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import { CalendarDays, ChevronRight, FileText, type LucideIcon } from "lucide-react";

const LINKS: { path: string; key: "digest" | "report"; icon: LucideIcon }[] = [
  { path: "digest", key: "digest", icon: CalendarDays },
  { path: "report", key: "report", icon: FileText },
];

/** Entry points to the free weekly summary and the printable visit report. */
export function DigestLinks({ childId }: { childId: string }) {
  const t = useTranslations("digest.links");

  return (
    <ul className="divide-y overflow-hidden rounded-lg border bg-card">
      {LINKS.map(({ path, key, icon: Icon }) => (
        <li key={key}>
          <Link
            href={`/dashboard/${childId}/${path}` as Route}
            className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
              <Icon className="h-[18px] w-[18px]" aria-hidden />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-medium">{t(key)}</span>
              <span className="block text-xs text-muted-foreground">{t(`${key}Description`)}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
