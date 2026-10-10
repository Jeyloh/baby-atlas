"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Pencil, Trash2 } from "lucide-react";
import type { SpeechCategory } from "@baby-atlas/schemas";
import { trpc } from "@/lib/trpc/provider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryToggle } from "./category-toggle";
import { ConfirmDialog } from "./confirm-dialog";
import { fromDateInputValue, toDateInputValue, todayInputValue } from "./date-input";
import type { SpeechWordLike } from "./speech-utils";
import { useErrorToast } from "./use-error-toast";

export interface SpeechWordItem extends SpeechWordLike {
  notes: string | null;
}

interface SpeechWordListProps {
  childId: string;
  words: SpeechWordItem[];
}

export function SpeechWordList({ childId, words }: SpeechWordListProps) {
  const t = useTranslations("speech");
  const format = useFormatter();
  const { toast } = useToast();
  const onError = useErrorToast(t("errorTitle"));
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState<SpeechWordItem | null>(null);
  const [deleting, setDeleting] = useState<SpeechWordItem | null>(null);

  const remove = trpc.speech.delete.useMutation({
    onSuccess: () => {
      utils.speech.list.invalidate({ childId });
      toast({ title: t("delete.deleted") });
      setDeleting(null);
    },
    onError,
  });

  return (
    <>
      <ul className="grid gap-2 sm:grid-cols-2">
        {words.map((word) => (
          <li key={word.id} className="flex items-center gap-1 rounded-xl border bg-card py-1 pl-4 pr-1">
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-medium">{word.word}</p>
              <p className="truncate text-xs text-muted-foreground">
                {t(`categories.${word.category}`)}
                {" · "}
                {t("firstSaid", {
                  date: format.dateTime(word.firstSaidAt, { dateStyle: "medium", timeZone: "UTC" }),
                })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-lg"
              className="h-12 w-12"
              aria-label={`${t("edit.title")}: ${word.word}`}
              onClick={() => setEditing(word)}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon-lg"
              className="h-12 w-12 text-destructive"
              aria-label={`${t("delete.title", { word: word.word })}`}
              onClick={() => setDeleting(word)}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>

      {editing && (
        <EditWordDialog
          key={editing.id}
          childId={childId}
          word={editing}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={t("delete.title", { word: deleting?.word ?? "" })}
        description={t("delete.description")}
        pending={remove.isPending}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={() => deleting && remove.mutate({ id: deleting.id })}
      />
    </>
  );
}

function EditWordDialog({
  childId,
  word,
  onClose,
}: {
  childId: string;
  word: SpeechWordItem;
  onClose: () => void;
}) {
  const t = useTranslations("speech");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const onError = useErrorToast(t("errorTitle"));
  const utils = trpc.useUtils();
  const [text, setText] = useState(word.word);
  const [category, setCategory] = useState<SpeechCategory>(word.category);
  const [date, setDate] = useState(toDateInputValue(word.firstSaidAt));
  const [notes, setNotes] = useState(word.notes ?? "");

  const update = trpc.speech.update.useMutation({
    onSuccess: () => {
      utils.speech.list.invalidate({ childId });
      toast({ title: t("edit.saved") });
      onClose();
    },
    onError,
  });

  const canSave = text.trim().length > 0 && date.length > 0 && !update.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("edit.title")}</DialogTitle>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSave) return;
            update.mutate({
              id: word.id,
              word: text.trim(),
              category,
              firstSaidAt: fromDateInputValue(date),
              notes: notes.trim() || null,
            });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="edit-word">{t("edit.word")}</Label>
            <Input
              id="edit-word"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={100}
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("edit.category")}</Label>
            <CategoryToggle value={category} onChange={setCategory} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-date">{t("edit.date")}</Label>
            <Input
              id="edit-date"
              type="date"
              value={date}
              max={todayInputValue()}
              onChange={(e) => setDate(e.target.value)}
              className="h-12"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">{t("edit.notes")}</Label>
            <Input
              id="edit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              className="h-12"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" className="min-h-12" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button type="submit" className="min-h-12" disabled={!canSave}>
              {tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
