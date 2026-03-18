# @quiverai/vercel-ai-provider

QuiverAI provider for the Vercel AI SDK.

## Installation

```bash
pnpm add ai @quiverai/vercel-ai-provider
```

## Setup

Set your QuiverAI API key:

```bash
export QUIVERAI_API_KEY=your_api_key
```

Optional environment variables:

- `QUIVERAI_BASE_URL` to override the default `https://api.quiver.ai/v1`
- `QUIVERAI_MODEL_ID` to override the default example model `arrow-preview`

## Usage

```ts
import { generateText } from "ai";
import { quiverai } from "@quiverai/vercel-ai-provider";

const result = await generateText({
  model: quiverai("arrow-preview"),
  prompt: "Generate a simple geometric SVG icon.",
  providerOptions: {
    quiverai: {
      operation: "generate",
    },
  },
});

console.log(result.text);
```

## QuiverAI Options

Use QuiverAI-specific options through `providerOptions.quiverai`:

- `operation: "generate" | "vectorize"` is required
- `n` controls multi-output requests (up to 16)
- `autoCrop` and `targetSize` are available for `vectorize`

Streaming behavior is intentionally mapped as:

- QuiverAI `draft` token deltas -> AI SDK reasoning
- QuiverAI `content` snapshots -> AI SDK text

QuiverAI `draft` is currently streamed token-by-token without higher-level chunking, so the provider forwards those deltas directly as AI SDK reasoning updates.

For `n > 1` streaming calls, the provider emits NDJSON on a single text stream (`result.textStream` / `result.text`). Each line includes `index`, `id`, `type`, and `svg` so clients can split and render per-output streams.

### `streamSvg` helper

`streamSvg(ai, options)` parses that NDJSON flow and yields one `GeneratedFile` per output as soon as its `content` event arrives. Pass the `ai` instance you already use (no extra dependency), the `model`/`prompt`/`n`, and optionally listen for interim events. It’s a lightweight way to stream multiple SVG files without handling JSON parsing yourself and can later adapt to a dedicated `streamSvg` API if the SDK adds one.

### Rendering multiple SVG streams in React

Render each logical output stream in React by treating the single `result.textStream` as NDJSON, grouping events by `index`, and emitting `content` events into independent SVG fragments. Pseudo code:

```tsx
import { useEffect, useState } from "react";
import { streamText } from "ai";
import { quiverai } from "@quiverai/vercel-ai-provider";

const prompt = "Generate multiple simple SVG icons.";
const n = 3;

const [channels, setChannels] = useState(() =>
  Array.from({ length: n }, () => ({ svg: "", status: "idle" })),
);

useEffect(() => {
  const stream = streamText({
    model: quiverai("arrow-preview"),
    prompt,
    providerOptions: {
      quiverai: {
        operation: "generate",
        n,
      },
    },
  });

  let buffer = "";
  let isActive = true;

  (async () => {
    for await (const chunk of stream.textStream) {
      buffer += chunk;
      while (true) {
        const newline = buffer.indexOf("\n");
        if (newline === -1) break;
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line || !isActive) continue;

        const event = JSON.parse(line);
        setChannels((previous) => {
          const next = [...previous];
          next[event.index] = {
            svg: event.type === "content" ? event.svg : next[event.index].svg,
            status: event.type,
          };
          return next;
        });
      }
    }
  })();

  return () => {
    isActive = false;
    stream.textStream?.return?.();
  };
}, [prompt, n]);

return (
  <div>
    {channels.map((channel, index) => (
      <div key={index}>
        <p>Output {index}</p>
        <p>Status: {channel.status}</p>
        <div dangerouslySetInnerHTML={{ __html: channel.svg }} />
      </div>
    ))}
  </div>
);
```

Each `index` becomes a logical stream, so `content` events replace the SVG source while `draft` and `delta` events drive progressive UI states. This keeps every QuiverAI output mapped into its own slot without adding new SDK surface area.

## Examples

This repo includes 4 small QuiverAI examples. They stay out of the published package and are only for local development.

Run them from the repo root:

```bash
pnpm example:generate -- "Generate a simple geometric SVG icon."
pnpm example:stream -- "Generate a simple geometric SVG icon."
pnpm example:vectorize -- ./image.png
pnpm example:multi-output -- "Generate two simple SVG icon variations."
pnpm example:stream-svg -- "Stream two SVG icon variations and log each chunk."
```

The examples import the public package entrypoint and build the package first so they behave like normal consumer code.
