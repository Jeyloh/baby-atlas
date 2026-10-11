import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCClientError } from "@trpc/client";
import {
  classifySyncError,
  discardRecord,
  flushOutbox,
  MAX_SERVER_FAILURES,
  pruneSynced,
  queueOp,
  syncedKeys,
  useOutbox,
  type OutboxOp,
} from "./outbox";

const userId = "cuser0000000000000000000";
const otherUser = "cother000000000000000000";
const childId = "cchild000000000000000000";
const recordA = "crecorda0000000000000000";
const recordB = "crecordb0000000000000000";

function serverError(httpStatus: number, code: string) {
  return new TRPCClientError("server error", {
    result: { error: { message: "x", code: -1, data: { httpStatus, code } } },
  } as never);
}

const startSleep = (recordId: string): OutboxOp => ({
  path: "sleep.start",
  input: { recordId, childId, sleepType: "NAP", startTime: new Date() },
});
const endSleep = (recordId: string): OutboxOp => ({
  path: "sleep.end",
  input: { id: recordId, endTime: new Date() },
});
const deleteSleep = (recordId: string): OutboxOp => ({ path: "sleep.delete", input: { id: recordId } });

const paths = () => useOutbox.getState().entries.map((e) => e.op.path);
const sentPaths = (send: ReturnType<typeof vi.fn>) => send.mock.calls.map(([op]) => (op as OutboxOp).path);

describe("outbox", () => {
  beforeEach(() => {
    useOutbox.setState({ entries: [] });
  });

  describe("classifySyncError", () => {
    it("retries when there was no response", () => {
      expect(classifySyncError("diaper.log", new TypeError("Failed to fetch"))).toBe("retry");
    });

    it("retries server errors and a signed-out session", () => {
      expect(classifySyncError("diaper.log", serverError(500, "INTERNAL_SERVER_ERROR"))).toBe("retry");
      expect(classifySyncError("diaper.log", serverError(401, "UNAUTHORIZED"))).toBe("retry");
    });

    it("counts an already ended timer or a deleted record as done", () => {
      expect(classifySyncError("sleep.end", serverError(409, "CONFLICT"))).toBe("done");
      expect(classifySyncError("diaper.delete", serverError(404, "NOT_FOUND"))).toBe("done");
    });

    it("fails on other client errors", () => {
      expect(classifySyncError("sleep.start", serverError(409, "CONFLICT"))).toBe("failed");
      expect(classifySyncError("diaper.log", serverError(403, "FORBIDDEN"))).toBe("failed");
    });
  });

  describe("discardRecord", () => {
    it("drops a record that has not been sent", () => {
      queueOp(userId, childId, recordA, startSleep(recordA));
      queueOp(userId, childId, recordA, endSleep(recordA));

      discardRecord(userId, childId, recordA, deleteSleep(recordA));

      expect(paths()).toEqual([]);
    });

    it("queues a delete when the create already reached the server", async () => {
      queueOp(userId, childId, recordA, startSleep(recordA));
      await flushOutbox(userId, vi.fn().mockResolvedValue({}), vi.fn());

      discardRecord(userId, childId, recordA, deleteSleep(recordA));

      expect(paths()).toEqual(["sleep.start", "sleep.delete"]);
    });

    it("queues a delete behind a create that is being sent", async () => {
      queueOp(userId, childId, recordA, startSleep(recordA));
      let finish!: () => void;
      const send = vi
        .fn<(op: OutboxOp) => Promise<void>>()
        .mockImplementationOnce(() => new Promise<void>((resolve) => (finish = resolve)))
        .mockResolvedValue(undefined);

      const flushing = flushOutbox(userId, send, vi.fn());
      discardRecord(userId, childId, recordA, deleteSleep(recordA));
      finish();
      await flushing;

      expect(sentPaths(send)).toEqual(["sleep.start", "sleep.delete"]);
    });
  });

  describe("flushOutbox", () => {
    it("sends entries in order and keeps them as synced until pruned", async () => {
      queueOp(userId, childId, recordA, startSleep(recordA));
      queueOp(userId, childId, recordA, endSleep(recordA));
      const send = vi.fn().mockResolvedValue({});

      const result = await flushOutbox(userId, send, vi.fn());

      expect(result).toEqual({ synced: true, blocked: false });
      expect(sentPaths(send)).toEqual(["sleep.start", "sleep.end"]);
      expect(useOutbox.getState().entries.every((e) => e.synced)).toBe(true);

      pruneSynced(syncedKeys());
      expect(paths()).toEqual([]);
    });

    it("stops at an entry to retry and keeps the rest in order", async () => {
      queueOp(userId, childId, recordA, startSleep(recordA));
      queueOp(userId, childId, recordB, startSleep(recordB));
      const send = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

      const result = await flushOutbox(userId, send, vi.fn());

      expect(result).toEqual({ synced: false, blocked: true });
      expect(send).toHaveBeenCalledTimes(1);
      expect(useOutbox.getState().entries.map((e) => e.recordId)).toEqual([recordA, recordB]);
    });

    it("drops a rejected record with everything queued for it and goes on", async () => {
      queueOp(userId, childId, recordA, startSleep(recordA));
      queueOp(userId, childId, recordB, { path: "diaper.log", input: { recordId: recordB, childId, diaperType: "WET" } });
      queueOp(userId, childId, recordA, endSleep(recordA));
      const send = vi.fn().mockRejectedValueOnce(serverError(409, "CONFLICT")).mockResolvedValue({});
      const onFailed = vi.fn();

      await flushOutbox(userId, send, onFailed);

      expect(onFailed).toHaveBeenCalledOnce();
      expect(sentPaths(send)).toEqual(["sleep.start", "diaper.log"]);
      expect(paths()).toEqual(["diaper.log"]);
    });

    it("gives up on an entry after repeated server errors so the queue moves on", async () => {
      queueOp(userId, childId, recordA, startSleep(recordA));
      queueOp(userId, childId, recordB, startSleep(recordB));
      const send = vi.fn(async (op: OutboxOp) => {
        if (op.path === "sleep.start" && op.input.recordId === recordA) {
          throw serverError(500, "INTERNAL_SERVER_ERROR");
        }
      });
      const onFailed = vi.fn();

      for (let i = 1; i < MAX_SERVER_FAILURES; i++) {
        expect(await flushOutbox(userId, send, onFailed)).toEqual({ synced: false, blocked: true });
      }
      await flushOutbox(userId, send, onFailed);

      expect(onFailed).toHaveBeenCalledOnce();
      expect(useOutbox.getState().entries.map((e) => e.recordId)).toEqual([recordB]);
    });

    it("leaves another user's entries alone", async () => {
      queueOp(otherUser, childId, recordA, startSleep(recordA));
      queueOp(userId, childId, recordB, startSleep(recordB));
      const send = vi.fn().mockResolvedValue({});

      await flushOutbox(userId, send, vi.fn());

      expect(send).toHaveBeenCalledOnce();
      expect(useOutbox.getState().entries.find((e) => e.recordId === recordA)?.synced).toBeUndefined();
    });
  });
});
