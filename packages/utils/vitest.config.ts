import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@baby-atlas/utils",
    include: ["src/**/*.test.ts"],
  },
});
