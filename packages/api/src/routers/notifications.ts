import {
  DEFAULT_ENABLED_KINDS,
  DEFAULT_QUIET_END,
  DEFAULT_QUIET_START,
  subscribePushSchema,
  timerThresholdsSchema,
  unsubscribePushSchema,
  updateNotificationSettingsSchema,
  type NotificationKind,
  type NotificationLocale,
  type TimerThresholds,
} from "@baby-atlas/schemas";
import { z } from "zod";
import { storePushSubscription } from "../push-subscriptions";
import { createTRPCRouter, protectedProcedure } from "../trpc";

function parseThresholds(value: unknown): TimerThresholds {
  const parsed = timerThresholdsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

function parseLocale(value: string): NotificationLocale {
  return value === "en" ? "en" : "nb";
}

export const notificationsRouter = createTRPCRouter({
  /** The caller's settings, or the defaults while nothing is saved yet. */
  getSettings: protectedProcedure.query(async ({ ctx }) => {
    const settings = await ctx.prisma.notificationSettings.findUnique({
      where: { userId: ctx.session.user.id },
    });

    if (!settings) {
      return {
        enabledKinds: DEFAULT_ENABLED_KINDS as NotificationKind[],
        mutedChildIds: [] as string[],
        quietStart: DEFAULT_QUIET_START as number | null,
        quietEnd: DEFAULT_QUIET_END as number | null,
        timerThresholds: {} as TimerThresholds,
        locale: "nb" as NotificationLocale,
      };
    }

    return {
      enabledKinds: settings.enabledKinds as NotificationKind[],
      mutedChildIds: settings.mutedChildIds,
      quietStart: settings.quietStart,
      quietEnd: settings.quietEnd,
      timerThresholds: parseThresholds(settings.timerThresholds),
      locale: parseLocale(settings.locale),
    };
  }),

  updateSettings: protectedProcedure
    .input(updateNotificationSettingsSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // Only children the user can see can be muted. Others (a child that was
      // deleted, or a household the user left) are dropped without an error.
      let mutedChildIds: string[] | undefined;
      if (input.mutedChildIds) {
        const ids = [...new Set(input.mutedChildIds)];
        const accessible = ids.length
          ? await ctx.prisma.child.findMany({
              where: { id: { in: ids }, household: { members: { some: { userId } } } },
              select: { id: true },
            })
          : [];
        const allowed = new Set(accessible.map((child) => child.id));
        mutedChildIds = ids.filter((id) => allowed.has(id));
      }

      const data = {
        ...(input.enabledKinds !== undefined && { enabledKinds: input.enabledKinds }),
        ...(mutedChildIds !== undefined && { mutedChildIds }),
        ...(input.quietStart !== undefined && { quietStart: input.quietStart }),
        ...(input.quietEnd !== undefined && { quietEnd: input.quietEnd }),
        ...(input.timerThresholds !== undefined && { timerThresholds: input.timerThresholds }),
        ...(input.locale !== undefined && { locale: input.locale }),
      };

      await ctx.prisma.notificationSettings.upsert({
        where: { userId },
        create: { userId, ...data },
        update: data,
      });

      return { success: true };
    }),

  /** Stores (or moves to this user) the browser's push subscription. */
  subscribe: protectedProcedure
    .input(subscribePushSchema)
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      // A browser profile that signs in as someone else keeps one endpoint:
      // it now belongs to the new user.
      await storePushSubscription(ctx.prisma, userId, input);

      if (input.locale) {
        await ctx.prisma.notificationSettings.upsert({
          where: { userId },
          create: { userId, locale: input.locale },
          update: { locale: input.locale },
        });
      }

      return { success: true };
    }),

  unsubscribe: protectedProcedure
    .input(unsubscribePushSchema)
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.prisma.pushSubscription.deleteMany({
        where: { endpoint: input.endpoint, userId: ctx.session.user.id },
      });
      return { removed: result.count };
    }),

  /** Whether the user has any subscription, and whether this device does. */
  status: protectedProcedure
    .input(z.object({ endpoint: z.string().url().max(2048).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const count = await ctx.prisma.pushSubscription.count({ where: { userId } });
      let thisDevice = false;
      if (input?.endpoint) {
        thisDevice =
          (await ctx.prisma.pushSubscription.count({
            where: { userId, endpoint: input.endpoint },
          })) > 0;
      }
      return { hasSubscription: count > 0, count, thisDevice };
    }),
});
