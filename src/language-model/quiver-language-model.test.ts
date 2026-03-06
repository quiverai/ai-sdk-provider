import {
  APICallError,
  LanguageModelV3CallOptions,
  UnsupportedFunctionalityError,
} from "@ai-sdk/provider";
import {
  convertReadableStreamToArray,
  mockId,
} from "@ai-sdk/provider-utils/test";
import { createTestServer } from "@ai-sdk/test-server/with-vitest";
import { describe, expect, it } from "vitest";
import { createQuiverConfig } from "../quiver-config";
import {
  generateStreamChunksFixture,
  generateSvgResponseFixture,
  malformedSvgResponseFixture,
  multiOutputSvgResponseFixture,
  resetStreamChunksFixture,
  vectorizeSvgResponseFixture,
} from "./__fixtures__/quiver-fixtures";
import { QuiverLanguageModel } from "./quiver-language-model";

const server = createTestServer({
  "https://api.quiver.ai/v1/svgs/generations": {
    response: {
      type: "json-value",
      body: generateSvgResponseFixture,
      headers: { "x-request-id": "req-gen" },
    },
  },
  "https://api.quiver.ai/v1/svgs/vectorizations": {
    response: {
      type: "json-value",
      body: vectorizeSvgResponseFixture,
    },
  },
});

const config = createQuiverConfig({
  apiKey: "test-api-key",
  generateId: mockId({ prefix: "reasoning" }),
});

const model = new QuiverLanguageModel("quiver-svg", config);

const generateOptions = {
  prompt: [
    {
      role: "system",
      content: "Keep the SVG compact.",
    },
    {
      role: "user",
      content: [{ type: "text", text: "Draw a square icon." }],
    },
  ],
  providerOptions: {
    quiver: {
      operation: "generate",
    },
  },
  headers: {
    "X-Test-Header": "yes",
  },
} satisfies LanguageModelV3CallOptions;

