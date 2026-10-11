import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

vi.mock("./query-persister", () => ({ clearSavedData: vi.fn().mockResolvedValue(undefined) }));

import { clearSavedData } from "./query-persister";
import { claimDevice, fallBackToLastConfirmedOwner, releaseDevice, useDeviceOwner } from "./device-owner";

const alice = "calice000000000000000000";
const bob = "cbob00000000000000000000";

describe("device owner", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    localStorage.clear();
    useDeviceOwner.setState({ owner: undefined, verified: false });
    vi.mocked(clearSavedData).mockClear();
    queryClient = new QueryClient();
  });

  it("keeps saved data when the same user is confirmed again", async () => {
    await claimDevice(queryClient, alice);
    await claimDevice(queryClient, alice);

    expect(clearSavedData).not.toHaveBeenCalled();
    expect(useDeviceOwner.getState()).toEqual({ owner: alice, verified: true });
  });

  it("deletes the previous user's data before another user's loads", async () => {
    await claimDevice(queryClient, alice);
    queryClient.setQueryData(["secret"], "alice's data");

    await claimDevice(queryClient, bob);

    expect(clearSavedData).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(["secret"])).toBeUndefined();
    expect(useDeviceOwner.getState()).toEqual({ owner: bob, verified: true });
  });

  it("unsets the old owner before clearing, so a late load of its data is dropped", async () => {
    await claimDevice(queryClient, alice);
    let ownerDuringClear: string | undefined = "not called";
    vi.mocked(clearSavedData).mockImplementationOnce(async () => {
      ownerDuringClear = useDeviceOwner.getState().owner;
    });

    await claimDevice(queryClient, bob);

    expect(ownerDuringClear).toBeUndefined();
  });

  it("never falls back to the old owner while switching to a new one", async () => {
    await claimDevice(queryClient, alice);
    let fallbackOwner: string | undefined;
    vi.mocked(clearSavedData).mockImplementationOnce(async () => {
      fallBackToLastConfirmedOwner();
      fallbackOwner = useDeviceOwner.getState().owner;
    });

    await claimDevice(queryClient, bob);

    expect(fallbackOwner).toBe(bob);
  });

  it("loads the last confirmed user's data offline, unverified", async () => {
    await claimDevice(queryClient, alice);
    useDeviceOwner.setState({ owner: undefined, verified: false });

    fallBackToLastConfirmedOwner();

    expect(useDeviceOwner.getState()).toEqual({ owner: alice, verified: false });
  });

  it("clears the fallback owner's loaded data when the server confirms someone else", async () => {
    await claimDevice(queryClient, alice);
    localStorage.clear();
    useDeviceOwner.setState({ owner: alice, verified: false });

    await claimDevice(queryClient, bob);

    expect(clearSavedData).toHaveBeenCalledOnce();
  });

  it("forgets the owner when the session has ended", async () => {
    await claimDevice(queryClient, alice);

    await releaseDevice(queryClient);
    fallBackToLastConfirmedOwner();

    expect(clearSavedData).toHaveBeenCalledOnce();
    expect(useDeviceOwner.getState()).toEqual({ owner: undefined, verified: false });
  });
});
