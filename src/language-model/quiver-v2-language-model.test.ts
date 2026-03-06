import {
  APICallError,
  LanguageModelV2CallOptions,
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
} from "./__fixtures__/quiver-fixtures";
import { QuiverV2LanguageModel } from "./quiver-v2-language-model";

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

const model = new QuiverV2LanguageModel("quiver-svg", config);

const generateOptions = {
  prompt: [
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
      model: "quiver-svg",
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
  });

  it("supports QuiverAI n for non-streaming V2 calls", async () => {
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
    expect(result.providerMetadata?.quiver).toEqual({
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

  it("maps stream parts into V2 reasoning/text deltas", async () => {
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
});
