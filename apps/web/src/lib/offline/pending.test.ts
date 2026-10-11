import { describe, expect, it } from "vitest";
import { applyPending, type LastActivities } from "./pending";
import type { OutboxEntry, OutboxOp } from "./outbox";

const childId = "cchild000000000000000000";
const recordId = "crecorda0000000000000000";

const empty: LastActivities = {
  lastSleep: null,
  activeSleep: null,
  lastBreastfeeding: null,
  activeFeeding: null,
  lastBottle: null,
  lastSolids: null,
  lastDiaper: null,
  lastPumping: null,
  activePumping: null,
  lastMedicine: null,
  lastGrowth: null,
  lastTemperature: null,
  lastActivity: null,
};

function entries(...ops: OutboxOp[]): OutboxEntry[] {
  return ops.map((op, i) => ({ key: String(i), userId: "cuser0000000000000000000", childId, recordId, op }));
}

describe("applyPending", () => {
  const start = new Date("2026-10-11T02:00:00Z");
  const end = new Date("2026-10-11T03:30:00Z");

  it("shows a queued sleep start as running", () => {
    const result = applyPending(
      empty,
      entries({ path: "sleep.start", input: { recordId, childId, sleepType: "NIGHT", startTime: start } })
    );

    expect(result.activeSleep).toMatchObject({ id: recordId, startTime: start, sleepType: "NIGHT" });
  });

  it("moves a stopped sleep to the last sleep", () => {
    const result = applyPending(
      empty,
      entries(
        { path: "sleep.start", input: { recordId, childId, sleepType: "NAP", startTime: start } },
        { path: "sleep.end", input: { id: recordId, endTime: end } }
      )
    );

    expect(result.activeSleep).toBeNull();
    expect(result.lastSleep).toMatchObject({ id: recordId, startTime: start, endTime: end });
  });

  it("tracks a breastfeed through a side switch and stop", () => {
    const result = applyPending(
      empty,
      entries(
        { path: "feeding.startBreastfeeding", input: { recordId, childId, side: "LEFT", startTime: start } },
        { path: "feeding.switchBreastfeedingSide", input: { id: recordId, newSide: "RIGHT", leftDurationSeconds: 600 } },
        { path: "feeding.endBreastfeeding", input: { id: recordId, endTime: end, leftDurationSeconds: 600, rightDurationSeconds: 300 } }
      )
    );

    expect(result.activeFeeding).toBeNull();
    expect(result.lastBreastfeeding).toMatchObject({
      side: "RIGHT",
      leftDurationSeconds: 600,
      rightDurationSeconds: 300,
      endTime: end,
    });
  });

  it("keeps a newer diaper from the server", () => {
    const later = new Date("2026-10-11T05:00:00Z");
    const server = { ...empty, lastDiaper: { id: "cserver00000000000000000", time: later } } as LastActivities;

    const result = applyPending(
      server,
      entries({ path: "diaper.log", input: { recordId, childId, time: start, diaperType: "WET" } })
    );

    expect(result.lastDiaper?.time).toEqual(later);
  });

  it("ends a timer the server already knows about", () => {
    const server = {
      ...empty,
      activePumping: { id: recordId, childId, startTime: start, endTime: null },
    } as LastActivities;

    const result = applyPending(server, entries({ path: "pumping.end", input: { id: recordId, endTime: end } }));

    expect(result.activePumping).toBeNull();
    expect(result.lastPumping).toMatchObject({ id: recordId, endTime: end });
  });
});
