import { generateText, streamText } from "ai";
import { describe, expect, it } from "vitest";
import { createQuiver } from "../../src";

const runRealApiSmokeTest =
  process.env.RUN_REAL_API_SMOKE_TEST === "true" &&
  process.env.QUIVER_API_KEY != null;

describe.skipIf(!runRealApiSmokeTest)("real api smoke", () => {
  it("calls QuiverAI generate with n=2 and returns provider metadata", async () => {
    const provider = createQuiver({
      apiKey: process.env.QUIVER_API_KEY,
      baseURL: process.env.QUIVER_BASE_URL,
    });

    const result = await generateText({
      model: provider(process.env.QUIVER_MODEL_ID ?? "arrow-preview"),
      prompt: "Generate a simple geometric SVG icon.",
      maxOutputTokens: 256,
      providerOptions: {
        quiver: {
          operation: "generate",
          n: 2,
        },
      },
    });

    expect(result.text.length).toBeGreaterThan(0);
    expect(result.providerMetadata?.quiver).toMatchObject({
      outputCount: 2,
    });
  }, 300_000);

  it("streams QuiverAI generate output", async () => {
    const provider = createQuiver({
      apiKey: process.env.QUIVER_API_KEY,
      baseURL: process.env.QUIVER_BASE_URL,
    });

    const result = streamText({
      model: provider(process.env.QUIVER_MODEL_ID ?? "arrow-preview"),
      prompt: "Generate a simple geometric SVG icon.",
      maxOutputTokens: 256,
      providerOptions: {
        quiver: {
          operation: "generate",
        },
      },
    });

    expect((await result.text).length).toBeGreaterThan(0);
    expect(await result.reasoningText).toContain("<svg");
  }, 300_000);
});