describe("QuiverLanguageModel", () => {
  it("maps doGenerate results, usage, request metadata, and headers", async () => {
    const result = await model.doGenerate(generateOptions);

    expect(result.content).toEqual([
      { type: "text", text: generateSvgResponseFixture.data[0].svg },
    ]);
    expect(result.finishReason).toEqual({ raw: "stop", unified: "stop" });
    expect(result.usage).toEqual({
      inputTokens: {
        total: 12,
        noCache: 12,
        cacheRead: undefined,
        cacheWrite: undefined,
      },
      outputTokens: {
        total: 18,
        text: 18,
        reasoning: undefined,
      },
      raw: generateSvgResponseFixture.usage,
    });
    expect(result.request).toEqual({
      body: {
        model: "quiver-svg",
        n: 1,
        stream: false,
        temperature: undefined,
        top_p: undefined,
        max_output_tokens: undefined,
        presence_penalty: undefined,
        instructions: "Keep the SVG compact.",
        prompt: "Draw a square icon.",
        references: undefined,
      },
    });
    expect(result.response).toMatchObject({
      id: "svg-gen-1",
      modelId: "quiver-svg",
      headers: {
        "content-type": "application/json",
        "x-request-id": "req-gen",
      },
    });
    expect(result.providerMetadata).toEqual({
      quiver: {
        outputCount: 1,
        outputs: [
          {
            index: 0,
            svg: generateSvgResponseFixture.data[0].svg,
            mimeType: "image/svg+xml",
          },
        ],
      },
    });
    expect(server.calls[0].requestHeaders).toMatchObject({
      authorization: "Bearer test-api-key",
      "x-test-header": "yes",
    });
  });

  it("maps vectorize requests and returns the final SVG as text", async () => {
    const result = await model.doGenerate({
      prompt: [
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
          autoCrop: true,
          targetSize: 512,
        },
      },
    });

    expect(result.content).toEqual([
      { type: "text", text: vectorizeSvgResponseFixture.data[0].svg },
    ]);
    expect(await server.calls[0].requestBodyJson).toEqual({
      model: "quiver-svg",
      n: 1,
      stream: false,
      temperature: undefined,
      top_p: undefined,
      max_output_tokens: undefined,
      presence_penalty: undefined,
      image: { base64: "AQID" },
      auto_crop: true,
      target_size: 512,
    });
  });

  it("returns warnings for unsupported settings", async () => {
    const result = await model.doGenerate({
      ...generateOptions,
      topK: 32,
      frequencyPenalty: 0.2,
      seed: 7,
      stopSequences: ["</svg>"],
    });

    expect(result.warnings).toEqual([
      { type: "unsupported", feature: "topK" },
      { type: "unsupported", feature: "frequencyPenalty" },
      { type: "unsupported", feature: "seed" },
      { type: "unsupported", feature: "stopSequences" },
    ]);
  });

  it("supports QuiverAI n for non-streaming calls and exposes all outputs", async () => {
    server.urls["https://api.quiver.ai/v1/svgs/generations"].response = {
      type: "json-value",
      body: multiOutputSvgResponseFixture,
    };

    const result = await model.doGenerate({
      ...generateOptions,
      providerOptions: {
        quiver: {
          operation: "generate",
          n: 2,
        },
      },
    });

    expect(result.content).toEqual([
      { type: "text", text: multiOutputSvgResponseFixture.data[0].svg },
    ]);
    expect(result.providerMetadata).toEqual({
      quiver: {
        outputCount: 2,
        outputs: [
          {
            index: 0,
            svg: multiOutputSvgResponseFixture.data[0].svg,
            mimeType: "image/svg+xml",
          },
          {
            index: 1,
            svg: multiOutputSvgResponseFixture.data[1].svg,
            mimeType: "image/svg+xml",
          },
        ],
      },
    });
    expect(await server.calls[0].requestBodyJson).toMatchObject({
      n: 2,
    });
  });

  it("rejects streaming with QuiverAI n > 1", async () => {
    await expect(
      model.doStream({
        ...generateOptions,
        providerOptions: {
          quiver: {
            operation: "generate",
            n: 2,
          },
        },
      }),
    ).rejects.toBeInstanceOf(UnsupportedFunctionalityError);
  });

  it("throws on malformed successful responses", async () => {
    server.urls["https://api.quiver.ai/v1/svgs/generations"].response = {
      type: "json-value",
      body: malformedSvgResponseFixture,
    };

    await expect(model.doGenerate(generateOptions)).rejects.toSatisfy(
      (error) => {
        return (
          APICallError.isInstance(error) &&
          error.message.includes("Invalid JSON response")
        );
      },
    );
  });

  it("maps streaming draft/content snapshots into reasoning and text parts", async () => {
    server.urls["https://api.quiver.ai/v1/svgs/generations"].response = {
      type: "stream-chunks",
      chunks: generateStreamChunksFixture,
      headers: { "x-request-id": "req-stream" },
    };

    const result = await model.doStream({
      ...generateOptions,
      includeRawChunks: true,
    });
    const parts = await convertReadableStreamToArray(result.stream);

    expect(parts).toMatchSnapshot();
    expect(result.request).toEqual({
      body: {
        model: "quiver-svg",
        n: 1,
        stream: true,
        temperature: undefined,
        top_p: undefined,
        max_output_tokens: undefined,
        presence_penalty: undefined,
        instructions: "Keep the SVG compact.",
        prompt: "Draw a square icon.",
        references: undefined,
      },
    });
    expect(result.response).toEqual({
      headers: {
        "cache-control": "no-cache",
        connection: "keep-alive",
        "content-type": "text/event-stream",
        "x-request-id": "req-stream",
      },
    });
  });

  it("restarts the active reasoning or text block when snapshots reset", async () => {
    server.urls["https://api.quiver.ai/v1/svgs/generations"].response = {
      type: "stream-chunks",
      chunks: resetStreamChunksFixture,
    };

    const result = await model.doStream(generateOptions);
    const parts = await convertReadableStreamToArray(result.stream);

    expect(parts).toMatchSnapshot();
  });
});
