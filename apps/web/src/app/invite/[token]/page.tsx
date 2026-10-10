"use client";

import { use } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/provider";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { useToast } from "@/hooks/use-toast";

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const t = useTranslations("invite");
  const tRole = useTranslations("enums.householdRole");
  const router = useRouter();
  const { toast } = useToast();
  const { status } = useSession();

  const { data: invite, isLoading, error } = trpc.household.getInvite.useQuery(
    { token },
    { retry: false }
  );

  const accept = trpc.household.acceptInvite.useMutation({
    onSuccess: (result) => {
      toast({ title: t("joined", { household: invite?.householdName ?? "" }) });
      router.push(result.childId ? `/dashboard/${result.childId}` : "/dashboard");
    },
    onError: (err) => toast({ title: t("failed"), description: err.message, variant: "destructive" }),
  });

  const loginHref = `/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}` as Route;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6 text-center">
        <BrandMark className="mx-auto h-12 w-12" />

        {isLoading && <p className="text-muted-foreground">{t("loading")}</p>}

        {(error || invite?.expired) && (
          <div className="space-y-3">
            <h1 className="text-2xl font-semibold">{t("invalidTitle")}</h1>
            <p className="text-muted-foreground">{t("invalidBody")}</p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard">{t("toApp")}</Link>
            </Button>
          </div>
        )}

        {invite && !invite.expired && (
          <div className="space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">
                {invite.invitedByName
                  ? t("titleFrom", { name: invite.invitedByName, household: invite.householdName })
                  : t("title", { household: invite.householdName })}
              </h1>
              <p className="text-muted-foreground">
                {t("body", { role: tRole(invite.role).toLowerCase() })}
              </p>
            </div>

            {invite.alreadyMember ? (
              <Button asChild className="w-full">
                <Link href="/dashboard">{t("alreadyMember")}</Link>
              </Button>
            ) : status === "authenticated" ? (
              <Button
                className="w-full"
                disabled={accept.isPending}
                onClick={() => accept.mutate({ token })}
              >
                {accept.isPending ? t("joining") : t("join")}
              </Button>
            ) : status === "unauthenticated" ? (
              <div className="space-y-2">
                <Button asChild className="w-full">
                  <Link href={loginHref}>{t("signInToJoin")}</Link>
                </Button>
                {invite.restrictedToEmail && (
                  <p className="text-xs text-muted-foreground">{t("emailRestricted")}</p>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
