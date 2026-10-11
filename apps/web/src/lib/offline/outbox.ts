import { create } from "zustand";
import { persist, type PersistStorage } from "zustand/middleware";
import SuperJSON from "superjson";
import { TRPCClientError } from "@trpc/client";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "@baby-atlas/api";

type Inputs = inferRouterInputs<AppRouter>;

/** The mutations quick actions can queue. Creates carry a client-picked recordId. */
export type OutboxOp =
  | { path: "diaper.log"; input: Inputs["diaper"]["log"] }
  | { path: "diaper.delete"; input: Inputs["diaper"]["delete"] }
  | { path: "feeding.logBottle"; input: Inputs["feeding"]["logBottle"] }
  | { path: "feeding.startBreastfeeding"; input: Inputs["feeding"]["startBreastfeeding"] }
  | { path: "feeding.switchBreastfeedingSide"; input: Inputs["feeding"]["switchBreastfeedingSide"] }
  | { path: "feeding.endBreastfeeding"; input: Inputs["feeding"]["endBreastfeeding"] }
  | { path: "feeding.delete"; input: Inputs["feeding"]["delete"] }
  | { path: "sleep.start"; input: Inputs["sleep"]["start"] }
  | { path: "sleep.end"; input: Inputs["sleep"]["end"] }
  | { path: "sleep.delete"; input: Inputs["sleep"]["delete"] }
  | { path: "pumping.start"; input: Inputs["pumping"]["start"] }
  | { path: "pumping.end"; input: Inputs["pumping"]["end"] }
  | { path: "pumping.delete"; input: Inputs["pumping"]["delete"] };

export type OutboxPath = OutboxOp["path"];

export interface OutboxEntry {
  key: string;
  // Only this user's session sends the entry, so a sign-in as someone else
  // on the same phone neither sends nor drops it
  userId: string;
  childId: string;
  recordId: string;
  op: OutboxOp;
  // Accepted by the server. Kept for the home screen overlay until the
  // queries have refetched, so the state does not flicker back meanwhile.
  synced?: boolean;
  serverFailures?: number;
}

const CREATE_PATHS: ReadonlySet<OutboxPath> = new Set([
  "diaper.log",
  "feeding.logBottle",
  "feeding.startBreastfeeding",
  "sleep.start",
  "pumping.start",
]);

const FINISH_PATHS: ReadonlySet<OutboxPath> = new Set([
  "feeding.switchBreastfeedingSide",
  "feeding.endBreastfeeding",
  "sleep.end",
  "pumping.end",
]);

// A server error that repeats this often is a bug, not an outage. Dropping the
// entry keeps it from holding up everything queued behind it.
export const MAX_SERVER_FAILURES = 5;

interface OutboxState {
  entries: OutboxEntry[];
  add: (entry: Omit<OutboxEntry, "key">) => void;
  update: (key: string, changes: Partial<OutboxEntry>) => void;
  removeRecord: (recordId: string) => void;
  removeKeys: (keys: string[]) => void;
}

// superjson keeps the Date fields in queued inputs intact across reloads
const storage: PersistStorage<Pick<OutboxState, "entries">> = {
  getItem: (name) => {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(name);
    return raw ? SuperJSON.parse(raw) : null;
  },
  setItem: (name, value) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(name, SuperJSON.stringify(value));
  },
  removeItem: (name) => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(name);
  },
};

let nextKey = 0;

/**
 * Quick-action writes wait here, in order, until the server has accepted
 * them. Every quick action goes through the outbox, online or not, so there
 * is one code path. It survives reloads through localStorage.
 */
export const useOutbox = create<OutboxState>()(
  persist(
    (set) => ({
      entries: [],
      add: (entry) =>
        set((state) => ({
          entries: [...state.entries, { ...entry, key: `${Date.now()}-${nextKey++}` }],
        })),
      update: (key, changes) =>
        set((state) => ({
          entries: state.entries.map((e) => (e.key === key ? { ...e, ...changes } : e)),
        })),
      removeRecord: (recordId) =>
        set((state) => ({ entries: state.entries.filter((e) => e.recordId !== recordId) })),
      removeKeys: (keys) =>
        set((state) => ({ entries: state.entries.filter((e) => !keys.includes(e.key)) })),
    }),
    {
      name: "baby-atlas-outbox",
      storage,
      partialize: (state) => ({ entries: state.entries }),
    }
  )
);

