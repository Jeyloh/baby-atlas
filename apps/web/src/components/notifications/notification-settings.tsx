"use client";

import { useLocale, useTranslations } from "next-intl";
import { Bell, BellOff, Share } from "lucide-react";
import { useState } from "react";
import {
  DEFAULT_QUIET_END,
  DEFAULT_QUIET_START,
  NOTIFICATION_KINDS,
  TIMER_THRESHOLD_KEYS,
  type NotificationKind,
  type TimerThresholds,
  type UpdateNotificationSettingsInput,
} from "@baby-atlas/schemas";
import {
  DEFAULT_TIMER_THRESHOLD_MINUTES,
  formatMinutesOfDay,
  parseMinutesOfDay,
} from "@baby-atlas/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { usePushSubscription, type TestResult } from "@/hooks/use-push-subscription";
import { toLocale } from "@/i18n/config";
import { trpc } from "@/lib/trpc/provider";

function CheckRow({
  id,
  checked,
  disabled,
  onChange,
  label,
  description,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-primary"
      />
      <Label htmlFor={id} className="flex-1 space-y-0.5 font-normal leading-snug">
        <span className="block font-medium">{label}</span>
        {description && (
          <span className="block text-sm text-muted-foreground">{description}</span>
        )}
      </Label>
    </div>
  );
}

const MAX_THRESHOLD_MINUTES = 24 * 60;

/** "90" -> 90, "" -> undefined (use the default), anything else -> null (invalid). */
function parseThreshold(text: string): number | undefined | null {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  if (!/^\d+$/.test(trimmed)) return null;
  const minutes = Number(trimmed);
  return minutes >= 1 && minutes <= MAX_THRESHOLD_MINUTES ? minutes : null;
}

/**
 * Per timer type: how many minutes before a timer counts as forgotten. Saved
 * when a field loses focus. Mounted once with the saved values, so a refetch
 * does not overwrite what is being typed.
 */
function TimerThresholdFields({
  thresholds,
  onSave,
}: {
  thresholds: TimerThresholds;
  onSave: (next: TimerThresholds) => void;
}) {
  const t = useTranslations("notifications.settings.timerThresholds");
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(TIMER_THRESHOLD_KEYS.map((key) => [key, String(thresholds[key] ?? "")]))
  );

  const commit = (next: Record<string, string>) => {
    const result: TimerThresholds = {};
    for (const key of TIMER_THRESHOLD_KEYS) {
      const minutes = parseThreshold(next[key] ?? "");
      if (minutes === null) return; // the field shows the error, nothing is saved
      if (minutes !== undefined) result[key] = minutes;
    }
    onSave(result);
  };

  return (
    <details className="rounded-lg border">
      <summary className="cursor-pointer select-none px-3 py-3 text-sm font-medium">
        {t("summary")}
      </summary>
      <div className="space-y-3 border-t px-3 py-3">
        <p className="text-sm text-muted-foreground">{t("description")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {TIMER_THRESHOLD_KEYS.map((key) => {
            const invalid = parseThreshold(drafts[key] ?? "") === null;
            const inputId = `notification-threshold-${key}`;
            return (
              <div key={key} className="space-y-1">
                <Label htmlFor={inputId}>
                  {t(`types.${key}`)} ({t("unit")})
                </Label>
                <Input
                  id={inputId}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_THRESHOLD_MINUTES}
                  step={1}
                  value={drafts[key] ?? ""}
                  placeholder={String(DEFAULT_TIMER_THRESHOLD_MINUTES[key])}
                  aria-invalid={invalid}
                  aria-describedby={`${inputId}-hint`}
                  onChange={(event) => setDrafts({ ...drafts, [key]: event.target.value })}
                  onBlur={() => commit(drafts)}
                />
                <p
                  id={`${inputId}-hint`}
                  className={invalid ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
                >
                  {invalid
                    ? t("invalid")
                    : t("default", { minutes: DEFAULT_TIMER_THRESHOLD_MINUTES[key] })}
                </p>
              </div>
            );
          })}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setDrafts({});
            onSave({});
          }}
        >
          {t("reset")}
        </Button>
      </div>
    </details>
  );
}

const TEST_TOAST = {
  sent: "toast.testSent",
  noSubscription: "toast.testNoSubscription",
  unavailable: "toast.testUnavailable",
  failed: "toast.testFailed",
} as const satisfies Record<TestResult, string>;

