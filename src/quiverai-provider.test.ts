import { LanguageModelV3CallOptions, NoSuchModelError } from "@ai-sdk/provider";
import { createTestServer } from "@ai-sdk/test-server/with-vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateSvgResponseFixture } from "./language-model/__fixtures__/quiverai-fixtures";
import { createQuiver } from "./quiverai-provider";

const encoder = new TextEncoder();

const server = createTestServer({
  "https://api.quiver.ai/v1/svgs/generations": {
    response: {
      type: "json-value",
      body: generateSvgResponseFixture,
    },
  },
  "https://env.quiver.ai/v1/svgs/generations": {
    response: {
      type: "json-value",
      body: generateSvgResponseFixture,
    },
  },
  "https://override.quiver.ai/v1/svgs/generations": {
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
} satisfies LanguageModelV3CallOptions;

describe("createQuiver", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the default base URL and auth headers", async () => {
    const provider = createQuiver({ apiKey: "test-api-key" });
    const result = await provider("arrow-preview").doGenerate(generateOptions);

    expect(result.content).toEqual([
      { type: "text", text: generateSvgResponseFixture.data[0].svg },
      {
        type: "file",
        mediaType: "image/svg+xml",
        data: encoder.encode(generateSvgResponseFixture.data[0].svg),
      },
    ]);
    expect(server.calls).toHaveLength(1);
    expect(server.calls[0].requestUrl).toBe(
      "https://api.quiver.ai/v1/svgs/generations",
    );
    expect(server.calls[0].requestHeaders).toMatchObject({
      authorization: "Bearer test-api-key",
      "content-type": "application/json",
    });
    expect(server.calls[0].requestUserAgent).toContain("ai-sdk/quiverai/");
  });

  it("reads the base URL and API key from the environment", async () => {
    vi.stubEnv("QUIVERAI_API_KEY", "env-api-key");
    vi.stubEnv("QUIVERAI_BASE_URL", "https://env.quiver.ai/v1");

    const provider = createQuiver();
    await provider.chat("arrow-preview").doGenerate(generateOptions);

    expect(server.calls).toHaveLength(1);
    expect(server.calls[0].requestUrl).toBe(
      "https://env.quiver.ai/v1/svgs/generations",
    );
    expect(server.calls[0].requestHeaders.authorization).toBe(
      "Bearer env-api-key",
    );
  });

  it("prefers explicit options and exposes the standard factory methods", async () => {
    vi.stubEnv("QUIVERAI_API_KEY", "env-api-key");
    vi.stubEnv("QUIVERAI_BASE_URL", "https://env.quiver.ai/v1");

    const provider = createQuiver({
      apiKey: "override-api-key",
      baseURL: "https://override.quiver.ai/v1",
      headers: { "X-QuiverAI-Test": "1" },
    });

    expect(provider("arrow-preview").modelId).toBe("arrow-preview");
    expect(provider.languageModel("arrow-preview").modelId).toBe(
      "arrow-preview",
    );
    expect(provider.chat("arrow-preview").provider).toBe("quiverai");

    await provider("arrow-preview").doGenerate(generateOptions);

    expect(server.calls[0].requestUrl).toBe(
      "https://override.quiver.ai/v1/svgs/generations",
    );
    expect(server.calls[0].requestHeaders).toMatchObject({
      authorization: "Bearer override-api-key",
      "x-quiverai-test": "1",
    });
  });

  it("throws for unsupported embedding and image models", () => {
    const provider = createQuiver({ apiKey: "test-api-key" });

    expect(() => provider.embeddingModel("embed-model")).toThrow(
      NoSuchModelError,
    );
    expect(() => provider.imageModel("image-model")).toThrow(NoSuchModelError);
  });
});
