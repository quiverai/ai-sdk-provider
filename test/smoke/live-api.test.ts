import { generateImage } from "ai";
import { describe, expect, it } from "vitest";
import { createQuiverAI } from "../../src";

const runLiveSmoke = process.env.QUIVERAI_LIVE_SMOKE === "1";

if (runLiveSmoke && process.env.QUIVERAI_API_KEY == null) {
  throw new Error("QUIVERAI_LIVE_SMOKE=1 requires QUIVERAI_API_KEY to be set.");
}

describe.skipIf(!runLiveSmoke)("live Quiver smoke", () => {
  it("generates a real SVG via api.quiver.ai", async () => {
    const provider = createQuiverAI({
      apiKey: process.env.QUIVERAI_API_KEY,
    });

    const result = await generateImage({
      model: provider.image(process.env.QUIVERAI_SMOKE_MODEL_ID ?? "arrow-1"),
      prompt: "A simple black square icon in SVG.",
    });

    const svg = new TextDecoder().decode(result.image.uint8Array);

    expect(svg).toContain("<svg");
    expect(result.providerMetadata.quiverai.images).toEqual([
      { index: 0, mimeType: "image/svg+xml" },
    ]);
    expect(result.responses[0].modelId).toBe(
      process.env.QUIVERAI_SMOKE_MODEL_ID ?? "arrow-1",
    );
  }, 90_000);
});
