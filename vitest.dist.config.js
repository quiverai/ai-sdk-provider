import { defineConfig } from "vitest/config";
import { readFileSync } from "node:fs";

const version = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
).version;

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/package-smoke.test.ts"],
  },
  define: {
    __PACKAGE_VERSION__: JSON.stringify(version),
  },
});
