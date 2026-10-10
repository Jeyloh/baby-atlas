import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@baby-atlas/schemas",
    include: ["src/**/*.test.ts"],
  },
});
