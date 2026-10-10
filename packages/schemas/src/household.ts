import { z } from "zod";
import { idSchema } from "./common";

export const householdRoleSchema = z.enum(["OWNER", "ADMIN", "CAREGIVER", "VIEWER"]);
export type HouseholdRole = z.infer<typeof householdRoleSchema>;

export const createHouseholdSchema = z.object({
  name: z.string().min(1).max(100),
});
export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;

export const updateHouseholdSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(100).optional(),
});
export type UpdateHouseholdInput = z.infer<typeof updateHouseholdSchema>;

// Email is optional: without it, anyone with the link can accept (once)
export const inviteMemberSchema = z.object({
  householdId: idSchema,
  email: z.string().email().optional(),
  role: householdRoleSchema.default("CAREGIVER"),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const inviteTokenSchema = z.string().min(20).max(100);

export const acceptInviteSchema = z.object({
  token: inviteTokenSchema,
});

export const getInviteSchema = z.object({
  token: inviteTokenSchema,
});

export const listInvitesSchema = z.object({
  householdId: idSchema,
});

export const revokeInviteSchema = z.object({
  householdId: idSchema,
  inviteId: idSchema,
});
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const updateMemberRoleSchema = z.object({
  householdId: idSchema,
  userId: idSchema,
  role: householdRoleSchema,
});
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export const removeMemberSchema = z.object({
  householdId: idSchema,
  userId: idSchema,
});
export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
