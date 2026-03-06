import {
  LanguageModelV2,
  NoSuchModelError,
  ProviderV2,
} from "@ai-sdk/provider";
import { createQuiverConfig, QuiverProviderSettings } from "./quiver-config";
import { QuiverV2LanguageModel } from "./language-model/quiver-v2-language-model";

export interface QuiverProviderV2 extends ProviderV2 {
  (modelId: string): LanguageModelV2;
  languageModel(modelId: string): LanguageModelV2;
  chat(modelId: string): LanguageModelV2;
}

export function createQuiverV2(
  options: QuiverProviderSettings = {},
): QuiverProviderV2 {
  const config = createQuiverConfig(options);

  const createLanguageModel = (modelId: string) =>
    new QuiverV2LanguageModel(modelId, config);

  const provider = function (modelId: string) {
    if (new.target) {
      throw new Error(
        "The Quiver V2 model function cannot be called with the new keyword.",
      );
    }

    return createLanguageModel(modelId);
  };

  provider.languageModel = createLanguageModel;
  provider.chat = createLanguageModel;
  provider.textEmbeddingModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: "embeddingModel" });
  };
  provider.imageModel = (modelId: string) => {
    throw new NoSuchModelError({ modelId, modelType: "imageModel" });
  };

  return provider as QuiverProviderV2;
}

export const quiverV2 = createQuiverV2();
