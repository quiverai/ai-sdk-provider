import {
  ImageModelV3CallOptions,
  InvalidArgumentError,
  NoSuchModelError,
} from "@ai-sdk/provider";
import { createTestServer } from "@ai-sdk/test-server/with-vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateSvgResponseFixture,
  vectorizeSvgResponseFixture,
} from "./__fixtures__/quiverai-fixtures";
import { createQuiverImage } from "./quiverai-image-provider";

const decoder = new TextDecoder();

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
  "https://api.quiver.ai/v1/svgs/vectorizations": {
    response: {
      type: "json-value",
      body: vectorizeSvgResponseFixture,
    },
  },
});

const generateOptions: ImageModelV3CallOptions = {
  prompt: "Draw a square icon.",
  n: 1,
  size: undefined,
  aspectRatio: undefined,
  seed: undefined,
  files: undefined,
  mask: undefined,
  providerOptions: {},
};

describe("createQuiverImage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the default base URL and auth headers", async () => {
    const provider = createQuiverImage({ apiKey: "test-api-key" });
    const result = await provider("quiver-image-preview").doGenerate(
      generateOptions,
    );
    const image = result.images[0];

    expect(result.images).toHaveLength(1);
    expect(image).toBeInstanceOf(Uint8Array);
    expect(decoder.decode(image as Uint8Array)).toBe(
      generateSvgResponseFixture.data[0].svg,
    );
    expect(result.providerMetadata?.quiverai).toEqual({
      images: [{ index: 0, mimeType: "image/svg+xml" }],
    });
    expect(result.usage).toEqual({
      inputTokens: 12,
      outputTokens: 9,
      totalTokens: 21,
    });
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

    const provider = createQuiverImage();
    await provider
      .imageModel("quiver-image-preview")
      .doGenerate(generateOptions);

    expect(server.calls).toHaveLength(1);
    expect(server.calls[0].requestUrl).toBe(
      "https://env.quiver.ai/v1/svgs/generations",
    );
    expect(server.calls[0].requestHeaders.authorization).toBe(
      "Bearer env-api-key",
    );
  });

  it("prefers explicit options and exposes the image model factory methods", async () => {
    vi.stubEnv("QUIVERAI_API_KEY", "env-api-key");
    vi.stubEnv("QUIVERAI_BASE_URL", "https://env.quiver.ai/v1");

    const provider = createQuiverImage({
      apiKey: "override-api-key",
      baseURL: "https://override.quiver.ai/v1",
      headers: { "X-QuiverAI-Test": "1" },
    });

    expect(provider("quiver-image-preview").modelId).toBe(
      "quiver-image-preview",
    );
    expect(provider.imageModel("quiver-image-preview").provider).toBe(
      "quiverai",
    );

    await provider("quiver-image-preview").doGenerate(generateOptions);

    expect(server.calls[0].requestUrl).toBe(
      "https://override.quiver.ai/v1/svgs/generations",
    );
    expect(server.calls[0].requestHeaders).toMatchObject({
      authorization: "Bearer override-api-key",
      "x-quiverai-test": "1",
    });
  });

  it("throws for unsupported language and embedding models", () => {
    const provider = createQuiverImage({ apiKey: "test-api-key" });

    expect(() => provider.languageModel("chat-model")).toThrow(
      NoSuchModelError,
    );
    expect(() => provider.embeddingModel("embed-model")).toThrow(
      NoSuchModelError,
    );
  });

  it("vectorizes an image when requested through providerOptions", async () => {
    const provider = createQuiverImage({ apiKey: "test-api-key" });
    const result = await provider("quiver-image-preview").doGenerate({
      ...generateOptions,
      prompt: undefined,
      files: [
        {
          type: "file",
          mediaType: "image/png",
          data: new Uint8Array([1, 2, 3]),
        },
      ],
      providerOptions: { quiverai: { operation: "vectorize" } },
    });

    expect(decoder.decode(result.images[0] as Uint8Array)).toBe(
      vectorizeSvgResponseFixture.data[0].svg,
    );
    expect(server.calls[0].requestUrl).toBe(
      "https://api.quiver.ai/v1/svgs/vectorizations",
    );
    expect(await server.calls[0].requestBodyJson).toMatchObject({
      model: "quiver-image-preview",
      n: 1,
      image: {
        base64: "AQID",
      },
    });
  });

  it("fails fast when vectorize is requested without an input image", async () => {
    const provider = createQuiverImage({ apiKey: "test-api-key" });

    await expect(
      provider("quiver-image-preview").doGenerate({
        ...generateOptions,
        prompt: undefined,
        providerOptions: { quiverai: { operation: "vectorize" } },
      }),
    ).rejects.toBeInstanceOf(InvalidArgumentError);
  });
});
