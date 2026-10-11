import { describe, expect, it, vi } from "vitest";
import SuperJSON from "superjson";

const saved = SuperJSON.stringify({ timestamp: 1, buster: "1", clientState: { queries: [], mutations: [] } });
vi.mock("idb-keyval", () => ({
  get: vi.fn(async () => saved),
  set: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(async () => []),
}));

import { createQueryPersister } from "./query-persister";

const alice = "calice000000000000000000";

describe("createQueryPersister", () => {
  it("restores the saved data while its owner is current", async () => {
    const persister = createQueryPersister(alice, () => true);

    expect(await persister.restoreClient()).toMatchObject({ timestamp: 1 });
  });

  it("drops the saved data when another user was confirmed during the read", async () => {
    const persister = createQueryPersister(alice, () => false);

    expect(await persister.restoreClient()).toBeUndefined();
  });
});
