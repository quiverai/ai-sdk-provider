import { writeFile } from "node:fs/promises";
import { generateImage } from "ai";
import { quiverImage } from "../src";

const modelId = process.env.QUIVERAI_MODEL_ID ?? "quiver-image-preview";
const prompt =
  process.argv.slice(2).join(" ") || "Generate a simple square SVG icon.";

async function main() {
  const result = await generateImage({
    model: quiverImage(modelId),
    prompt,
  });

  await writeFile("quiver-output.svg", result.image.uint8Array);

  console.log("Wrote quiver-output.svg");
  console.log(
    JSON.stringify(result.providerMetadata?.quiverai?.images ?? [], null, 2),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
