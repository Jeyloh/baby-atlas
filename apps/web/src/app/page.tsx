import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const t = await getTranslations("auth.landing");
  const tCommon = await getTranslations("common");

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-background">
      <div className="container mx-auto px-4 py-16">
        <div className="flex flex-col items-center justify-center text-center space-y-8">
          <h1 className="text-5xl font-bold tracking-tight">
            {t("titlePrefix")} <span className="text-primary">{tCommon("appName")}</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl">{t("description")}</p>
          <div className="flex gap-4">
            <Button asChild size="lg">
              <Link href="/login">{t("getStarted")}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">{t("signIn")}</Link>
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 max-w-4xl">
            <FeatureCard
              title={t("features.sleep.title")}
              description={t("features.sleep.description")}
            />
            <FeatureCard
              title={t("features.feeding.title")}
              description={t("features.feeding.description")}
            />
            <FeatureCard
              title={t("features.caregivers.title")}
              description={t("features.caregivers.description")}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="p-6 rounded-xl border bg-card">
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
