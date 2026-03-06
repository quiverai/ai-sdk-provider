import { streamText } from "ai";
import { quiver } from "@quiverai/vercel-ai-provider";

const modelId = process.env.QUIVER_MODEL_ID ?? "arrow-preview";

async function main() {
  const result = streamText({
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
