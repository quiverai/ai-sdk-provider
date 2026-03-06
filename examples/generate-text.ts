import { generateText } from "ai";
import { quiver } from "@quiverai/vercel-ai-provider";

const modelId = process.env.QUIVER_MODEL_ID ?? "arrow-preview";

async function main() {
  const result = await generateText({
    model: quiver(modelId),
    prompt:
      process.argv.slice(2).join(" ").trim() ||
      "Generate a simple geometric SVG icon.",
    maxOutputTokens: 512,
    providerOptions: {
      quiver: {
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
