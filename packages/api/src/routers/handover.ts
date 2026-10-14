import { createTRPCRouter } from "../trpc";

// Procedures are added by the handover feature. Every one must check household
// membership (see CLAUDE.md, "Access control").
export const handoverRouter = createTRPCRouter({});
