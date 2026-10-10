import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@baby-atlas/db";
import { scopeToolCall, ToolScopeError } from "./scope-tool-call";

const CHILD = "child-mine";

function prismaWith(records: Record<string, string | null>) {
  const lookup = (id: string) =>
    Promise.resolve(id in records && records[id] ? { childId: records[id] } : null);
  const model = { findUnique: vi.fn(({ where }: { where: { id: string } }) => lookup(where.id)) };
  return {
    sleepRecord: model,
    pumpingRecord: model,
    activityRecord: model,
    medicine: model,
  } as unknown as PrismaClient;
}

describe("scopeToolCall", () => {
  it("replaces a model-chosen childId with the verified child", async () => {
    const input = await scopeToolCall(prismaWith({}), "log-diaper", { childId: "child-other", diaperType: "WET" }, CHILD);
    expect(input).toEqual({ childId: CHILD, diaperType: "WET" });
  });

  it("blocks tools that are not scoped to one child", async () => {
    await expect(scopeToolCall(prismaWith({}), "list-children", {}, CHILD)).rejects.toBeInstanceOf(ToolScopeError);
  });

  it("allows record ids that belong to the child", async () => {
    const input = await scopeToolCall(prismaWith({ s1: CHILD }), "end-sleep", { sleepId: "s1" }, CHILD);
    expect(input).toMatchObject({ sleepId: "s1", childId: CHILD });
  });

  it("rejects record ids from another child", async () => {
    await expect(
      scopeToolCall(prismaWith({ s1: "child-other" }), "end-sleep", { sleepId: "s1" }, CHILD)
    ).rejects.toBeInstanceOf(ToolScopeError);
  });

  it("rejects record ids that do not exist", async () => {
    await expect(
      scopeToolCall(prismaWith({}), "log-medicine", { medicineId: "m1" }, CHILD)
    ).rejects.toBeInstanceOf(ToolScopeError);
  });

  it("rejects unknown id arguments", async () => {
    await expect(
      scopeToolCall(prismaWith({}), "some-tool", { householdId: "h1" }, CHILD)
    ).rejects.toBeInstanceOf(ToolScopeError);
  });
});