/** The "Varsler" section of the profile settings page. */
export function NotificationSettings() {
  const t = useTranslations("notifications.settings");
  const tInstall = useTranslations("dashboard.install");
  const tCommon = useTranslations("common");
  const locale = toLocale(useLocale());
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const push = usePushSubscription();
  const settingsQuery = trpc.notifications.getSettings.useQuery();
  const householdsQuery = trpc.household.list.useQuery();
  const settings = settingsQuery.data;
  const children = (householdsQuery.data ?? []).flatMap((household) => household.children);

  const update = trpc.notifications.updateSettings.useMutation({
    onMutate: async (input) => {
      await utils.notifications.getSettings.cancel();
      const previous = utils.notifications.getSettings.getData();
      utils.notifications.getSettings.setData(undefined, (current) =>
        current ? { ...current, ...definedOnly(input) } : current
      );
      return { previous };
    },
    onError: (_error, _input, context) => {
      utils.notifications.getSettings.setData(undefined, context?.previous);
      toast({ title: t("toast.saveFailed"), variant: "destructive" });
    },
    onSettled: () => utils.notifications.getSettings.invalidate(),
  });

  // The locale is saved with every change so push texts match the app language
  const save = (input: UpdateNotificationSettingsInput) => update.mutate({ ...input, locale });

  const toggleKind = (kind: NotificationKind, on: boolean) => {
    if (!settings) return;
    const kinds = settings.enabledKinds.filter((k) => k !== kind);
    save({ enabledKinds: on ? [...kinds, kind] : kinds });
  };

  const toggleMuted = (childId: string, muted: boolean) => {
    if (!settings) return;
    const ids = settings.mutedChildIds.filter((id) => id !== childId);
    save({ mutedChildIds: muted ? [...ids, childId] : ids });
  };

  const quietOn = settings ? settings.quietStart !== null && settings.quietEnd !== null : false;

  const setQuietTime = (field: "quietStart" | "quietEnd", value: string) => {
    const minutes = parseMinutesOfDay(value);
    if (minutes !== null) save({ [field]: minutes });
  };

  const handleEnable = async () => {
    try {
      const ok = await push.subscribe();
      if (ok) toast({ title: t("toast.enabled") });
    } catch {
      toast({ title: t("toast.enableFailed"), variant: "destructive" });
    }
  };

  const handleDisable = async () => {
    try {
      await push.unsubscribe();
      toast({ title: t("toast.disabled") });
    } catch {
      toast({ title: t("toast.saveFailed"), variant: "destructive" });
    }
  };

  const handleTest = async () => {
    const result = await push.sendTest();
    toast({
      title: t(TEST_TOAST[result]),
      variant: result === "sent" ? "default" : "destructive",
    });
  };

  const blocked = ["unsupported", "noWorker", "notConfigured", "denied"].includes(push.state);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" aria-hidden />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3">
          <p className="text-sm" role="status">
            {t(`status.${push.state}`)}
          </p>

          {push.state === "iosNeedsInstall" && push.installHint && (
            <p className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
              {tInstall.rich(`${push.installHint}.body`, {
                share: () => (
                  <Share
                    className="mx-0.5 inline h-4 w-4 align-text-bottom text-foreground"
                    aria-label={tInstall("shareButton")}
                  />
                ),
                strong: (chunks) => (
                  <strong className="font-semibold text-foreground">{chunks}</strong>
                ),
              })}
            </p>
          )}

          {push.state === "off" && (
            <Button type="button" className="w-full" onClick={handleEnable} disabled={push.busy}>
              <Bell className="mr-2 h-4 w-4" aria-hidden />
              {push.busy ? t("actions.working") : t("actions.enable")}
            </Button>
          )}

          {push.state === "on" && (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" onClick={handleTest} disabled={push.busy}>
                {t("actions.test")}
              </Button>
              <Button type="button" variant="outline" onClick={handleDisable} disabled={push.busy}>
                <BellOff className="mr-2 h-4 w-4" aria-hidden />
                {t("actions.disable")}
              </Button>
            </div>
          )}
        </div>

        {!blocked && settings && (
          <>
            <Separator />

            <fieldset className="space-y-4">
              <legend className="mb-3 font-semibold">{t("kinds.title")}</legend>
              {NOTIFICATION_KINDS.map((kind) => (
                <CheckRow
                  key={kind}
                  id={`notification-kind-${kind}`}
                  checked={settings.enabledKinds.includes(kind)}
                  onChange={(on) => toggleKind(kind, on)}
                  label={t(`kinds.${kind}.label`)}
                  description={t(`kinds.${kind}.description`)}
                />
              ))}
            </fieldset>

            <Separator />

            <div className="space-y-3">
              <div>
                <h3 className="font-semibold">{t("quiet.title")}</h3>
                <p className="text-sm text-muted-foreground">{t("quiet.description")}</p>
              </div>
              <CheckRow
                id="notification-quiet-toggle"
                checked={quietOn}
                onChange={(on) =>
                  save(
                    on
                      ? { quietStart: DEFAULT_QUIET_START, quietEnd: DEFAULT_QUIET_END }
                      : { quietStart: null, quietEnd: null }
                  )
                }
                label={t("quiet.toggle")}
              />
              {quietOn && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="notification-quiet-start">{t("quiet.from")}</Label>
                    <Input
                      id="notification-quiet-start"
                      type="time"
                      value={formatMinutesOfDay(settings.quietStart ?? DEFAULT_QUIET_START)}
                      onChange={(event) => setQuietTime("quietStart", event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="notification-quiet-end">{t("quiet.to")}</Label>
                    <Input
                      id="notification-quiet-end"
                      type="time"
                      value={formatMinutesOfDay(settings.quietEnd ?? DEFAULT_QUIET_END)}
                      onChange={(event) => setQuietTime("quietEnd", event.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <fieldset className="space-y-3">
              <legend className="font-semibold">{t("mute.title")}</legend>
              <p className="text-sm text-muted-foreground">{t("mute.description")}</p>
              {children.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("mute.none")}</p>
              ) : (
                children.map((child) => (
                  <CheckRow
                    key={child.id}
                    id={`notification-mute-${child.id}`}
                    checked={settings.mutedChildIds.includes(child.id)}
                    onChange={(muted) => toggleMuted(child.id, muted)}
                    label={child.name}
                  />
                ))
              )}
            </fieldset>
          </>
        )}

        {settings && (
          <>
            <Separator />
            <TimerThresholdFields
              thresholds={settings.timerThresholds}
              onSave={(timerThresholds) => save({ timerThresholds })}
            />
          </>
        )}

        {!settings && settingsQuery.isLoading && (
          <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
        )}
      </CardContent>
    </Card>
  );
}

function definedOnly<T extends object>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}
