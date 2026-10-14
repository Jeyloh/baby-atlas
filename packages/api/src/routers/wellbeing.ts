import { createTRPCRouter } from "../trpc";

// Procedures are added by the wellbeing feature. Every one must check household
// membership (see CLAUDE.md, "Access control").
export const wellbeingRouter = createTRPCRouter({});
