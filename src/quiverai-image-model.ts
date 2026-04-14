import { ImageModelV4, ImageModelV4CallOptions } from "@ai-sdk/provider";
import { QuiverAIConfig } from "./quiverai-config";
import {
  buildRequestBody,
  collectWarnings,
  convertResponseToImages,
  convertResponseToProviderMetadata,
  convertUsage,
  parseQuiverAIImageModelOptions,
  postGenerateRequest,
} from "./quiverai-api";
import { QuiverAIImageModelId } from "./quiverai-image-settings";

export class QuiverAIImageModel implements ImageModelV4 {
  readonly specificationVersion = "v4" as const;
  readonly provider: string;
  readonly maxImagesPerCall = 16;

  constructor(
    readonly modelId: QuiverAIImageModelId,
    private readonly config: QuiverAIConfig,
  ) {
    this.provider = config.provider;
  }

  async doGenerate(options: ImageModelV4CallOptions) {
    const providerOptions = await parseQuiverAIImageModelOptions(
      options.providerOptions,
    );

    const warnings = collectWarnings({
      size: options.size,
      aspectRatio: options.aspectRatio,
      seed: options.seed,
      mask: options.mask,
      stream: providerOptions.stream,
    });

    const { value: response, responseHeaders } = await postGenerateRequest({
      config: this.config,
      body: buildRequestBody({
        modelId: this.modelId,
        n: options.n,
        prompt: options.prompt,
        files: options.files,
        providerOptions,
      }),
      headers: options.headers,
      abortSignal: options.abortSignal,
      operation: providerOptions.operation,
    });

    return {
      images: convertResponseToImages(response),
      warnings,
      providerMetadata: convertResponseToProviderMetadata(response),
      response: {
        timestamp: new Date(response.created * 1000),
        modelId: this.modelId,
        headers: responseHeaders,
      },
      usage: convertUsage(response.usage),
    };
  }
}
