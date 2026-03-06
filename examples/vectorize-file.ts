import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { generateText } from "ai";
import { quiver } from "@quiverai/vercel-ai-provider";

const modelId = process.env.QUIVER_MODEL_ID ?? "arrow-preview";

const mediaTypeByExtension: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

async function main() {
  const inputPath = process.argv[2];

  if (!inputPath) {
    throw new Error(
      "QuiverAI vectorize example requires an input path. Usage: pnpm example:vectorize -- ./image.png",
    );
  }

  const extension = extname(inputPath).toLowerCase();
  const mediaType = mediaTypeByExtension[extension];

  if (!mediaType) {
    throw new Error(
      "QuiverAI vectorize example supports .png, .jpg, .jpeg, and .webp files.",
    );
  }

  const input = await readFile(inputPath);
  const result = await generateText({
    model: quiver(modelId),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "file",
            mediaType,
            data: new Uint8Array(input),
          },
        ],
      },
    ],
    maxOutputTokens: 2048,
    providerOptions: {
      quiver: {
        operation: "vectorize",
      },
    },
  });

  console.log("QuiverAI SVG:");
  console.log(result.text);
}

void main();
