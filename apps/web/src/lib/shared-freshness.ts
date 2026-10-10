/**
 * Query options for data that other caregivers change: refetch when the app
 * comes back to the foreground and every 30 seconds while it is open, so a
 * partner's diaper or running sleep shows up without a manual reload.
 */
export const sharedFreshness = {
  refetchOnWindowFocus: true,
  refetchInterval: 30_000,
  refetchIntervalInBackground: false,
} as const;
