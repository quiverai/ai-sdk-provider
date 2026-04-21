import { writeFile } from "node:fs/promises";
import { generateImage } from "ai";
import { quiverai } from "../src";

const modelId = process.env.QUIVERAI_MODEL_ID ?? "arrow-1";
const prompt =
  process.argv.slice(2).join(" ") || "Generate a simple square SVG icon.";

async function main() {
  const result = await generateImage({
    model: quiverai.image(modelId),
    prompt,
  });

  await writeFile("quiverai-output.svg", result.image.uint8Array);

  console.log("Wrote quiverai-output.svg");
  console.log(
    JSON.stringify(result.providerMetadata?.quiverai?.images ?? [], null, 2),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
