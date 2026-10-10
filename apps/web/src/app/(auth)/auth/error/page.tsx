"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Suspense } from "react";

const knownErrors = ["Configuration", "AccessDenied", "Verification"] as const;
type KnownError = (typeof knownErrors)[number];

function isKnownError(error: string | null): error is KnownError {
  return knownErrors.includes(error as KnownError);
}

function AuthErrorContent() {
  const t = useTranslations("auth.error");
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessage = isKnownError(error)
    ? t(`messages.${error}`)
    : t("messages.Default");

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-destructive">{t("title")}</CardTitle>
        <CardDescription>{errorMessage}</CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Button asChild>
          <Link href="/login">{t("tryAgain")}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function LoadingFallback() {
  const t = useTranslations("common");
  return <div>{t("loading")}</div>;
}

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Suspense fallback={<LoadingFallback />}>
        <AuthErrorContent />
      </Suspense>
    </div>
  );
}
