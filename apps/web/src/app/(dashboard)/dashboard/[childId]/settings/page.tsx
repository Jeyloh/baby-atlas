"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";

const genders = ["MALE", "FEMALE", "OTHER"] as const;

export default function ChildSettingsPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId } = use(params);
  const router = useRouter();
  const t = useTranslations("child");
  const tCommon = useTranslations("common");
  const tGender = useTranslations("enums.gender");
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: child, isLoading } = trpc.child.get.useQuery({ id: childId });

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<string>("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");

  // Initialize form when child data loads
  const hasInitialized = useState(false);
  if (child && !hasInitialized[0]) {
    setName(child.name);
    setBirthDate(new Date(child.birthDate).toISOString().split("T")[0]);
    setGender(child.gender || "");
    hasInitialized[1](true);
  }

  const updateChild = trpc.child.update.useMutation({
    onSuccess: () => {
      toast({ title: t("settingsPage.updated") });
      utils.child.get.invalidate({ id: childId });
    },
    onError: (error) => {
      toast({
        title: t("errorTitle"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteChild = trpc.child.delete.useMutation({
    onSuccess: () => {
      toast({ title: t("danger.deleted") });
      router.push("/dashboard");
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
    if (name.trim() && birthDate) {
      updateChild.mutate({
        id: childId,
        name: name.trim(),
        birthDate: new Date(birthDate),
        gender: gender ? (gender as (typeof genders)[number]) : null,
      });
    }
  };

  const handleDelete = () => {
    if (confirmName === child?.name) {
      deleteChild.mutate({ id: childId });
    }
  };

  if (isLoading) {
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
    <div className="max-w-md mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/dashboard/${childId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("settingsPage.backTo", { name: child.name })}
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{t("settingsPage.title")}</CardTitle>
          <CardDescription>
            {t("settingsPage.description", { name: child.name })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("form.nameLabel")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthDate">{t("form.birthDateLabel")}</Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">{t("form.genderLabel")}</Label>
              <Select value={gender} onValueChange={setGender}>
                <SelectTrigger>
                  <SelectValue placeholder={t("form.genderPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {genders.map((g) => (
                    <SelectItem key={g} value={g}>
                      {tGender(g)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={updateChild.isPending}
            >
              {updateChild.isPending
                ? t("settingsPage.saving")
                : t("settingsPage.saveChanges")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">{t("danger.title")}</CardTitle>
          <CardDescription>{t("danger.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <Trash2 className="mr-2 h-4 w-4" />
                {t("danger.deleteChild")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("danger.dialogTitle", { name: child.name })}</DialogTitle>
                <DialogDescription>
                  {t("danger.dialogDescription", { name: child.name })}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="confirmName">
                  {t("danger.confirmLabel", { name: child.name })}
                </Label>
                <Input
                  id="confirmName"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                  placeholder={child.name}
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
                  disabled={
                    confirmName !== child.name || deleteChild.isPending
                  }
                >
                  {deleteChild.isPending ? t("danger.deleting") : tCommon("delete")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
