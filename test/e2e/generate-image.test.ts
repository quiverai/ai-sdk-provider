import { createTestServer } from "@ai-sdk/test-server/with-vitest";
import { generateImage } from "ai";
import { describe, expect, it } from "vitest";
import {
  generateSvgResponseFixture,
  vectorizeSvgResponseFixture,
} from "../../src/__fixtures__/quiverai-fixtures";
import { createQuiverAI } from "../../src";

const decoder = new TextDecoder();
const canonicalModelIds = ["arrow-1", "arrow-1.1", "arrow-1.1-max"] as const;

const server = createTestServer({
  "https://api.quiver.ai/v1/svgs/generations": {
    response: {
      type: "json-value",
      body: generateSvgResponseFixture,
    },
  },
  "https://api.quiver.ai/v1/svgs/vectorizations": {
    response: {
      type: "json-value",
      body: vectorizeSvgResponseFixture,
    },
  },
});
void server;

describe("generateImage e2e", () => {
  it("generates SVG image data through the image provider export for all canonical models", async () => {
    const provider = createQuiverAI({ apiKey: "test-api-key", fetch });

    for (const modelId of canonicalModelIds) {
      const result = await generateImage({
        model: provider.image(modelId),
        prompt: "Draw a square icon.",
      });

      expect(result.images).toHaveLength(1);
      expect(decoder.decode(result.image.uint8Array)).toBe(
        generateSvgResponseFixture.data[0].svg,
      );
      expect(result.providerMetadata.quiverai).toEqual({
        images: [{ index: 0, mimeType: "image/svg+xml" }],
      });
      expect(result.responses[0].modelId).toBe(modelId);
      expect(result.usage).toEqual({
        inputTokens: 12,
        outputTokens: 9,
        totalTokens: 21,
      });
    }
  });

  it("vectorizes an input image through the same generateImage surface", async () => {
    const provider = createQuiverAI({ apiKey: "test-api-key", fetch });
    const result = await generateImage({
      model: provider.image("arrow-1"),
      prompt: {
        images: [new Uint8Array([1, 2, 3])],
      },
      providerOptions: {
        quiverai: {
          operation: "vectorize",
        },
      },
    });

    expect(decoder.decode(result.image.uint8Array)).toBe(
      vectorizeSvgResponseFixture.data[0].svg,
    );
    expect(result.providerMetadata.quiverai).toEqual({
      images: [{ index: 0, mimeType: "image/svg+xml" }],
    });
    expect(result.usage).toEqual({
      inputTokens: 11,
      outputTokens: 7,
      totalTokens: 18,
    });
  });
});
