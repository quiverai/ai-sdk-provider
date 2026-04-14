import { ImageModelV4, NoSuchModelError, ProviderV4 } from "@ai-sdk/provider";
import {
  createQuiverAIConfig,
  QuiverAIProviderSettings,
} from "./quiverai-config";
import { QuiverAIImageModel } from "./quiverai-image-model";
import { QuiverAIImageModelId } from "./quiverai-image-settings";

export type { QuiverAIProviderSettings } from "./quiverai-config";

export interface QuiverAIProvider extends ProviderV4 {
  /**
   * Creates a model for image generation.
   */
  image(modelId: QuiverAIImageModelId): ImageModelV4;
  /**
   * Creates a model for image generation.
   */
  imageModel(modelId: QuiverAIImageModelId): ImageModelV4;
  /**
   * @deprecated Use `embeddingModel` instead.
   */
  textEmbeddingModel(modelId: string): never;
}

export function createQuiverAI(
  options: QuiverAIProviderSettings = {},
): QuiverAIProvider {
  const config = createQuiverAIConfig(options);

  const createImageModel = (modelId: QuiverAIImageModelId) =>
    new QuiverAIImageModel(modelId, config);

  const embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: "embeddingModel" });
  };

  return {
    specificationVersion: "v4",
    image: createImageModel,
    imageModel: createImageModel,
    languageModel: (modelId: string) => {
      throw new NoSuchModelError({ modelId, modelType: "languageModel" });
    },
    embeddingModel,
    textEmbeddingModel: embeddingModel,
  };
}

export const quiverai = createQuiverAI();
