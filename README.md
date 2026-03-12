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
- `n` controls non-streaming multi-output requests
- `autoCrop` and `targetSize` are available for `vectorize`

Streaming behavior is intentionally mapped as:

- QuiverAI `draft` token deltas -> AI SDK reasoning
- QuiverAI `content` snapshots -> AI SDK text

QuiverAI `draft` is currently streamed token-by-token without higher-level chunking, so the provider forwards those deltas directly as AI SDK reasoning updates.

Streaming currently supports only a single output. Use `generateText` with `providerOptions.quiverai.n` for multi-output generation.

## Examples

This repo includes 4 small QuiverAI examples. They stay out of the published package and are only for local development.

Run them from the repo root:

```bash
pnpm example:generate -- "Generate a simple geometric SVG icon."
pnpm example:stream -- "Generate a simple geometric SVG icon."
pnpm example:vectorize -- ./image.png
pnpm example:multi-output -- "Generate two simple SVG icon variations."
```

The examples import the public package entrypoint and build the package first so they behave like normal consumer code.
