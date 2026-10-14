"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/provider";
import { shortcutDestination } from "@/lib/pwa/shortcuts";

/**
 * Landing page for home screen shortcuts. Picks the child the app opens by
 * default (the first child of the first household, like /dashboard does) and
 * forwards to the shortcut's page for that child.
 */
export default function ShortcutRedirectPage({
  params,
}: {
  params: Promise<{ target: string }>;
}) {
  const { target } = use(params);
  const router = useRouter();
  const tCommon = useTranslations("common");
  const { data: households, isLoading } = trpc.household.list.useQuery();

  const firstChild = households?.[0]?.children?.[0];

  useEffect(() => {
    if (isLoading) return;
    const destination = firstChild ? shortcutDestination(target, firstChild.id) : null;
    // No child yet, or an unknown shortcut: the dashboard handles both
    router.replace((destination ?? "/dashboard") as Route);
  }, [isLoading, firstChild, target, router]);

  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="animate-pulse text-muted-foreground">{tCommon("loading")}</div>
    </div>
  );
}
