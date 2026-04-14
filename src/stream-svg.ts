import { convertUint8ArrayToBase64 } from "@ai-sdk/provider-utils";

export type StreamSvgEvent = {
  index: number;
  id?: string;
  type: string;
  svg: string;
  usage?: {
    total_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
  };
};

export type StreamSvgResult = {
  index: number;
  file: {
    mediaType: string;
    base64: string;
    uint8Array: Uint8Array;
  };
  usage?: StreamSvgEvent["usage"];
};

export type StreamSvgOptions = {
  model: string;
  prompt?: string;
  messages?: unknown;
  providerOptions?: Record<string, unknown>;
  n?: number;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  presencePenalty?: number;
  onEvent?: (event: StreamSvgEvent) => void;
};

export async function* streamSvg(
  ai: { streamText: (opts: any) => { textStream: AsyncIterable<string> } },
  options: StreamSvgOptions,
): AsyncGenerator<StreamSvgResult> {
  const { providerOptions, n, ...rest } = options;
  const mergedProviderOptions = {
    ...providerOptions,
    quiverai: {
      ...((providerOptions?.quiverai as Record<string, unknown>) ?? {}),
      operation: "generate",
      n: n ?? 1,
    },
  };

  const result = ai.streamText({
    ...rest,
    providerOptions: mergedProviderOptions,
  });

  let buffer = "";
  for await (const chunk of result.textStream) {
    buffer += chunk;
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (!line) continue;

      const event: StreamSvgEvent = JSON.parse(line);
      options.onEvent?.(event);
      if (event.type !== "content") continue;

      const data = new TextEncoder().encode(event.svg);
      yield {
        index: event.index,
        usage: event.usage,
        file: {
          mediaType: "image/svg+xml",
          uint8Array: data,
          base64: convertUint8ArrayToBase64(data),
        },
      };
    }
  }
}
