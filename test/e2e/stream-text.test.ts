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
const decoder = new TextDecoder();

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

  it("streams multi-output SVGs with n=2", async () => {
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

    const parts = [];
    for await (const part of result.fullStream) {
      parts.push(part);
    }

    const finishIndex = parts.findIndex((part) => part.type === "finish");
    expect(finishIndex).toBeGreaterThan(0);
    expect(
      parts
        .slice(0, finishIndex)
        .some((part) => part.type === "text-delta" || part.type === "file"),
    ).toBe(true);

    const textStarts = parts.filter((part) => part.type === "text-start");
    const textDeltas = parts.filter((part) => part.type === "text-delta");
    expect(textStarts).toHaveLength(2);
    expect(new Set(textDeltas.map((part) => part.id)).size).toBe(2);

    const fileParts = parts.filter((part) => part.type === "file");
    expect(fileParts).toHaveLength(2);
    expect(fileParts[0].file.mediaType).toBe("image/svg+xml");
    expect(fileParts[1].file.mediaType).toBe("image/svg+xml");
    expect(decoder.decode(fileParts[0].file.uint8Array)).toBe(
      '<svg><rect width="10" height="10"/></svg>',
    );
    expect(decoder.decode(fileParts[1].file.uint8Array)).toBe(
      '<svg><circle cx="5" cy="5" r="4"/></svg>',
    );
  });
});
