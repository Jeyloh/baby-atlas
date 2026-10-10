import "server-only";

import { headers } from "next/headers";
import { cache } from "react";
import { createCallerFactory, createTRPCContext } from "@baby-atlas/api";
import { appRouter } from "@baby-atlas/api";

const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");

  return createTRPCContext({
    headers: heads,
  });
});

const createCaller = createCallerFactory(appRouter);

export const api = cache(async () => {
  const ctx = await createContext();
  return createCaller(ctx);
});
