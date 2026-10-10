import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    name: "@baby-atlas/mcp-server",
    include: ["src/**/*.test.ts"],
  },
});