// The entry being sent right now. It cannot be cancelled any more.
let inFlightKey: string | null = null;

export function isUnsent(entry: OutboxEntry, userId: string | undefined) {
  return !entry.synced && entry.userId === userId;
}

export function queueOp(userId: string, childId: string, recordId: string, op: OutboxOp) {
  useOutbox.getState().add({ userId, childId, recordId, op });
}

/**
 * Undoes a record. If its create has not left the device yet, the record and
 * everything queued for it are dropped and the server never sees it.
 * Otherwise the delete is queued behind the create.
 */
export function discardRecord(userId: string, childId: string, recordId: string, deleteOp: OutboxOp) {
  const { entries, removeRecord } = useOutbox.getState();
  const create = entries.find((e) => e.recordId === recordId && CREATE_PATHS.has(e.op.path));
  if (create && !create.synced && create.key !== inFlightKey) {
    removeRecord(recordId);
    return;
  }
  queueOp(userId, childId, recordId, deleteOp);
}

export type SyncOutcome = "done" | "retry" | "failed";

function httpStatusOf(error: unknown): number | undefined {
  if (!(error instanceof TRPCClientError)) return undefined;
  return (error.data as { httpStatus?: number } | undefined)?.httpStatus;
}

export function classifySyncError(path: OutboxPath, error: unknown): SyncOutcome {
  const status = httpStatusOf(error);
  // No response at all: offline, DNS, a dropped connection
  if (!status) return "retry";
  // A signed-out session keeps the queue until the user signs in again
  if (status === 401 || status === 408 || status === 429 || status >= 500) return "retry";
  // Already stopped or deleted, for example by the other parent or by an
  // earlier attempt whose response was lost
  const code = (error as TRPCClientError<AppRouter>).data?.code;
  if (code === "CONFLICT" && FINISH_PATHS.has(path)) return "done";
  if (code === "NOT_FOUND" && path.endsWith(".delete")) return "done";
  return "failed";
}

export interface FlushResult {
  synced: boolean;
  blocked: boolean;
}

let flushing: Promise<FlushResult> | null = null;

/**
 * Sends the user's unsent entries one by one, oldest first. Stops at the
 * first entry that should be retried, so later entries never overtake it.
 * An entry the server rejects is dropped together with everything else
 * queued for its record, and reported through onFailed.
 */
export function flushOutbox(
  userId: string,
  send: (op: OutboxOp) => Promise<unknown>,
  onFailed: (entry: OutboxEntry, error: unknown) => void
): Promise<FlushResult> {
  flushing ??= drain(userId, send, onFailed).finally(() => {
    flushing = null;
  });
  return flushing;
}

async function drain(
  userId: string,
  send: (op: OutboxOp) => Promise<unknown>,
  onFailed: (entry: OutboxEntry, error: unknown) => void
): Promise<FlushResult> {
  let synced = false;
  for (;;) {
    const { entries, update, removeRecord } = useOutbox.getState();
    const entry = entries.find((e) => isUnsent(e, userId));
    if (!entry) return { synced, blocked: false };

    let outcome: SyncOutcome = "done";
    let failure: unknown;
    inFlightKey = entry.key;
    try {
      await send(entry.op);
    } catch (error) {
      failure = error;
      outcome = classifySyncError(entry.op.path, error);
    } finally {
      inFlightKey = null;
    }

    if (outcome === "retry" && (httpStatusOf(failure) ?? 0) >= 500) {
      const serverFailures = (entry.serverFailures ?? 0) + 1;
      if (serverFailures >= MAX_SERVER_FAILURES) outcome = "failed";
      else update(entry.key, { serverFailures });
    }

    if (outcome === "retry") return { synced, blocked: true };
    if (outcome === "failed") {
      onFailed(entry, failure);
      removeRecord(entry.recordId);
    } else {
      update(entry.key, { synced: true });
    }
    synced = true;
  }
}

/** Forgets synced entries once fresh server data covers them. */
export function pruneSynced(keys: string[]) {
  if (keys.length) useOutbox.getState().removeKeys(keys);
}

export function syncedKeys(): string[] {
  return useOutbox
    .getState()
    .entries.filter((e) => e.synced)
    .map((e) => e.key);
}
