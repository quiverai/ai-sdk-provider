import { streamText } from "ai";
import { quiverai, streamSvg } from "@quiverai/vercel-ai-provider";

const modelId = process.env.QUIVERAI_MODEL_ID ?? "arrow-preview";

async function main() {
  const prompt =
    process.argv.slice(2).join(" ").trim() ||
    "Stream two SVG icon variations and log each chunk.";

  const svgStream = streamSvg(
    { streamText },
    {
      model: quiverai(modelId),
      prompt,
      n: 2,
      onEvent: (event) => {
        console.log(
          `quiverai event ${event.index}: type=${event.type} usage=${event.usage?.total_tokens ?? "?"}`,
        );
      },
    },
  );

  for await (const file of svgStream) {
    console.log(
      `Output ${file.index} ready (${file.file.uint8Array.length} bytes)`,
    );
    console.log(file.file.base64);
  }
}

void main();
