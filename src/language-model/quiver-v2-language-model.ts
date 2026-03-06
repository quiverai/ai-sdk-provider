import {
  LanguageModelV2,
  LanguageModelV2CallOptions,
  LanguageModelV2Content,
} from "@ai-sdk/provider";
import { generateId } from "@ai-sdk/provider-utils";
import { QuiverLanguageModelConfig } from "../quiver-config";
import {
  createV2StreamTransformer,
  extractSvgText,
  getArgsV2,
  getResponseMetadataFromJson,
  postGenerateRequest,
  postStreamRequest,
} from "./quiver-api";
import { convertQuiverUsageV2 } from "./convert-quiver-usage";
import { mapQuiverFinishReasonV2 } from "./map-quiver-finish-reason";

export class QuiverV2LanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2";
  readonly modelId: string;
  readonly supportedUrls: Record<string, RegExp[]> = {
    "image/*": [/^https?:\/\/.+$/],
  };

  private readonly config: QuiverLanguageModelConfig;
  private readonly createId: () => string;

  constructor(modelId: string, config: QuiverLanguageModelConfig) {
    this.modelId = modelId;
    this.config = config;
    this.createId = config.generateId ?? generateId;
  }

  get provider(): string {
    return this.config.provider;
  }

  async doGenerate(options: LanguageModelV2CallOptions) {
    const { body, warnings, operation } = await getArgsV2({
      modelId: this.modelId,
      options,
    });

    const {
      responseHeaders,
      value: response,
      rawValue,
    } = await postGenerateRequest({
      config: this.config,
      body,
      headers: options.headers,
      operation,
      abortSignal: options.abortSignal,
    });

    const content: LanguageModelV2Content[] = [
      { type: "text", text: extractSvgText(response) },
    ];

    return {
      content,
      finishReason: mapQuiverFinishReasonV2(),
      usage: convertQuiverUsageV2(response.usage),
      request: { body },
      response: {
        ...getResponseMetadataFromJson({
          response,
          modelId: this.modelId,
        }),
        headers: responseHeaders,
        body: rawValue,
      },
      warnings,
    };
  }

  async doStream(options: LanguageModelV2CallOptions) {
    const { body, warnings, operation } = await getArgsV2({
      modelId: this.modelId,
      options,
    });

    const { responseHeaders, value: response } = await postStreamRequest({
      config: this.config,
      body,
      headers: options.headers,
      operation,
      abortSignal: options.abortSignal,
    });

    return {
      stream: response.pipeThrough(
        createV2StreamTransformer({
          warnings,
          modelId: this.modelId,
          generateId: this.createId,
          includeRawChunks: options.includeRawChunks,
        }),
      ),
      request: { body: { ...body, stream: true } },
      response: { headers: responseHeaders },
    };
  }
}
