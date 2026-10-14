import { describe, it, expect } from "vitest";
import {
  defaultRecipientSettings,
  logKey,
  planDeliveries,
  resolveAudience,
  type HouseholdMemberRef,
  type PlanInput,
  type RecipientSettings,
} from "./plan";
import type { Candidate } from "./types";

const CHILD = "child-1";
// 12:00 in Oslo (winter time), well outside the default quiet hours
const NOON = new Date("2026-01-15T11:00:00Z");
// 23:30 in Oslo
const NIGHT = new Date("2026-01-15T22:30:00Z");

const members: HouseholdMemberRef[] = [
  { userId: "owner", role: "OWNER" },
  { userId: "caregiver", role: "CAREGIVER" },
  { userId: "viewer", role: "VIEWER" },
];

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    kind: "TIMER_RUNNING",
    childId: CHILD,
    dedupeKey: "timer:rec-1:1x",
    url: `/dashboard/${CHILD}`,
    titleKey: "push.test.title",
    bodyKey: "push.test.body",
    params: {},
    ...overrides,
  };
}

function plan(overrides: Partial<PlanInput> = {}, settings: Record<string, Partial<RecipientSettings>> = {}) {
  return planDeliveries({
    candidates: [candidate()],
    membersByChild: new Map([[CHILD, members]]),
    settingsByUser: new Map(
      Object.entries(settings).map(([id, s]) => [id, { ...defaultRecipientSettings(), ...s }])
    ),
    subscribedUsers: new Set(["owner", "caregiver", "viewer"]),
    logged: new Set<string>(),
    now: NOON,
    ...overrides,
  });
}

const recipients = (deliveries: ReturnType<typeof plan>) => deliveries.map((d) => d.userId).sort();

describe("resolveAudience", () => {
  it("defaults to every member except viewers", () => {
    expect(resolveAudience(candidate(), members)).toEqual(["owner", "caregiver"]);
  });

  it("limits an explicit audience to current members", () => {
    expect(resolveAudience(candidate({ audience: ["owner", "gone", "owner"] }), members)).toEqual([
      "owner",
    ]);
  });

  it("allows an explicit audience to include a viewer who is a member", () => {
    expect(resolveAudience(candidate({ audience: ["viewer"] }), members)).toEqual(["viewer"]);
  });
});

describe("planDeliveries", () => {
  it("sends to subscribed non-viewer members with default settings", () => {
    expect(recipients(plan())).toEqual(["caregiver", "owner"]);
  });

  it("skips users without a subscription", () => {
    expect(recipients(plan({ subscribedUsers: new Set(["owner"]) }))).toEqual(["owner"]);
  });

  it("skips kinds the user has not enabled", () => {
    const result = plan({}, { owner: { enabledKinds: ["WEEKLY_TIP"] } });
    expect(recipients(result)).toEqual(["caregiver"]);
  });

  it("does not send predictions (off by default) to users on the defaults", () => {
    const result = plan({ candidates: [candidate({ kind: "FEED_DUE", dedupeKey: "feed:1" })] });
    expect(result).toEqual([]);
  });

  it("skips muted children", () => {
    const result = plan({}, { caregiver: { mutedChildIds: [CHILD] } });
    expect(recipients(result)).toEqual(["owner"]);
  });

  it("holds notices back during quiet hours, per user", () => {
    expect(plan({ now: NIGHT })).toEqual([]);
    const result = plan({ now: NIGHT }, { owner: { quietStart: null, quietEnd: null } });
    expect(recipients(result)).toEqual(["owner"]);
  });

  it("sends once quiet hours are over (the notice was never logged)", () => {
    expect(plan({ now: NIGHT })).toEqual([]);
    expect(recipients(plan({ now: new Date("2026-01-16T06:30:00Z") }))).toEqual([
      "caregiver",
      "owner",
    ]);
  });

  it("skips notices already logged for that user", () => {
    const logged = new Set([logKey("owner", "timer:rec-1:1x")]);
    expect(recipients(plan({ logged }))).toEqual(["caregiver"]);
  });

  it("treats a different dedupe key as a new notice", () => {
    const logged = new Set([logKey("owner", "timer:rec-1:1x")]);
    const result = plan({ logged, candidates: [candidate({ dedupeKey: "timer:rec-1:2x" })] });
    expect(recipients(result)).toEqual(["caregiver", "owner"]);
  });

  it("plans a duplicate candidate only once per user", () => {
    const result = plan({ candidates: [candidate(), candidate()] });
    expect(result).toHaveLength(2);
  });

  it("ignores candidates for unknown children", () => {
    expect(plan({ candidates: [candidate({ childId: "other" })] })).toEqual([]);
  });
});
