import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createTRPCContext } from "@baby-atlas/api";
import { auth } from "@/lib/auth";
import { lazyStoredFileRemover } from "@/lib/storage";

const handler = async (req: Request) => {
  const session = await auth();

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () =>
      createTRPCContext({
        headers: req.headers,
        storage: lazyStoredFileRemover,
        session: session
          ? {
              user: {
                id: session.user?.id ?? "",
                email: session.user?.email,
                name: session.user?.name,
                image: session.user?.image,
              },
            }
          : null,
      }),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(
              `tRPC failed on ${path ?? "<no-path>"}: ${error.message}`
            );
          }
        : undefined,
  });
};

export { handler as GET, handler as POST };
