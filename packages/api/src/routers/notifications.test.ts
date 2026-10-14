import { describe, it, expect } from "vitest";
import { prismaMock } from "../test/setup";
import {
  createTestContext,
  createUnauthenticatedContext,
  TEST_IDS,
} from "../test/helpers";
import { createCallerFactory } from "../trpc";
import { notificationsRouter } from "./notifications";

const createCaller = createCallerFactory(notificationsRouter);
const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123";
const keys = { p256dh: "p256dh-key", auth: "auth-key" };

describe("notificationsRouter", () => {
  it("rejects unauthenticated callers", async () => {
    const caller = createCaller(createUnauthenticatedContext());
    await expect(caller.getSettings()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.status()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  describe("getSettings", () => {
    it("returns defaults when nothing is saved", async () => {
      prismaMock.notificationSettings.findUnique.mockResolvedValue(null);
      const result = await createCaller(createTestContext()).getSettings();

      expect(result.enabledKinds).toContain("TIMER_RUNNING");
      expect(result.enabledKinds).not.toContain("FEED_DUE");
      expect(result.quietStart).toBe(1320);
      expect(result.quietEnd).toBe(420);
      expect(result.mutedChildIds).toEqual([]);
      expect(result.locale).toBe("nb");
    });

    it("reads only the caller's row and drops invalid stored thresholds", async () => {
      prismaMock.notificationSettings.findUnique.mockResolvedValue({
        userId: TEST_IDS.userId,
        enabledKinds: ["WEEKLY_TIP"],
        mutedChildIds: [TEST_IDS.childId],
        quietStart: null,
        quietEnd: null,
        timerThresholds: { nap: "oops" },
        locale: "en",
        updatedAt: new Date(),
      } as never);

      const result = await createCaller(createTestContext()).getSettings();

      expect(prismaMock.notificationSettings.findUnique).toHaveBeenCalledWith({
        where: { userId: TEST_IDS.userId },
      });
      expect(result.enabledKinds).toEqual(["WEEKLY_TIP"]);
      expect(result.quietStart).toBeNull();
      expect(result.timerThresholds).toEqual({});
      expect(result.locale).toBe("en");
    });
  });

  describe("updateSettings", () => {
    it("saves only the given fields for the caller", async () => {
      const result = await createCaller(createTestContext()).updateSettings({
        enabledKinds: ["WEEKLY_DIGEST"],
        quietStart: 1380,
        quietEnd: 360,
        timerThresholds: { nap: 180 },
        locale: "en",
      });

      expect(result.success).toBe(true);
      expect(prismaMock.notificationSettings.upsert).toHaveBeenCalledWith({
        where: { userId: TEST_IDS.userId },
        create: {
          userId: TEST_IDS.userId,
          enabledKinds: ["WEEKLY_DIGEST"],
          quietStart: 1380,
          quietEnd: 360,
          timerThresholds: { nap: 180 },
          locale: "en",
        },
        update: {
          enabledKinds: ["WEEKLY_DIGEST"],
          quietStart: 1380,
          quietEnd: 360,
          timerThresholds: { nap: 180 },
          locale: "en",
        },
      });
    });

    it("can turn quiet hours off with null", async () => {
      await createCaller(createTestContext()).updateSettings({
        quietStart: null,
        quietEnd: null,
      });
      expect(prismaMock.notificationSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { quietStart: null, quietEnd: null } })
      );
    });

    it("accepts muting a child the user can access", async () => {
      prismaMock.child.findMany.mockResolvedValue([{ id: TEST_IDS.childId }] as never);

      await createCaller(createTestContext()).updateSettings({
        mutedChildIds: [TEST_IDS.childId],
      });

      expect(prismaMock.child.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: [TEST_IDS.childId] },
          household: { members: { some: { userId: TEST_IDS.userId } } },
        },
        select: { id: true },
      });
      expect(prismaMock.notificationSettings.upsert).toHaveBeenCalled();
    });

    it("silently drops children from another household", async () => {
      prismaMock.child.findMany.mockResolvedValue([{ id: TEST_IDS.childId }] as never);
      const foreign = "clq1234567890abcdefghij99";

      await createCaller(createTestContext()).updateSettings({
        mutedChildIds: [TEST_IDS.childId, foreign],
      });

      expect(prismaMock.notificationSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { mutedChildIds: [TEST_IDS.childId] } })
      );
    });

    it("saves an empty list when none of the children are accessible", async () => {
      prismaMock.child.findMany.mockResolvedValue([]);

      await createCaller(createTestContext()).updateSettings({
        mutedChildIds: [TEST_IDS.childId],
      });

      expect(prismaMock.notificationSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ update: { mutedChildIds: [] } })
      );
    });

    it("rejects minutes outside a day", async () => {
      const caller = createCaller(createTestContext());
      await expect(caller.updateSettings({ quietStart: 1440 })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      await expect(caller.updateSettings({ quietEnd: -1 })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("rejects bad thresholds, kinds and locale", async () => {
      const caller = createCaller(createTestContext());
      await expect(
        caller.updateSettings({ timerThresholds: { nap: 0 } })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        caller.updateSettings({ timerThresholds: { sneezing: 10 } as never })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        caller.updateSettings({ enabledKinds: ["SPAM" as never] })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        caller.updateSettings({ locale: "de" as never })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("subscribe", () => {
    it("stores the subscription for the caller and moves an existing endpoint", async () => {
      prismaMock.pushSubscription.findMany.mockResolvedValue([]);
      await createCaller(createTestContext()).subscribe({
        endpoint: ENDPOINT,
        keys,
        userAgent: "Test/1.0",
        locale: "en",
      });

      const fields = {
        userId: TEST_IDS.userId,
        p256dh: "p256dh-key",
        auth: "auth-key",
        userAgent: "Test/1.0",
        failureCount: 0,
        createdAt: expect.any(Date),
      };
      expect(prismaMock.pushSubscription.upsert).toHaveBeenCalledWith({
        where: { endpoint: ENDPOINT },
        create: { endpoint: ENDPOINT, ...fields },
        update: fields,
      });
      expect(prismaMock.notificationSettings.upsert).toHaveBeenCalledWith({
        where: { userId: TEST_IDS.userId },
        create: { userId: TEST_IDS.userId, locale: "en" },
        update: { locale: "en" },
      });
    });

    it("removes the oldest devices beyond ten", async () => {
      prismaMock.pushSubscription.findMany.mockResolvedValue([{ id: "old-1" }, { id: "old-2" }] as never);

      await createCaller(createTestContext()).subscribe({ endpoint: ENDPOINT, keys });

      expect(prismaMock.pushSubscription.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_IDS.userId },
        orderBy: { createdAt: "desc" },
        skip: 10,
        select: { id: true },
      });
      expect(prismaMock.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["old-1", "old-2"] }, userId: TEST_IDS.userId },
      });
    });

    it("keeps everything when the user has ten or fewer devices", async () => {
      prismaMock.pushSubscription.findMany.mockResolvedValue([]);
      await createCaller(createTestContext()).subscribe({ endpoint: ENDPOINT, keys });
      expect(prismaMock.pushSubscription.deleteMany).not.toHaveBeenCalled();
    });

    it("rejects endpoints that are not on a known push service", async () => {
      const caller = createCaller(createTestContext());
      for (const endpoint of [
        "https://example.com/push",
        "http://fcm.googleapis.com/fcm/send/abc",
        "https://169.254.169.254/latest",
      ]) {
        await expect(caller.subscribe({ endpoint, keys })).rejects.toMatchObject({
          code: "BAD_REQUEST",
        });
      }
      expect(prismaMock.pushSubscription.upsert).not.toHaveBeenCalled();
    });

    it("rejects a malformed subscription", async () => {
      await expect(
        createCaller(createTestContext()).subscribe({
          endpoint: "not a url",
          keys,
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("unsubscribe", () => {
    it("only deletes the caller's own subscription", async () => {
      prismaMock.pushSubscription.deleteMany.mockResolvedValue({ count: 1 });

      const result = await createCaller(createTestContext()).unsubscribe({
        endpoint: ENDPOINT,
      });

      expect(prismaMock.pushSubscription.deleteMany).toHaveBeenCalledWith({
        where: { endpoint: ENDPOINT, userId: TEST_IDS.userId },
      });
      expect(result.removed).toBe(1);
    });

    it("removes nothing for someone else's endpoint", async () => {
      prismaMock.pushSubscription.deleteMany.mockResolvedValue({ count: 0 });
      const result = await createCaller(createTestContext()).unsubscribe({
        endpoint: ENDPOINT,
      });
      expect(result.removed).toBe(0);
    });
  });

  describe("status", () => {
    it("reports subscriptions and whether this device has one", async () => {
      prismaMock.pushSubscription.count
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);

      const result = await createCaller(createTestContext()).status({ endpoint: ENDPOINT });

      expect(result).toEqual({ hasSubscription: true, count: 2, thisDevice: true });
      expect(prismaMock.pushSubscription.count).toHaveBeenNthCalledWith(1, {
        where: { userId: TEST_IDS.userId },
      });
    });

    it("works without an endpoint", async () => {
      prismaMock.pushSubscription.count.mockResolvedValue(0);
      const result = await createCaller(createTestContext()).status();
      expect(result).toEqual({ hasSubscription: false, count: 0, thisDevice: false });
    });
  });
});
