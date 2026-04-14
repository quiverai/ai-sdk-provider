import { ImageModelV3, NoSuchModelError, ProviderV3 } from "@ai-sdk/provider";
import { createQuiverConfig, QuiverProviderSettings } from "./quiverai-config";
import { QuiverImageModel } from "./quiverai-image-model";

export interface QuiverImageProvider extends ProviderV3 {
  (modelId: string): ImageModelV3;
  imageModel(modelId: string): ImageModelV3;
}

export function createQuiverImage(
  options: QuiverProviderSettings = {},
): QuiverImageProvider {
  const config = createQuiverConfig(options);

  const createImageModel = (modelId: string) =>
    new QuiverImageModel(modelId, config);

  const provider = function (modelId: string) {
    if (new.target) {
      throw new Error(
        "The QuiverAI image model function cannot be called with the new keyword.",
      );
    }

    return createImageModel(modelId);
  };

  provider.specificationVersion = "v3" as const;
  provider.imageModel = createImageModel;
  provider.languageModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: "languageModel" });
  };
  provider.embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: "embeddingModel" });
  };

  return provider as QuiverImageProvider;
}

export const quiverImage = createQuiverImage();
