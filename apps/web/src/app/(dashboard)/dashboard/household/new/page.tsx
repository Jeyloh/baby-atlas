"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { trpc } from "@/lib/trpc/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NewHouseholdPage() {
  const router = useRouter();
  const t = useTranslations("household");
  const { toast } = useToast();
  const [name, setName] = useState("");

  const createHousehold = trpc.household.create.useMutation({
    onSuccess: (household) => {
      toast({ title: t("new.created") });
      router.push(`/dashboard/${household.id}/child/new`);
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
    if (name.trim()) {
      createHousehold.mutate({ name: name.trim() });
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/dashboard">
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("back")}
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{t("new.title")}</CardTitle>
          <CardDescription>{t("new.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("new.nameLabel")}</Label>
              <Input
                id="name"
                placeholder={t("new.namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={createHousehold.isPending}
            >
              {createHousehold.isPending ? t("new.creating") : t("create")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
