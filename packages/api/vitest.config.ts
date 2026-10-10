import { defineProject } from "vitest/config";
import path from "path";

export default defineProject({
  resolve: {
    alias: {
      "@baby-atlas/utils": path.resolve(__dirname, "../utils/src"),
      "@baby-atlas/schemas": path.resolve(__dirname, "../schemas/src"),
      "@baby-atlas/db": path.resolve(__dirname, "../db/src"),
    },
  },
  test: {
    name: "@baby-atlas/api",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
