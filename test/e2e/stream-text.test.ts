import { createTestServer } from "@ai-sdk/test-server/with-vitest";
import { streamText } from "ai";
import { describe, expect, it } from "vitest";
import { createQuiver } from "../../src";
import {
  generateStreamChunksFixture,
  vectorizeStreamChunksFixture,
} from "../../src/language-model/__fixtures__/quiver-fixtures";

const server = createTestServer({
  "https://api.quiver.ai/v1/svgs/generations": {
    response: {
      type: "stream-chunks",
      chunks: generateStreamChunksFixture,
    },
  },
  "https://api.quiver.ai/v1/svgs/vectorizations": {
    response: {
      type: "stream-chunks",
      chunks: vectorizeStreamChunksFixture,
    },
  },
});
void server;

describe("streamText e2e", () => {
  it("maps draft deltas to reasoning and content snapshots to text", async () => {
    const provider = createQuiver({ apiKey: "test-api-key", fetch });
    const result = streamText({
      model: provider("quiver-svg"),
      prompt: "Draw a square icon.",
      providerOptions: {
        quiver: {
          operation: "generate",
        },
      },
    });

    expect(await result.text).toBe('<svg><path d="M0 0L10 10"/></svg>');
    expect(await result.reasoningText).toBe('<svg><path d="M0 0');
  });

  it("streams vectorized SVG text", async () => {
    const provider = createQuiver({ apiKey: "test-api-key", fetch });
    const result = streamText({
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

    expect(await result.text).toBe(
      '<svg viewBox="0 0 4 4"><path d="M0 0L4 4"/></svg>',
    );
  });
});
