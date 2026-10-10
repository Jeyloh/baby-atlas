"use client";

import { useState } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { ArrowLeft, Trash2, UserMinus, UserPlus, Crown, Shield, Eye, Users } from "lucide-react";
import type { HouseholdRole } from "@baby-atlas/schemas";

const roleIcons: Record<HouseholdRole, React.ReactNode> = {
  OWNER: <Crown className="h-4 w-4 text-yellow-500" />,
  ADMIN: <Shield className="h-4 w-4 text-blue-500" />,
  CAREGIVER: <Users className="h-4 w-4 text-green-500" />,
  VIEWER: <Eye className="h-4 w-4 text-gray-500" />,
};

const assignableRoles = ["ADMIN", "CAREGIVER", "VIEWER"] as const;

export default function HouseholdSettingsPage() {
  const router = useRouter();
  const t = useTranslations("household");
  const tCommon = useTranslations("common");
  const tRole = useTranslations("enums.householdRole");
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const { data: households, isLoading } = trpc.household.list.useQuery();
  const household = households?.[0]; // Use first household

  const [name, setName] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<HouseholdRole>("CAREGIVER");
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{
    id: string;
    name: string | null;
  } | null>(null);

  // Initialize form when household data loads
  const hasInitialized = useState(false);
  if (household && !hasInitialized[0]) {
    setName(household.name);
    hasInitialized[1](true);
  }

  const showError = (message: string) =>
    toast({
      title: t("errorTitle"),
      description: message,
      variant: "destructive",
    });

  const updateHousehold = trpc.household.update.useMutation({
    onSuccess: () => {
      toast({ title: t("settingsPage.updated") });
      utils.household.list.invalidate();
    },
    onError: (error) => showError(error.message),
  });

  const deleteHousehold = trpc.household.delete.useMutation({
    onSuccess: () => {
      toast({ title: t("danger.deleted") });
      router.push("/dashboard");
    },
    onError: (error) => showError(error.message),
  });

  const inviteMember = trpc.household.invite.useMutation({
    onSuccess: () => {
      toast({ title: t("members.inviteSent") });
      setInviteDialogOpen(false);
      setInviteEmail("");
      setInviteRole("CAREGIVER");
    },
    onError: (error) => showError(error.message),
  });

  const updateMemberRole = trpc.household.updateMemberRole.useMutation({
    onSuccess: () => {
      toast({ title: t("members.roleUpdated") });
      utils.household.list.invalidate();
    },
    onError: (error) => showError(error.message),
  });

  const removeMember = trpc.household.removeMember.useMutation({
    onSuccess: () => {
      toast({ title: t("members.removed") });
      utils.household.list.invalidate();
      setRemoveMemberDialogOpen(false);
      setMemberToRemove(null);
    },
    onError: (error) => showError(error.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (household && name.trim()) {
      updateHousehold.mutate({
        id: household.id,
        name: name.trim(),
      });
    }
  };

  const handleDelete = () => {
    if (household && confirmName === household.name) {
      deleteHousehold.mutate({ id: household.id });
    }
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (household && inviteEmail.trim()) {
      inviteMember.mutate({
        householdId: household.id,
        email: inviteEmail.trim(),
        role: inviteRole,
      });
    }
  };

  const handleRoleChange = (userId: string, role: HouseholdRole) => {
    if (household) {
      updateMemberRole.mutate({
        householdId: household.id,
        userId,
        role,
      });
    }
  };

  const handleRemoveMember = () => {
    if (household && memberToRemove) {
      removeMember.mutate({
        householdId: household.id,
        userId: memberToRemove.id,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">{tCommon("loading")}</div>
      </div>
    );
  }

  if (!household) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-muted-foreground">{t("notFound")}</p>
        <Button asChild>
          <Link href="/dashboard/household/new">{t("create")}</Link>
        </Button>
      </div>
    );
  }

  const isOwner = household.role === "OWNER";
  const isAdmin = household.role === "ADMIN";
  const canManageMembers = isOwner || isAdmin;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/dashboard">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("backToDashboard")}
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{t("settingsPage.title")}</CardTitle>
          <CardDescription>{t("settingsPage.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("settingsPage.nameLabel")}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={!canManageMembers}
              />
            </div>

            {canManageMembers && (
              <Button
                type="submit"
                className="w-full"
                disabled={updateHousehold.isPending}
              >
                {updateHousehold.isPending
                  ? t("settingsPage.saving")
                  : t("settingsPage.saveChanges")}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{t("members.title")}</CardTitle>
            <CardDescription>
              {t("members.count", { count: household.members.length })}
            </CardDescription>
          </div>
          {canManageMembers && (
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="mr-2 h-4 w-4" />
                  {t("members.invite")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleInvite}>
                  <DialogHeader>
                    <DialogTitle>{t("members.inviteTitle")}</DialogTitle>
                    <DialogDescription>
                      {t("members.inviteDescription")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="inviteEmail">{t("members.emailLabel")}</Label>
                      <Input
                        id="inviteEmail"
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder={t("members.emailPlaceholder")}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inviteRole">{t("members.roleLabel")}</Label>
                      <Select
                        value={inviteRole}
                        onValueChange={(v) => setInviteRole(v as HouseholdRole)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {assignableRoles.map((role) => (
                            <SelectItem key={role} value={role}>
                              {tRole(role)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setInviteDialogOpen(false)}
                    >
                      {tCommon("cancel")}
                    </Button>
                    <Button type="submit" disabled={inviteMember.isPending}>
                      {inviteMember.isPending
                        ? t("members.sending")
                        : t("members.sendInvite")}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {household.members.map((member) => (
              <div
                key={member.user.id}
                className="flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.user.image || undefined} />
                    <AvatarFallback>
                      {member.user.name?.charAt(0) ||
                        member.user.email?.charAt(0) ||
                        "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {member.user.name || member.user.email}
                      </span>
                      {roleIcons[member.role as HouseholdRole]}
                    </div>
                    {member.user.name && (
                      <span className="text-sm text-muted-foreground">
                        {member.user.email}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isOwner && member.role !== "OWNER" && (
                    <Select
                      value={member.role}
                      onValueChange={(v) =>
                        handleRoleChange(member.user.id, v as HouseholdRole)
                      }
                    >
                      <SelectTrigger className="w-40" aria-label={t("members.roleLabel")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {assignableRoles.map((role) => (
                          <SelectItem key={role} value={role}>
                            {tRole(role)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {member.role === "OWNER" && (
                    <span className="text-sm text-muted-foreground px-3">
                      {tRole("OWNER")}
                    </span>
                  )}
                  {canManageMembers && member.role !== "OWNER" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("members.removeAria")}
                      onClick={() => {
                        setMemberToRemove({
                          id: member.user.id,
                          name: member.user.name,
                        });
                        setRemoveMemberDialogOpen(true);
                      }}
                    >
                      <UserMinus className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={removeMemberDialogOpen}
        onOpenChange={setRemoveMemberDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("members.removeTitle")}</DialogTitle>
            <DialogDescription>
              {t("members.removeConfirm", {
                name: memberToRemove?.name || t("members.thisMember"),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveMemberDialogOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveMember}
              disabled={removeMember.isPending}
            >
              {removeMember.isPending ? t("members.removing") : t("members.remove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isOwner && (
        <>
          <Separator />
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">{t("danger.title")}</CardTitle>
              <CardDescription>{t("danger.description")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Dialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="destructive" className="w-full">
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("danger.deleteHousehold")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {t("danger.dialogTitle", { name: household.name })}
                    </DialogTitle>
                    <DialogDescription>
                      {t("danger.dialogDescription")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-2">
                    <Label htmlFor="confirmHouseholdName">
                      {t("danger.confirmLabel", { name: household.name })}
                    </Label>
                    <Input
                      id="confirmHouseholdName"
                      value={confirmName}
                      onChange={(e) => setConfirmName(e.target.value)}
                      placeholder={household.name}
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
                        confirmName !== household.name ||
                        deleteHousehold.isPending
                      }
                    >
                      {deleteHousehold.isPending
                        ? t("danger.deleting")
                        : tCommon("delete")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
