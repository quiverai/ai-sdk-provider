# @quiverai/vercel-ai-provider

The QuiverAI provider for the Vercel AI SDK adds image model support for the
QuiverAI API.

## Installation

```bash
pnpm add ai @quiverai/vercel-ai-provider
```

## Setup

The QuiverAI provider is available in the `@quiverai/vercel-ai-provider`
module:

```bash
pnpm add @quiverai/vercel-ai-provider ai@beta
```

Set your QuiverAI API key:

```bash
export QUIVERAI_API_KEY=your_api_key
```

Optional environment variables:

- `QUIVERAI_BASE_URL` to override the default `https://api.quiver.ai/v1`
- `QUIVERAI_MODEL_ID` to override the default example model `arrow-1.1`

## Provider Instance

You can import the default provider instance `quiverai` from
`@quiverai/vercel-ai-provider`:

```ts
import { quiverai } from "@quiverai/vercel-ai-provider";
```

## Image Generation Example

```ts
import { generateImage } from "ai";
import { quiverai } from "@quiverai/vercel-ai-provider";

const { image } = await generateImage({
  model: quiverai.image("arrow-1.1"),
  prompt: "A logo for the next AI Design startup",
});

const svg = new TextDecoder().decode(image.uint8Array);
console.log(svg);
```

QuiverAI returns SVG documents. The generated SVG bytes are available through
`result.image.uint8Array` / `result.images`.

## Additional Options

QuiverAI’s API reference documents extra generation controls for text-to-SVG
and image-to-SVG requests. You can pass them through
`providerOptions.quiverai`:

- `operation`: choose between `generate` and `vectorize`
- `instructions`: extra style guidance for prompt-based generation
- `temperature`, `topP`, `presencePenalty`, `maxOutputTokens`
- `autoCrop`, `targetSize` for vectorization
- `prompt.images`: up to 4 references for `arrow-1` / `arrow-1.1`, and up to
  16 for `arrow-1.1-max`

```ts
import { generateImage } from "ai";
import {
  quiverai,
  type QuiverAIImageModelOptions,
} from "@quiverai/vercel-ai-provider";

const { image } = await generateImage({
  model: quiverai.image("arrow-1.1"),
  prompt: {
    text: "Generate a geometric unicorn icon",
    images: [new URL("https://example.com/reference-1.png")],
  },
  providerOptions: {
    quiverai: {
      instructions: "Use a flat monochrome style with clean geometry.",
      temperature: 0.4,
      topP: 0.95,
      maxOutputTokens: 4096,
    } satisfies QuiverAIImageModelOptions,
  },
});

console.log(new TextDecoder().decode(image.uint8Array));
```

## Image to SVG Example

```ts
import fs from "node:fs";
import { generateImage } from "ai";
import {
  quiverai,
  type QuiverAIImageModelOptions,
} from "@quiverai/vercel-ai-provider";

const result = await generateImage({
  model: quiverai.image("arrow-1.1"),
  prompt: {
    images: [fs.readFileSync("./logo.png")],
  },
  providerOptions: {
    quiverai: {
      operation: "vectorize",
      autoCrop: true,
      targetSize: 1024,
    } satisfies QuiverAIImageModelOptions,
  },
});
```

## Configuring Base URL

By default, the provider uses `https://api.quiver.ai/v1`. You can override it:

```ts
import { createQuiverAI } from "@quiverai/vercel-ai-provider";

const customQuiverAI = createQuiverAI({
  apiKey: process.env.QUIVERAI_API_KEY,
  baseURL: "https://api.quiver.ai/v1",
});
```

## Example Script

The repo example writes `quiverai-output.svg` in the repo root:

```bash
pnpm example:generate-image -- "Generate a simple geometric SVG icon."
```

## Scope

This package intentionally ships the fast-path release surface only:

- `generateImage` with `generate` and `vectorize`
- Quiver auth, base URL overrides, and error handling

It does not include the exploratory text or streaming integrations from the
earlier provider implementation.

## Exports

- `createQuiverAI`
- `quiverai`
- `VERSION`
- `QuiverAIProvider`
- `QuiverAIProviderSettings`
- `QuiverAIImageModelId`
- `QuiverAIImageModelOptions`
