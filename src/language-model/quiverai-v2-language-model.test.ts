import { APICallError, LanguageModelV2CallOptions } from "@ai-sdk/provider";
import {
  convertReadableStreamToArray,
  mockId,
} from "@ai-sdk/provider-utils/test";
import { createTestServer } from "@ai-sdk/test-server/with-vitest";
import { describe, expect, it } from "vitest";
import { createQuiverConfig } from "../quiverai-config";
import {
  generateStreamChunksFixture,
  generateSvgResponseFixture,
  malformedSvgResponseFixture,
  malformedStreamChunksFixture,
  multiOutputGenerateStreamChunksFixture,
  multiOutputSvgResponseFixture,
  nonContentUsageStreamChunksFixture,
} from "./__fixtures__/quiverai-fixtures";
import { QuiverV2LanguageModel } from "./quiverai-v2-language-model";

const server = createTestServer({
  "https://api.quiver.ai/v1/svgs/generations": {
    response: {
      type: "json-value",
      body: generateSvgResponseFixture,
    },
  },
});

const config = createQuiverConfig({
  apiKey: "test-api-key",
  generateId: mockId({ prefix: "reasoning-v2" }),
});

const model = new QuiverV2LanguageModel("arrow-preview", config);

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

describe("QuiverV2LanguageModel", () => {
  it("maps doGenerate responses into V2 content and usage", async () => {
    const result = await model.doGenerate(generateOptions);

    expect(result.content).toEqual([
      { type: "text", text: generateSvgResponseFixture.data[0].svg },
    ]);
    expect(result.finishReason).toBe("stop");
    expect(result.usage).toEqual({
      inputTokens: 12,
      outputTokens: 18,
      totalTokens: 30,
      reasoningTokens: undefined,
      cachedInputTokens: undefined,
    });
    expect(result.request?.body).toEqual({
      model: "arrow-preview",
      n: 1,
      stream: false,
      temperature: undefined,
      top_p: undefined,
      max_output_tokens: undefined,
      presence_penalty: undefined,
      instructions: undefined,
      prompt: "Draw a square icon.",
      references: undefined,
    });
    expect(result.providerMetadata).toEqual({
      quiverai: {
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
  });

  it("supports QuiverAI n for non-streaming V2 calls", async () => {
    server.urls["https://api.quiver.ai/v1/svgs/generations"].response = {
      type: "json-value",
      body: multiOutputSvgResponseFixture,
    };

    const result = await model.doGenerate({
      ...generateOptions,
      providerOptions: {
        quiverai: {
          operation: "generate",
          n: 2,
        },
      },
    });

    expect(result.content).toEqual([
      { type: "text", text: multiOutputSvgResponseFixture.data[0].svg },
    ]);
    expect(result.providerMetadata?.quiverai).toEqual({
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
    });
  });

  it("maps QuiverAI stream parts into V2 reasoning/text deltas", async () => {
    server.urls["https://api.quiver.ai/v1/svgs/generations"].response = {
      type: "stream-chunks",
      chunks: generateStreamChunksFixture,
    };

    const result = await model.doStream({
      ...generateOptions,
      includeRawChunks: true,
    });
    const parts = await convertReadableStreamToArray(result.stream);

    expect(parts).toMatchSnapshot();
  });

  it("supports streaming with QuiverAI n > 1 as a single JSON text stream", async () => {
    server.urls["https://api.quiver.ai/v1/svgs/generations"].response = {
      type: "stream-chunks",
      chunks: multiOutputGenerateStreamChunksFixture,
    };

    const multiOutputModel = new QuiverV2LanguageModel(
      "arrow-preview",
      createQuiverConfig({
        apiKey: "test-api-key",
        generateId: mockId({ prefix: "multi-output-v2" }),
      }),
    );

    const result = await multiOutputModel.doStream({
      ...generateOptions,
      providerOptions: {
        quiverai: {
          operation: "generate",
          n: 2,
        },
      },
    });
    const parts = await convertReadableStreamToArray(result.stream);

    expect(result.request?.body).toMatchObject({
      n: 2,
      stream: true,
    });
    expect(
      parts.filter((part) => part.type === "reasoning-start"),
    ).toHaveLength(0);
    expect(parts.filter((part) => part.type === "text-start")).toHaveLength(1);

    const jsonLines = parts
      .filter((part) => part.type === "text-delta")
      .map((part) => part.delta)
      .join("")
      .trim()
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line));
    expect(jsonLines).toEqual([
      {
        index: 0,
        id: "svg-stream-0",
        type: "draft",
        svg: "<svg>",
      },
      {
        index: 1,
        id: "svg-stream-1",
        type: "draft",
        svg: "<svg>",
      },
      {
        index: 0,
        id: "svg-stream-0",
        type: "content",
        svg: '<svg><rect width="10" height="10"/></svg>',
      },
      {
        index: 1,
        id: "svg-stream-1",
        type: "content",
        svg: '<svg><circle cx="5" cy="5" r="4"/></svg>',
        usage: {
          total_tokens: 36,
          input_tokens: 12,
          output_tokens: 24,
        },
      },
    ]);
    expect(parts[parts.length - 1]).toEqual({
      type: "finish",
      finishReason: "stop",
      usage: {
        cachedInputTokens: undefined,
        inputTokens: 12,
        outputTokens: 24,
        reasoningTokens: undefined,
        totalTokens: 36,
      },
    });
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

  it("preserves usage reported on non-content stream chunks", async () => {
    server.urls["https://api.quiver.ai/v1/svgs/generations"].response = {
      type: "stream-chunks",
      chunks: nonContentUsageStreamChunksFixture,
    };

    const result = await model.doStream(generateOptions);
    const parts = await convertReadableStreamToArray(result.stream);

    expect(parts[parts.length - 1]).toEqual({
      type: "finish",
      finishReason: "stop",
      usage: {
        cachedInputTokens: undefined,
        inputTokens: 5,
        outputTokens: 6,
        reasoningTokens: undefined,
        totalTokens: 11,
      },
    });
  });

  it("finishes streams with an error reason when SSE parsing fails", async () => {
    server.urls["https://api.quiver.ai/v1/svgs/generations"].response = {
      type: "stream-chunks",
      chunks: malformedStreamChunksFixture,
    };

    const result = await model.doStream(generateOptions);
    const parts = await convertReadableStreamToArray(result.stream);

    expect(parts).toContainEqual({
      type: "error",
      error: expect.anything(),
    });
    expect(parts[parts.length - 1]).toEqual({
      type: "finish",
      finishReason: "error",
      usage: {
        cachedInputTokens: undefined,
        inputTokens: undefined,
        outputTokens: undefined,
        reasoningTokens: undefined,
        totalTokens: undefined,
      },
    });
  });
});
