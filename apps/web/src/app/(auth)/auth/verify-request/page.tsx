import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function VerifyRequestPage() {
  const t = await getTranslations("auth.verifyRequest");

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">{t("hint")}</p>
          <Button asChild variant="outline">
            <Link href="/login">{t("backToLogin")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
