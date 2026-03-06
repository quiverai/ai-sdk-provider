import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  sourcemap: true,
  external: ["@ai-sdk/provider", "@ai-sdk/provider-utils", "zod"],
  define: {
    __PACKAGE_VERSION__: JSON.stringify(
      (await import("./package.json", { with: { type: "json" } })).default
        .version,
    ),
  },
});
