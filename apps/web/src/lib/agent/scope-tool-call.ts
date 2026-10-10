import type { PrismaClient } from "@baby-atlas/db";

/**
 * The MCP tools were written for a single-user desktop setup and trust their
 * arguments. In the web chat the model chooses the arguments, so a prompt can
 * point a tool at another family's data. Every tool call is scoped to the
 * child the user was verified for:
 * - tools that are not tied to one child are not offered at all
 * - any `childId` argument is replaced with the verified child
 * - record id arguments must belong to the verified child
 * - unknown id arguments are rejected
 */

export const UNSCOPED_TOOLS = new Set(["list-children"]);

// Household viewers may only use tools that read data
export function isReadOnlyTool(name: string): boolean {
  return /^(get|query|list)-/.test(name);
}

type RecordLookup = (prisma: PrismaClient, id: string) => Promise<{ childId: string } | null>;

const RECORD_ID_ARGS: Record<string, RecordLookup> = {
  sleepId: (p, id) => p.sleepRecord.findUnique({ where: { id }, select: { childId: true } }),
  pumpingId: (p, id) => p.pumpingRecord.findUnique({ where: { id }, select: { childId: true } }),
  activityId: (p, id) => p.activityRecord.findUnique({ where: { id }, select: { childId: true } }),
  medicineId: (p, id) => p.medicine.findUnique({ where: { id }, select: { childId: true } }),
};

export class ToolScopeError extends Error {}

export async function scopeToolCall(
  prisma: PrismaClient,
  toolName: string,
  input: Record<string, unknown>,
  childId: string,
  opts: { readOnly: boolean }
): Promise<Record<string, unknown>> {
  if (UNSCOPED_TOOLS.has(toolName) || (opts.readOnly && !isReadOnlyTool(toolName))) {
    throw new ToolScopeError(`Tool ${toolName} is not available`);
  }

  const scoped: Record<string, unknown> = { ...input, childId };

  for (const [key, value] of Object.entries(input)) {
    if (key === "childId" || !/Id$/.test(key)) continue;

    const lookup = RECORD_ID_ARGS[key];
    if (!lookup) {
      throw new ToolScopeError(`Argument ${key} is not allowed`);
    }
    const record = typeof value === "string" ? await lookup(prisma, value) : null;
    if (!record || record.childId !== childId) {
      throw new ToolScopeError("Record not found for this child");
    }
  }

  return scoped;
}
