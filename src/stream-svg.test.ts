import { describe, expect, it } from "vitest";
import { streamSvg, StreamSvgEvent, type StreamSvgOptions } from "./stream-svg";

const toTextStream = (chunks: string[]): AsyncIterable<string> => {
  return (async function* () {
    for (const chunk of chunks) {
      yield chunk;
    }
  })();
};

describe("streamSvg", () => {
  it("parses NDJSON and yields files per content event", async () => {
    const model = {} as StreamSvgOptions["model"];
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

    const payload = events.map((event) => JSON.stringify(event)).join("\n");
    let streamTextOptions: any;
    const emittedEvents: StreamSvgEvent[] = [];
    const ai = {
      streamText: (options: any) => {
        streamTextOptions = options;
        return {
          textStream: toTextStream([payload.slice(0, 20), payload.slice(20)]),
        };
      },
    };

    const results = [];
    for await (const result of streamSvg(ai, {
      model,
      n: 2,
      prompt: "Draw",
      onEvent: (event) => {
        emittedEvents.push(event);
      },
    })) {
      results.push(result);
    }

    expect(streamTextOptions.onEvent).toBeUndefined();
    expect(emittedEvents).toHaveLength(3);
    expect(results).toHaveLength(2);
    expect(results[0].index).toBe(0);
    expect(results[0].usage).toEqual({ total_tokens: 10 });
    expect(results[1].index).toBe(1);
    expect(results[1].usage).toEqual({ total_tokens: 12 });
  });
});
