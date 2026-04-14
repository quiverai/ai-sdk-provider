import { ImageModelV3, ImageModelV3CallOptions } from "@ai-sdk/provider";
import { QuiverApiConfig } from "./quiverai-config";
import {
  buildRequestBody,
  collectWarnings,
  convertResponseToImages,
  convertResponseToProviderMetadata,
  convertUsage,
  parseQuiverImageOptions,
  postGenerateRequest,
} from "./quiverai-api";

export class QuiverImageModel implements ImageModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider: string;
  readonly modelId: string;
  readonly maxImagesPerCall = 16;

  constructor(
    modelId: string,
    private readonly config: QuiverApiConfig,
  ) {
    this.provider = config.provider;
    this.modelId = modelId;
  }

  async doGenerate(options: ImageModelV3CallOptions) {
    const providerOptions = await parseQuiverImageOptions(
      options.providerOptions,
    );

    const warnings = collectWarnings({
      size: options.size,
      aspectRatio: options.aspectRatio,
      seed: options.seed,
      mask: options.mask,
    });

    const { value: response, responseHeaders } = await postGenerateRequest({
      config: this.config,
      body: buildRequestBody({
        modelId: this.modelId,
        n: options.n,
        prompt: options.prompt,
        files: options.files,
        operation: providerOptions.operation,
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
