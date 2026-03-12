import {
  LanguageModelV3,
  NoSuchModelError,
  ProviderV3,
} from "@ai-sdk/provider";
import { createQuiverConfig, QuiverProviderSettings } from "./quiverai-config";
import { QuiverLanguageModel } from "./language-model/quiverai-language-model";

export interface QuiverProvider extends ProviderV3 {
  (modelId: string): LanguageModelV3;
  languageModel(modelId: string): LanguageModelV3;
  chat(modelId: string): LanguageModelV3;
}

export function createQuiver(
  options: QuiverProviderSettings = {},
): QuiverProvider {
  const config = createQuiverConfig(options);

  const createLanguageModel = (modelId: string) =>
    new QuiverLanguageModel(modelId, config);

  const provider = function (modelId: string) {
    if (new.target) {
      throw new Error(
        "The QuiverAI model function cannot be called with the new keyword.",
      );
    }

    return createLanguageModel(modelId);
  };

  provider.specificationVersion = "v3" as const;
  provider.languageModel = createLanguageModel;
  provider.chat = createLanguageModel;
  provider.embeddingModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: "embeddingModel" });
  };
  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: "imageModel" });
  };

  return provider as QuiverProvider;
}

export const quiverai = createQuiver();
