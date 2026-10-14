import { createTRPCRouter } from "../trpc";

// Procedures are added by the checkup feature. Every one must check household
// membership (see CLAUDE.md, "Access control").
export const checkupRouter = createTRPCRouter({});
