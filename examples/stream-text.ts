import { streamText } from "ai";
import { quiverai } from "@quiverai/vercel-ai-provider";

const modelId = process.env.QUIVERAI_MODEL_ID ?? "arrow-preview";

async function main() {
  const result = streamText({
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

  console.log("QuiverAI reasoning:");
  const reasoning = await result.reasoningText;
  if (reasoning) {
    console.log(reasoning);
  } else {
    console.log("(none)");
  }

  console.log("");
  console.log("QuiverAI SVG:");
  console.log(await result.text);
}

void main();
