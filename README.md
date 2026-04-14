# @quiverai/vercel-ai-provider

Minimal QuiverAI image provider for the Vercel AI SDK.

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
- `QUIVERAI_MODEL_ID` to override the default example model `quiver-image-preview`

## Usage with `generateImage`

```ts
import { generateImage } from "ai";
import { quiverImage } from "@quiverai/vercel-ai-provider";

const result = await generateImage({
  model: quiverImage("quiver-image-preview"),
  prompt: "Generate a simple geometric SVG icon.",
});

const svg = new TextDecoder().decode(result.image.uint8Array);
console.log(svg);
```

QuiverAI returns SVG documents. The generated SVG bytes are available through
`result.image.uint8Array` / `result.images`.

Use `providerOptions.quiverai.operation` to choose the mode:

- `generate` for prompt-based SVG generation
- `vectorize` for image-to-SVG vectorization

Vectorize example:

```ts
import { generateImage } from "ai";
import { quiverImage } from "@quiverai/vercel-ai-provider";

const result = await generateImage({
  model: quiverImage("quiver-image-preview"),
  prompt: {
    images: [await Deno.readFile("./logo.png")],
  },
  providerOptions: {
    quiverai: {
      operation: "vectorize",
    },
  },
});
```

The authoritative MIME type is exposed through provider metadata:

```bash
pnpm example:generate-image -- "Generate a simple geometric SVG icon."
```

The example writes `quiver-output.svg` in the repo root.

## Scope

This package intentionally ships the fast-path release surface only:

- `generateImage` with `generate` and `vectorize`
- Quiver auth, base URL overrides, and error handling

It does not include the exploratory text or streaming integrations from the
earlier provider implementation.
