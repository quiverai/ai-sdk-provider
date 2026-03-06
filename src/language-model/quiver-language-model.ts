import {
  LanguageModelV3Content,
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamResult,
} from "@ai-sdk/provider";
import { generateId } from "@ai-sdk/provider-utils";
import { QuiverLanguageModelConfig } from "../quiver-config";
import {
  createV3StreamTransformer,
  extractSvgText,
  getArgsV3,
  getQuiverProviderMetadata,
  getResponseMetadataFromJson,
  postGenerateRequest,
  postStreamRequest,
} from "./quiver-api";
import { convertQuiverUsageV3 } from "./convert-quiver-usage";
import { mapQuiverFinishReasonV3 } from "./map-quiver-finish-reason";

export class QuiverLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = "v3";
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

  async doGenerate(
    options: LanguageModelV3CallOptions,
  ): Promise<LanguageModelV3GenerateResult> {
    const { body, warnings, operation } = await getArgsV3({
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

    const svg = extractSvgText(response);

    return {
      content: getOutputContent(svg),
      finishReason: mapQuiverFinishReasonV3(),
      usage: convertQuiverUsageV3(response.usage),
      request: { body },
      response: {
        ...getResponseMetadataFromJson({
          response,
          modelId: this.modelId,
        }),
        headers: responseHeaders,
        body: rawValue,
      },
      providerMetadata: getQuiverProviderMetadata(response),
      warnings,
    };
  }

  async doStream(
    options: LanguageModelV3CallOptions,
  ): Promise<LanguageModelV3StreamResult> {
    const { body, warnings, operation } = await getArgsV3({
      modelId: this.modelId,
      options,
      stream: true,
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
        createV3StreamTransformer({
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

function getOutputContent(svg: string): LanguageModelV3Content[] {
  return [
    { type: "text", text: svg },
    {
      type: "file",
      mediaType: "image/svg+xml",
      data: new TextEncoder().encode(svg),
    },
  ];
}
