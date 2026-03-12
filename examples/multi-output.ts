import { generateText } from "ai";
import { quiverai } from "@quiverai/vercel-ai-provider";

const modelId = process.env.QUIVERAI_MODEL_ID ?? "arrow-preview";

async function main() {
  const result = await generateText({
    model: quiverai(modelId),
    prompt:
      process.argv.slice(2).join(" ").trim() ||
      "Generate two simple SVG icon variations for the same concept.",
    maxOutputTokens: 1024,
    providerOptions: {
      quiverai: {
        operation: "generate",
        n: 2,
      },
    },
  });

  console.log("QuiverAI primary SVG:");
  console.log(result.text);
  console.log("");
  console.log("QuiverAI all outputs:");
  console.log(
    JSON.stringify(result.providerMetadata?.quiverai?.outputs ?? [], null, 2),
  );
}

void main();
