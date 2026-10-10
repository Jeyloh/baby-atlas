import { describe, it, expect } from "vitest";
import {
  householdRoleSchema,
  createHouseholdSchema,
  updateHouseholdSchema,
  inviteMemberSchema,
  acceptInviteSchema,
  updateMemberRoleSchema,
  removeMemberSchema,
} from "./household";

const validId = "cljk2j3k40000a1b2c3d4e5f6";

describe("householdRoleSchema", () => {
  it("accepts valid roles", () => {
    expect(householdRoleSchema.parse("OWNER")).toBe("OWNER");
    expect(householdRoleSchema.parse("ADMIN")).toBe("ADMIN");
    expect(householdRoleSchema.parse("CAREGIVER")).toBe("CAREGIVER");
    expect(householdRoleSchema.parse("VIEWER")).toBe("VIEWER");
  });

  it("rejects invalid roles", () => {
    expect(() => householdRoleSchema.parse("GUEST")).toThrow();
    expect(() => householdRoleSchema.parse("admin")).toThrow();
  });
});

describe("createHouseholdSchema", () => {
  it("requires name", () => {
    expect(() => createHouseholdSchema.parse({})).toThrow();
  });

  it("accepts valid name", () => {
    const result = createHouseholdSchema.parse({ name: "Smith Family" });
    expect(result.name).toBe("Smith Family");
  });

  it("rejects empty name", () => {
    expect(() => createHouseholdSchema.parse({ name: "" })).toThrow();
  });

  it("rejects name over 100 characters", () => {
    expect(() =>
      createHouseholdSchema.parse({ name: "a".repeat(101) })
    ).toThrow();
  });
});

describe("updateHouseholdSchema", () => {
  it("requires id", () => {
    expect(() => updateHouseholdSchema.parse({})).toThrow();
  });

  it("accepts id only", () => {
    const result = updateHouseholdSchema.parse({ id: validId });
    expect(result.id).toBe(validId);
  });

  it("accepts name update", () => {
    const result = updateHouseholdSchema.parse({
      id: validId,
      name: "New Name",
    });
    expect(result.name).toBe("New Name");
  });
});

describe("inviteMemberSchema", () => {
  it("requires householdId but not email (share links)", () => {
    expect(() => inviteMemberSchema.parse({})).toThrow();
    expect(inviteMemberSchema.parse({ householdId: validId })).toMatchObject({
      householdId: validId,
      role: "CAREGIVER",
    });
  });

  it("validates email format", () => {
    expect(() =>
      inviteMemberSchema.parse({
        householdId: validId,
        email: "not-an-email",
      })
    ).toThrow();
  });

  it("uses default role of CAREGIVER", () => {
    const result = inviteMemberSchema.parse({
      householdId: validId,
      email: "user@example.com",
    });
    expect(result.role).toBe("CAREGIVER");
  });

  it("accepts custom role", () => {
    const result = inviteMemberSchema.parse({
      householdId: validId,
      email: "user@example.com",
      role: "VIEWER",
    });
    expect(result.role).toBe("VIEWER");
  });
});

describe("acceptInviteSchema", () => {
  it("requires token", () => {
    expect(() => acceptInviteSchema.parse({})).toThrow();
  });

  it("accepts a token of realistic length", () => {
    const token = "Qm9vZ2llV29vZ2llQm9vZ2llV29vZ2ll";
    expect(acceptInviteSchema.parse({ token }).token).toBe(token);
  });

  it("rejects tokens too short to be real", () => {
    expect(() => acceptInviteSchema.parse({ token: "short" })).toThrow();
  });
});

describe("updateMemberRoleSchema", () => {
  it("requires householdId, userId, and role", () => {
    expect(() =>
      updateMemberRoleSchema.parse({
        householdId: validId,
        userId: validId,
      })
    ).toThrow();
  });

  it("accepts valid input", () => {
    const result = updateMemberRoleSchema.parse({
      householdId: validId,
      userId: "cljk2j3k40001a1b2c3d4e5f7",
      role: "ADMIN",
    });
    expect(result.role).toBe("ADMIN");
  });
});

describe("removeMemberSchema", () => {
  it("requires householdId and userId", () => {
    expect(() =>
      removeMemberSchema.parse({ householdId: validId })
    ).toThrow();
  });

  it("accepts valid input", () => {
    const result = removeMemberSchema.parse({
      householdId: validId,
      userId: "cljk2j3k40001a1b2c3d4e5f7",
    });
    expect(result.householdId).toBe(validId);
  });
});
