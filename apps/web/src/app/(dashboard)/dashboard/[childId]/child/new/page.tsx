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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const genders = ["MALE", "FEMALE", "OTHER"] as const;

export default function NewChildPage({
  params,
}: {
  params: Promise<{ childId: string }>;
}) {
  const { childId: householdId } = use(params);
  const router = useRouter();
  const t = useTranslations("child");
  const tGender = useTranslations("enums.gender");
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<string>("");

  const createChild = trpc.child.create.useMutation({
    onSuccess: (child) => {
      toast({ title: t("new.added", { name: child.name }) });
      router.push(`/dashboard/${child.id}`);
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
      createChild.mutate({
        householdId,
        name: name.trim(),
        birthDate: new Date(birthDate),
        gender: gender ? (gender as (typeof genders)[number]) : undefined,
      });
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
              <Label htmlFor="name">{t("form.nameLabel")}</Label>
              <Input
                id="name"
                placeholder={t("new.namePlaceholder")}
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
              disabled={createChild.isPending}
            >
              {createChild.isPending ? t("new.adding") : t("new.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
