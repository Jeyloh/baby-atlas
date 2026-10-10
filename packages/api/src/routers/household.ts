import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  createHouseholdSchema,
  updateHouseholdSchema,
  inviteMemberSchema,
  acceptInviteSchema,
  getInviteSchema,
  listInvitesSchema,
  revokeInviteSchema,
  updateMemberRoleSchema,
  removeMemberSchema,
} from "@baby-atlas/schemas";
import { randomBytes } from "crypto";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
  householdProcedure,
} from "../trpc";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// 24 random bytes, URL safe: the link itself is the credential
function newInviteToken(): string {
  return randomBytes(24).toString("base64url");
}

function assertCanManage(role: string | undefined) {
  if (role !== "OWNER" && role !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only owners and admins can manage invites",
    });
  }
}

export const householdRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.prisma.householdMember.findMany({
      where: { userId: ctx.session.user.id },
      include: {
        household: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, email: true, image: true },
                },
              },
            },
            children: {
              select: { id: true, name: true, birthDate: true, photo: true },
            },
          },
        },
      },
    });

    return memberships.map((m) => ({
      ...m.household,
      role: m.role,
    }));
  }),

  get: householdProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const household = await ctx.prisma.household.findUnique({
        where: { id: input.id },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
          },
          children: true,
        },
      });

      if (!household) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return household;
    }),

  create: protectedProcedure
    .input(createHouseholdSchema)
    .mutation(async ({ ctx, input }) => {
      const household = await ctx.prisma.household.create({
        data: {
          name: input.name,
          members: {
            create: {
              userId: ctx.session.user.id,
              role: "OWNER",
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
          },
        },
      });

      return household;
    }),

  update: householdProcedure
    .input(updateHouseholdSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.memberRole !== "OWNER" && ctx.memberRole !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owners and admins can update household settings",
        });
      }

      const household = await ctx.prisma.household.update({
        where: { id: input.id },
        data: { name: input.name },
      });

      return household;
    }),

  delete: householdProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.memberRole !== "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owners can delete households",
        });
      }

      await ctx.prisma.household.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  invite: householdProcedure
    .input(inviteMemberSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.memberRole !== "OWNER" && ctx.memberRole !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owners and admins can invite members",
        });
      }

      if (input.role === "OWNER") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot invite an owner" });
      }

      const email = input.email?.toLowerCase();
      if (email) {
        const existingUser = await ctx.prisma.user.findUnique({ where: { email } });
        if (existingUser) {
          const existingMember = await ctx.prisma.householdMember.findUnique({
            where: {
              householdId_userId: {
                householdId: input.householdId,
                userId: existingUser.id,
              },
            },
          });

          if (existingMember) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "User is already a member of this household",
            });
          }
        }
      }

      const invite = await ctx.prisma.householdInvite.create({
        data: {
          householdId: input.householdId,
          email,
          role: input.role,
          token: newInviteToken(),
          invitedById: ctx.session.user.id,
          expiresAt: new Date(Date.now() + INVITE_TTL_MS),
        },
      });

      return invite;
    }),

  listInvites: householdProcedure
    .input(listInvitesSchema)
    .query(async ({ ctx, input }) => {
      assertCanManage(ctx.memberRole);
      return ctx.prisma.householdInvite.findMany({
        where: { householdId: input.householdId, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, role: true, token: true, expiresAt: true, createdAt: true },
      });
    }),

  revokeInvite: householdProcedure
    .input(revokeInviteSchema)
    .mutation(async ({ ctx, input }) => {
      assertCanManage(ctx.memberRole);
      // Scoped by household so an id from another household cannot be revoked
      await ctx.prisma.householdInvite.deleteMany({
        where: { id: input.inviteId, householdId: input.householdId },
      });
      return { success: true };
    }),

  // Public so the invite page can say who invited you before you sign in.
  // Holding the secret token is what grants access to this summary.
  getInvite: publicProcedure.input(getInviteSchema).query(async ({ ctx, input }) => {
    const invite = await ctx.prisma.householdInvite.findUnique({
      where: { token: input.token },
      select: {
        role: true,
        email: true,
        expiresAt: true,
        householdId: true,
        household: { select: { name: true } },
        invitedBy: { select: { name: true } },
      },
    });
    if (!invite) throw new TRPCError({ code: "NOT_FOUND", message: "Invite not found" });

    const userId = ctx.session?.user.id;
    const alreadyMember = userId
      ? !!(await ctx.prisma.householdMember.findUnique({
          where: { householdId_userId: { householdId: invite.householdId, userId } },
        }))
      : false;

    return {
      householdName: invite.household.name,
      invitedByName: invite.invitedBy?.name ?? null,
      role: invite.role,
      expired: invite.expiresAt < new Date(),
      restrictedToEmail: invite.email !== null,
      alreadyMember,
    };
  }),

  acceptInvite: protectedProcedure
    .input(acceptInviteSchema)
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.prisma.householdInvite.findUnique({
        where: { token: input.token },
      });

      if (!invite) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invite not found",
        });
      }

      if (invite.expiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invite has expired",
        });
      }

      if (invite.email && invite.email !== ctx.session.user.email?.toLowerCase()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invite is for a different email address",
        });
      }

      const existing = await ctx.prisma.householdMember.findUnique({
        where: {
          householdId_userId: { householdId: invite.householdId, userId: ctx.session.user.id },
        },
      });

      // Accepting twice (or as an existing member) keeps the current role
      await ctx.prisma.$transaction([
        ...(existing
          ? []
          : [
              ctx.prisma.householdMember.create({
                data: {
                  householdId: invite.householdId,
                  userId: ctx.session.user.id,
                  role: invite.role,
                },
              }),
            ]),
        ctx.prisma.householdInvite.delete({ where: { id: invite.id } }),
      ]);

      const firstChild = await ctx.prisma.child.findFirst({
        where: { householdId: invite.householdId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      return { success: true, householdId: invite.householdId, childId: firstChild?.id ?? null };
    }),

  updateMemberRole: householdProcedure
    .input(updateMemberRoleSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.memberRole !== "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owners can change member roles",
        });
      }

      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot change your own role",
        });
      }

      const member = await ctx.prisma.householdMember.update({
        where: {
          householdId_userId: {
            householdId: input.householdId,
            userId: input.userId,
          },
        },
        data: { role: input.role },
      });

      return member;
    }),

  removeMember: householdProcedure
    .input(removeMemberSchema)
    .mutation(async ({ ctx, input }) => {
      const isRemovingSelf = input.userId === ctx.session.user.id;

      if (!isRemovingSelf && ctx.memberRole !== "OWNER" && ctx.memberRole !== "ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only owners and admins can remove members",
        });
      }

      const memberToRemove = await ctx.prisma.householdMember.findUnique({
        where: {
          householdId_userId: {
            householdId: input.householdId,
            userId: input.userId,
          },
        },
      });

      if (!memberToRemove) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      if (memberToRemove.role === "OWNER" && !isRemovingSelf) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot remove the owner",
        });
      }

      await ctx.prisma.householdMember.delete({
        where: {
          householdId_userId: {
            householdId: input.householdId,
            userId: input.userId,
          },
        },
      });

      return { success: true };
    }),
});
