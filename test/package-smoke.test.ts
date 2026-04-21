import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createTestServer } from "@ai-sdk/test-server/with-vitest";
import { describe, expect, it } from "vitest";
import { generateSvgResponseFixture } from "../src/__fixtures__/quiverai-fixtures";

const require = createRequire(import.meta.url);
const decoder = new TextDecoder();

const server = createTestServer({
  "https://api.quiver.ai/v1/svgs/generations": {
    response: {
      type: "json-value",
      body: generateSvgResponseFixture,
    },
  },
});
void server;

describe("dist smoke", () => {
  it("supports the published ESM and CJS entrypoints", async () => {
    const esm = await import(new URL("../dist/index.js", import.meta.url).href);
    const cjs = require(
      fileURLToPath(new URL("../dist/index.cjs", import.meta.url)),
    );

    const esmProvider = esm.createQuiverAI({ apiKey: "test-api-key", fetch });
    const cjsProvider = cjs.createQuiverAI({ apiKey: "test-api-key", fetch });

    const esmResult = await esmProvider.image("arrow-1").doGenerate({
      prompt: "Draw a square icon.",
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      files: undefined,
      mask: undefined,
      providerOptions: {},
    });
    const cjsResult = await cjsProvider.image("arrow-1").doGenerate({
      prompt: "Draw a square icon.",
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      files: undefined,
      mask: undefined,
      providerOptions: {},
    });

    expect(typeof esm.VERSION).toBe("string");
    expect(typeof cjs.VERSION).toBe("string");
    expect(decoder.decode(esmResult.images[0] as Uint8Array)).toBe(
      generateSvgResponseFixture.data[0].svg,
    );
    expect(decoder.decode(cjsResult.images[0] as Uint8Array)).toBe(
      generateSvgResponseFixture.data[0].svg,
    );
    expect(esmResult.response.modelId).toBe("arrow-1");
    expect(cjsResult.response.modelId).toBe("arrow-1");
  });
});
