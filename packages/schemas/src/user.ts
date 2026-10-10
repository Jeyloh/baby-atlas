import { z } from "zod";

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// One-tap actions that can be pinned to the home screen.
// Each one logs (or toggles a timer) without opening a form.
export const quickActionSchema = z.enum([
  "diaperWet",
  "diaperDirty",
  "diaperBoth",
  "sleep",
  "breastLeft",
  "breastRight",
  "bottle",
  "pumping",
]);
export type QuickAction = z.infer<typeof quickActionSchema>;

export const QUICK_ACTIONS = quickActionSchema.options;
export const MAX_PINNED_QUICK_ACTIONS = 4;
export const DEFAULT_QUICK_ACTIONS: QuickAction[] = [
  "diaperWet",
  "diaperDirty",
  "sleep",
  "bottle",
];

export const setQuickActionsSchema = z.object({
  quickActions: z
    .array(quickActionSchema)
    .max(MAX_PINNED_QUICK_ACTIONS)
    .refine((actions) => new Set(actions).size === actions.length, {
      message: "Duplicate quick actions",
    }),
});
export type SetQuickActionsInput = z.infer<typeof setQuickActionsSchema>;

export const deleteUserSchema = z.object({
  confirmEmail: z.string().email(),
});
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
