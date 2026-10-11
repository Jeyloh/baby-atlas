"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useSignOut } from "@/hooks/use-sign-out";
import { setLocale } from "@/i18n/actions";
import { locales, type Locale } from "@/i18n/config";
import { trpc } from "@/lib/trpc/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { ArrowLeft, LogOut, Trash2 } from "lucide-react";

export default function ProfileSettingsPage() {
  const router = useRouter();
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const currentLocale = useLocale();
  const [isSwitchingLocale, startLocaleTransition] = useTransition();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const signOut = useSignOut();

  const { data: user, isLoading } = trpc.user.get.useQuery();

  const [name, setName] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

  // Initialize form when user data loads
  const hasInitialized = useState(false);
  if (user && !hasInitialized[0]) {
    setName(user.name || "");
    hasInitialized[1](true);
  }

  const handleLocaleChange = (next: Locale) => {
    if (next === currentLocale) return;
    startLocaleTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  };

  const updateUser = trpc.user.update.useMutation({
    onSuccess: () => {
      toast({ title: t("profile.updated") });
      utils.user.get.invalidate();
    },
    onError: (error) => {
      toast({
        title: t("errorTitle"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUser = trpc.user.delete.useMutation({
    onSuccess: () => {
      toast({ title: t("profile.danger.deleted") });
      signOut();
    },
    onError: (error) => {
      toast({
        title: t("errorTitle"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateUser.mutate({ name: name.trim() || undefined });
  };

  const handleDelete = () => {
    if (confirmEmail === user?.email) {
      deleteUser.mutate({ confirmEmail });
    }
  };

  const handleSignOut = signOut;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">{tCommon("loading")}</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-muted-foreground">{t("profile.notFound")}</p>
        <Button asChild>
          <Link href="/dashboard">{t("profile.backToDashboard")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/dashboard">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("profile.backToDashboard")}
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.image || undefined} />
              <AvatarFallback className="text-lg">
                {user.name?.charAt(0) || user.email?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle>{t("profile.title")}</CardTitle>
              <CardDescription>{user.email}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("profile.displayName")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("profile.namePlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t("profile.email")}</Label>
              <Input id="email" value={user.email || ""} disabled />
              <p className="text-xs text-muted-foreground">
                {t("profile.emailLocked")}
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={updateUser.isPending}
            >
              {updateUser.isPending ? t("profile.saving") : t("profile.saveChanges")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.language.title")}</CardTitle>
          <CardDescription>{t("profile.language.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="radiogroup"
            aria-label={t("profile.language.label")}
            className="grid grid-cols-2 gap-2"
          >
            {locales.map((locale) => (
              <Button
                key={locale}
                type="button"
                role="radio"
                aria-checked={locale === currentLocale}
                variant={locale === currentLocale ? "default" : "outline"}
                className="min-h-12"
                disabled={isSwitchingLocale}
                onClick={() => handleLocaleChange(locale)}
              >
                {tCommon(`languages.${locale}`)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile.session.title")}</CardTitle>
          <CardDescription>{t("profile.session.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleSignOut}
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t("profile.session.signOut")}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">{t("profile.danger.title")}</CardTitle>
          <CardDescription>{t("profile.danger.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Trash2 className="mr-2 h-4 w-4" />
                {t("profile.danger.deleteAccount")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("profile.danger.dialogTitle")}</DialogTitle>
                <DialogDescription>
                  {t("profile.danger.dialogDescription")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="confirmEmail">
                  {t("profile.danger.confirmLabel", { email: user.email ?? "" })}
                </Label>
                <Input
                  id="confirmEmail"
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder={user.email || ""}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                >
                  {tCommon("cancel")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={confirmEmail !== user.email || deleteUser.isPending}
                >
                  {deleteUser.isPending
                    ? t("profile.danger.deleting")
                    : t("profile.danger.deleteAccount")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
