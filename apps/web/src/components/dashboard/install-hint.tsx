"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Share, X } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";
import { detectInstallHint, type InstallHint as Hint } from "@/lib/pwa/install-platform";

const DISMISSED_KEY = "baby-atlas-install-hint-dismissed";

/** Shows iPhone and iPad users how to add the app to the home screen. */
export function InstallHint() {
  const t = useTranslations("dashboard.install");
  const tCommon = useTranslations("common");
  // Detected after mount: the server cannot know the browser
  const [hint, setHint] = useState<Hint>(null);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;
    setHint(detectInstallHint());
  }, []);

  if (!hint) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
    setHint(null);
  };

  return (
    <aside
      aria-labelledby="install-hint-title"
      className="mb-5 flex items-start gap-3 rounded-2xl border bg-card p-4 text-card-foreground"
    >
      <BrandMark className="h-10 w-10 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        <h2 id="install-hint-title" className="font-semibold leading-tight">
          {t(`${hint}.title`)}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t.rich(`${hint}.body`, {
            share: () => (
              <Share className="mx-0.5 inline h-4 w-4 align-text-bottom text-foreground" aria-label={t("shareButton")} />
            ),
            strong: (chunks) => <strong className="font-semibold text-foreground">{chunks}</strong>,
          })}
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={tCommon("close")}
        className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-5 w-5" />
      </button>
    </aside>
  );
}
