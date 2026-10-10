"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles } from "lucide-react";
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
import { UpgradeCard } from "./upgrade-card";
import { readInsightsStream } from "./read-insights-stream";

type Status = "idle" | "loading" | "done" | "premium_required" | "error";

export function InsightsPanel({
  childId,
  childName,
}: {
  childId: string;
  childName: string;
}) {
  const t = useTranslations("insights.panel");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorKey, setErrorKey] = useState<
    "errorGeneric" | "errorRefused" | "errorNotConfigured"
  >("errorGeneric");
  const abortRef = useRef<AbortController | null>(null);

  async function requestInsights() {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setAnswer("");

    try {
      const response = await fetch("/api/ai/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          childId,
          question: question.trim() || undefined,
        }),
        signal: controller.signal,
      });

      if (response.status === 402) {
        setStatus("premium_required");
        return;
      }
      if (!response.ok || !response.body) {
        setErrorKey(
          response.status === 503 ? "errorNotConfigured" : "errorGeneric"
        );
        setStatus("error");
        return;
      }

      const failure = await readInsightsStream(response.body, (text) =>
        setAnswer((prev) => prev + text)
      );
      if (failure) {
        setErrorKey(failure === "refused" ? "errorRefused" : "errorGeneric");
        setStatus("error");
        return;
      }
      setStatus("done");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setErrorKey("errorGeneric");
      setStatus("error");
    }
  }

  if (status === "premium_required") {
    return <UpgradeCard />;
  }

  const isLoading = status === "loading";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void requestInsights();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="insights-question">{t("questionLabel")}</Label>
            <Input
              id="insights-question"
              value={question}
              maxLength={500}
              disabled={isLoading}
              placeholder={t("questionPlaceholder", { name: childName })}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? t("loading") : t("submit")}
          </Button>
        </form>

        {status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {t(errorKey)}
          </p>
        )}

        {answer && (
          <div className="prose prose-sm dark:prose-invert max-w-none prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-headings:text-foreground">
            <Markdown remarkPlugins={[remarkGfm]}>{answer}</Markdown>
          </div>
        )}

        <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
      </CardContent>
    </Card>
  );
}
