import { describe, expect, it } from "vitest";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { streamSvg, StreamSvgEvent } from "./stream-svg";

const toTextStream = (chunks: string[]): AsyncIterable<string> => {
  return (async function* () {
    for (const chunk of chunks) {
      yield chunk;
    }
  })();
};

describe("streamSvg", () => {
  it("parses NDJSON and yields files per content event", async () => {
    const events: StreamSvgEvent[] = [
      { index: 0, type: "draft", svg: "<svg>", usage: undefined },
      {
        index: 0,
        type: "content",
        svg: "<svg><rect/></svg>",
        usage: { total_tokens: 10 },
      },
      {
        index: 1,
        type: "content",
        svg: "<svg><circle/></svg>",
        usage: { total_tokens: 12 },
      },
    ];

    const payload =
      events.map((event) => JSON.stringify(event)).join("\n") + "\n";
    let receivedOpts: Record<string, unknown> | undefined;
    const ai = {
      streamText: (opts: Record<string, unknown>) => {
        receivedOpts = opts;
        return {
          textStream: toTextStream([payload.slice(0, 20), payload.slice(20)]),
        };
      },
    };

    const results = [];
    for await (const result of streamSvg(ai, {
      model: {} as LanguageModelV3,
      n: 2,
      prompt: "Draw",
      onEvent: () => undefined,
    })) {
      results.push(result);
    }

    expect(results).toHaveLength(2);
    expect(results[0].index).toBe(0);
    expect(results[0].usage).toEqual({ total_tokens: 10 });
    expect(results[1].index).toBe(1);
    expect(results[1].usage).toEqual({ total_tokens: 12 });
    expect(receivedOpts).not.toHaveProperty("onEvent");
  });

  it("handles default n=1 plain text stream output", async () => {
    const ai = {
      streamText: () => ({
        textStream: toTextStream(["<svg>", "<rect/>", "</svg>"]),
      }),
    };

    const results = [];
    for await (const result of streamSvg(ai, {
      model: {} as LanguageModelV3,
      prompt: "Draw",
    })) {
      results.push(result);
    }

    expect(results).toHaveLength(1);
    expect(results[0].index).toBe(0);
    expect(new TextDecoder().decode(results[0].file.uint8Array)).toBe(
      "<svg><rect/></svg>",
    );
  });
});
