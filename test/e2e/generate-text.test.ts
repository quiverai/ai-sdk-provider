import { createTestServer } from "@ai-sdk/test-server/with-vitest";
import { generateText } from "ai";
import { describe, expect, it } from "vitest";
import { createQuiver, createQuiverV2 } from "../../src";
import {
  generateSvgResponseFixture,
  vectorizeSvgResponseFixture,
} from "../../src/language-model/__fixtures__/quiver-fixtures";

const server = createTestServer({
  "https://api.quiver.ai/v1/svgs/generations": {
    response: [
      {
        type: "json-value",
        body: generateSvgResponseFixture,
      },
      {
        type: "json-value",
        body: generateSvgResponseFixture,
      },
    ],
  },
  "https://api.quiver.ai/v1/svgs/vectorizations": {
    response: {
      type: "json-value",
      body: vectorizeSvgResponseFixture,
    },
  },
});
void server;

describe("generateText e2e", () => {
  it("generates SVG text through the V3 provider export", async () => {
    const provider = createQuiver({ apiKey: "test-api-key", fetch });
    const result = await generateText({
      model: provider("quiver-svg"),
      system: "Keep the output compact.",
      prompt: "Draw a square icon.",
      providerOptions: {
        quiver: {
          operation: "generate",
        },
      },
    });

    expect(result.text).toBe(generateSvgResponseFixture.data[0].svg);
    expect(result.finishReason).toBe("stop");
  });

  it("vectorizes an image through the V3 provider export", async () => {
    const provider = createQuiver({ apiKey: "test-api-key", fetch });
    const result = await generateText({
      model: provider("quiver-svg"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "file",
              mediaType: "image/png",
              data: new Uint8Array([1, 2, 3]),
            },
          ],
        },
      ],
      providerOptions: {
        quiver: {
          operation: "vectorize",
        },
      },
    });

    expect(result.text).toBe(vectorizeSvgResponseFixture.data[0].svg);
  });

  it("supports the V2 provider export in generateText", async () => {
    const provider = createQuiverV2({ apiKey: "test-api-key", fetch });
    const result = await generateText({
      model: provider("quiver-svg"),
      prompt: "Draw a square icon.",
      providerOptions: {
        quiver: {
          operation: "generate",
        },
      },
    });

    expect(result.text).toBe(generateSvgResponseFixture.data[0].svg);
  });
});
