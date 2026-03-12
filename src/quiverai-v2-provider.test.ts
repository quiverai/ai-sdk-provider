import { LanguageModelV2CallOptions, NoSuchModelError } from "@ai-sdk/provider";
import { createTestServer } from "@ai-sdk/test-server/with-vitest";
import { describe, expect, it } from "vitest";
import { generateSvgResponseFixture } from "./language-model/__fixtures__/quiverai-fixtures";
import { createQuiverV2 } from "./quiverai-v2-provider";

const server = createTestServer({
  "https://api.quiver.ai/v1/svgs/generations": {
    response: {
      type: "json-value",
      body: generateSvgResponseFixture,
    },
  },
});

const generateOptions = {
  prompt: [
    {
      role: "user",
      content: [{ type: "text", text: "Draw a square icon." }],
    },
  ],
  providerOptions: {
    quiverai: {
      operation: "generate",
    },
  },
} satisfies LanguageModelV2CallOptions;

describe("createQuiverV2", () => {
  it("creates callable V2 models and keeps the standard aliases", async () => {
    const provider = createQuiverV2({ apiKey: "test-api-key" });

    expect(provider("arrow-preview").specificationVersion).toBe("v2");
    expect(provider.languageModel("arrow-preview").modelId).toBe(
      "arrow-preview",
    );
    expect(provider.chat("arrow-preview").provider).toBe("quiverai");

    const result = await provider("arrow-preview").doGenerate(generateOptions);

    expect(result.content).toEqual([
      { type: "text", text: generateSvgResponseFixture.data[0].svg },
    ]);
    expect(server.calls[0].requestHeaders.authorization).toBe(
      "Bearer test-api-key",
    );
  });

  it("throws for unsupported model factories", () => {
    const provider = createQuiverV2({ apiKey: "test-api-key" });

    expect(() => provider.textEmbeddingModel("embed-model")).toThrow(
      NoSuchModelError,
    );
    expect(() => provider.imageModel("image-model")).toThrow(NoSuchModelError);
  });
});
