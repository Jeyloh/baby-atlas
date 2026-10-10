"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc/provider";
import { Button } from "@/components/ui/button";

export interface ToddlerChild {
  id: string;
  name: string;
  birthDate: Date;
}

interface ChildPageProps {
  childId: string;
  title: string;
  notFoundLabel: string;
  children: (child: ToddlerChild) => ReactNode;
}

export function ChildPage({ childId, title, notFoundLabel, children }: ChildPageProps) {
  const t = useTranslations("common");
  const { data: child, isLoading } = trpc.child.get.useQuery({ id: childId });

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t("loading")}</div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{notFoundLabel}</p>
        <Button asChild className="min-h-12">
          <Link href="/dashboard">{t("back")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-8">
      <header className="flex items-center gap-1">
        <Button asChild variant="ghost" size="icon-lg" className="-ml-3 h-12 w-12 shrink-0 rounded-full">
          <Link href={`/dashboard/${childId}`} aria-label={t("back")}>
            <ArrowLeft className="!size-5" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-semibold leading-tight tracking-tight">
            {title}
          </h1>
          <p className="truncate text-sm text-muted-foreground">{child.name}</p>
        </div>
      </header>
      {children(child)}
    </div>
  );
}
