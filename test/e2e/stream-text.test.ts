import { createTestServer } from "@ai-sdk/test-server/with-vitest";
import { streamText } from "ai";
import { describe, expect, it } from "vitest";
import { createQuiver } from "../../src";
import {
  generateStreamChunksFixture,
  multiOutputGenerateStreamChunksFixture,
  vectorizeStreamChunksFixture,
} from "../../src/language-model/__fixtures__/quiverai-fixtures";

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
      model: provider("arrow-preview"),
      prompt: "Draw a square icon.",
      providerOptions: {
        quiverai: {
          operation: "generate",
        },
      },
    });

    expect(await result.text).toBe('<svg><path d="M0 0L10 10"/></svg>');
    expect(await result.reasoningText).toBe('<svg><path d="M0 0');
    const files = await result.files;
    expect(files).toHaveLength(1);
    expect(files[0].mediaType).toBe("image/svg+xml");
  });

  it("streams vectorized SVG text", async () => {
    const provider = createQuiver({ apiKey: "test-api-key", fetch });
    const result = streamText({
      model: provider("arrow-preview"),
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
        quiverai: {
          operation: "vectorize",
        },
      },
    });

    expect(await result.text).toBe(
      '<svg viewBox="0 0 4 4"><path d="M0 0L4 4"/></svg>',
    );
    const files = await result.files;
    expect(files).toHaveLength(1);
    expect(files[0].mediaType).toBe("image/svg+xml");
  });

  it("streams multi-output SVGs as JSON lines on a single text stream", async () => {
    server.urls["https://api.quiver.ai/v1/svgs/generations"].response = {
      type: "stream-chunks",
      chunks: multiOutputGenerateStreamChunksFixture,
    };

    const provider = createQuiver({ apiKey: "test-api-key", fetch });
    const result = streamText({
      model: provider("arrow-preview"),
      prompt: "Draw two icon variants.",
      providerOptions: {
        quiverai: {
          operation: "generate",
          n: 2,
        },
      },
    });

    const text = await result.text;
    const events = text
      .trim()
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line));

    expect(events).toEqual([
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

    const byIndex = new Map<number, string>();
    for (const event of events) {
      byIndex.set(event.index, event.svg);
    }
    expect(byIndex.get(0)).toBe('<svg><rect width="10" height="10"/></svg>');
    expect(byIndex.get(1)).toBe('<svg><circle cx="5" cy="5" r="4"/></svg>');
  });
});
