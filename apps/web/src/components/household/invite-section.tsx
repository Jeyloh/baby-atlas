"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Check, Copy, Link2, Share2, Trash2, UserPlus } from "lucide-react";
import type { HouseholdRole } from "@baby-atlas/schemas";
import { trpc } from "@/lib/trpc/provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const INVITABLE_ROLES = ["CAREGIVER", "ADMIN", "VIEWER"] as const;

function inviteUrl(token: string) {
  return `${window.location.origin}/invite/${token}`;
}

/**
 * Invite people by link: the owner or an admin creates a single-use link and
 * sends it however they like (SMS, Messenger) through the share sheet.
 */
export function InviteSection({
  householdId,
  householdName,
  autoOpen,
}: {
  householdId: string;
  householdName: string;
  autoOpen?: boolean;
}) {
  const t = useTranslations("household.invites");
  const tRole = useTranslations("enums.householdRole");
  const format = useFormatter();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<(typeof INVITABLE_ROLES)[number]>("CAREGIVER");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
    if (autoOpen) setOpen(true);
  }, [autoOpen]);

  const { data: invites } = trpc.household.listInvites.useQuery({ householdId });

  const create = trpc.household.invite.useMutation({
    onSuccess: (invite) => {
      setLink(inviteUrl(invite.token));
      void utils.household.listInvites.invalidate({ householdId });
    },
    onError: (err) => toast({ title: t("failed"), description: err.message, variant: "destructive" }),
  });

  const revoke = trpc.household.revokeInvite.useMutation({
    onSuccess: () => {
      toast({ title: t("revoked") });
      void utils.household.listInvites.invalidate({ householdId });
    },
  });

  const copy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async (url: string) => {
    try {
      await navigator.share({ title: t("shareTitle"), text: t("shareText", { household: householdName }), url });
    } catch {
      // The user closed the share sheet
    }
  };

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setLink(null);
      setRole("CAREGIVER");
    }
  };

  return (
    <div className="space-y-3">
      <Button className="w-full" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" />
        {t("invite")}
      </Button>

      {invites && invites.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("pending")}</p>
          <ul className="divide-y rounded-lg border">
            {invites.map((invite) => (
              <li key={invite.id} className="flex items-center gap-2 py-2 pl-3 pr-1">
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{invite.email ?? t("anyoneWithLink")}</p>
                  <p className="text-xs text-muted-foreground">
                    {tRole(invite.role)}
                    {", "}
                    {t("expires", { date: format.dateTime(invite.expiresAt, { day: "numeric", month: "short" }) })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("copy")}
                  onClick={() => copy(inviteUrl(invite.token))}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("revoke")}
                  onClick={() => revoke.mutate({ householdId, inviteId: invite.id })}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={open} onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          {!link ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("roleLabel")}</Label>
                <div role="radiogroup" className="grid gap-2">
                  {INVITABLE_ROLES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={role === value}
                      onClick={() => setRole(value)}
                      className={cn(
                        "flex min-h-14 flex-col items-start justify-center rounded-lg border px-4 py-2 text-left transition-colors",
                        role === value ? "border-primary bg-primary/10" : "hover:bg-muted"
                      )}
                    >
                      <span className="text-sm font-medium">{tRole(value as HouseholdRole)}</span>
                      <span className="text-xs text-muted-foreground">{t(`roleHelp.${value}`)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <Button
                className="w-full"
                disabled={create.isPending}
                onClick={() => create.mutate({ householdId, role })}
              >
                {create.isPending ? t("creating") : t("create")}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="break-all rounded-lg border bg-muted px-3 py-2.5 text-sm">{link}</div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => copy(link)}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? t("copied") : t("copy")}
                </Button>
                {canShare ? (
                  <Button onClick={() => share(link)}>
                    <Share2 className="h-4 w-4" />
                    {t("share")}
                  </Button>
                ) : (
                  <Button onClick={() => close(false)}>{t("done")}</Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t("linkHelp")}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
