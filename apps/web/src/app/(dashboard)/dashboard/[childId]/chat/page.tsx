"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/provider";
import { Button } from "@/components/ui/button";
import { Chat } from "@/components/chat";

export default function ChatPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = use(params);
  const t = useTranslations("chat");
  const tCommon = useTranslations("common");

  const { data: child, isLoading: childLoading } = trpc.child.get.useQuery({
    id: childId,
  });

  if (childLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">{tCommon("loading")}</div>
      </div>
    );
  }

  if (!child) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-muted-foreground">{t("notFound")}</p>
        <Button asChild>
          <Link href="/dashboard">{t("backToDashboard")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100dvh-4.0625rem)] flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b px-2 py-1">
        <Button asChild variant="ghost" size="icon-sm">
          <Link href={`/dashboard/${childId}`}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">{tCommon("back")}</span>
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="font-display truncate text-base font-semibold">{t("title")}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {t("trackingFor", { name: child.name })}
          </p>
        </div>
      </div>
      <Chat childId={childId} className="flex-1" />
    </div>
  );
}
