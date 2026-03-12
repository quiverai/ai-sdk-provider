import { generateText } from "ai";
import { quiverai } from "@quiverai/vercel-ai-provider";

const modelId = process.env.QUIVERAI_MODEL_ID ?? "arrow-preview";

async function main() {
  const result = await generateText({
    model: quiverai(modelId),
    prompt:
      process.argv.slice(2).join(" ").trim() ||
      "Generate a simple geometric SVG icon.",
    maxOutputTokens: 512,
    providerOptions: {
      quiverai: {
        operation: "generate",
      },
    },
  });

  console.log("QuiverAI SVG:");
  console.log(result.text);
  console.log("");
  console.log("Finish reason:", result.finishReason);
  console.log("Usage:", JSON.stringify(result.usage, null, 2));
}

void main();
