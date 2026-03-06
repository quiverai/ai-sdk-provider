import {
  InvalidArgumentError,
  LanguageModelV2CallOptions,
  LanguageModelV2CallWarning,
  LanguageModelV2StreamPart,
  LanguageModelV3CallOptions,
  LanguageModelV3StreamPart,
  SharedV3Warning,
  UnsupportedFunctionalityError,
} from "@ai-sdk/provider";
import {
  ParseResult,
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonResponseHandler,
  parseProviderOptions,
  postJsonToApi,
} from "@ai-sdk/provider-utils";
import {
  convertQuiverUsageV2,
  convertQuiverUsageV3,
} from "./convert-quiver-usage";
import { convertToQuiverPrompt } from "./convert-to-quiver-prompt";
import {
  mapQuiverFinishReasonV2,
  mapQuiverFinishReasonV3,
} from "./map-quiver-finish-reason";
import {
  PublicErrorEnvelope,
  SvgResponse,
  SvgStreamChunk,
  SvgUsage,
  publicErrorEnvelopeSchema,
  svgResponseSchema,
  svgStreamChunkSchema,
} from "./quiver-api-types";
import {
  QuiverLanguageModelOptions,
  quiverLanguageModelOptionsSchema,
} from "./quiver-language-model-options";
import { quiverFailedResponseHandler } from "../quiver-error";
import { QuiverLanguageModelConfig } from "../quiver-config";

type QuiverRequestBody =
  | {
      model: string;
      n: number;
      stream: boolean;
      temperature: number | undefined;
      top_p: number | undefined;
      max_output_tokens: number | undefined;
      presence_penalty: number | undefined;
      instructions: string | undefined;
      prompt: string;
      references: Array<{ url: string } | { base64: string }> | undefined;
    }
  | {
      model: string;
      n: number;
      stream: boolean;
      temperature: number | undefined;
      top_p: number | undefined;
      max_output_tokens: number | undefined;
      presence_penalty: number | undefined;
      image: { url: string } | { base64: string };
      auto_crop: boolean | undefined;
      target_size: number | undefined;
    };

export async function getArgsV3({
  modelId,
  options,
  stream = false,
}: {
  modelId: string;
  options: LanguageModelV3CallOptions;
  stream?: boolean;
}): Promise<{
  body: QuiverRequestBody;
  warnings: SharedV3Warning[];
  operation: QuiverLanguageModelOptions["operation"];
}> {
  const providerOptions = await parseQuiverOptions({
    providerOptions: options.providerOptions,
  });
  const warnings = collectWarningsV3(options);
  validateUnsupportedFeatures(options);

  return {
    body: buildRequestBody({
      modelId,
      operationOptions: providerOptions,
      prompt: options.prompt,
      stream,
      maxOutputTokens: options.maxOutputTokens,
      temperature: options.temperature,
      topP: options.topP,
      presencePenalty: options.presencePenalty,
    }),
    warnings,
    operation: providerOptions.operation,
  };
}

export async function getArgsV2({
  modelId,
  options,
  stream = false,
}: {
  modelId: string;
  options: LanguageModelV2CallOptions;
  stream?: boolean;
}): Promise<{
  body: QuiverRequestBody;
  warnings: LanguageModelV2CallWarning[];
  operation: QuiverLanguageModelOptions["operation"];
}> {
  const providerOptions = await parseQuiverOptions({
    providerOptions: options.providerOptions,
  });
  const warnings = collectWarningsV2(options);
  validateUnsupportedFeatures(options);

  return {
    body: buildRequestBody({
      modelId,
      operationOptions: providerOptions,
      prompt: options.prompt,
      stream,
      maxOutputTokens: options.maxOutputTokens,
      temperature: options.temperature,
      topP: options.topP,
      presencePenalty: options.presencePenalty,
    }),
    warnings,
    operation: providerOptions.operation,
  };
}

export async function postGenerateRequest({
  config,
  body,
  headers,
  operation,
  abortSignal,
}: {
  config: QuiverLanguageModelConfig;
  body: QuiverRequestBody;
  headers?: Record<string, string | undefined>;
  operation: QuiverLanguageModelOptions["operation"];
  abortSignal?: AbortSignal;
}) {
  return postJsonToApi({
    url: config.url(getOperationPath(operation)),
    headers: combineHeaders(config.headers(), headers),
    body,
    failedResponseHandler: quiverFailedResponseHandler,
    successfulResponseHandler: createJsonResponseHandler(svgResponseSchema),
    abortSignal,
    fetch: config.fetch,
  });
}

export async function postStreamRequest({
  config,
  body,
  headers,
  operation,
  abortSignal,
}: {
  config: QuiverLanguageModelConfig;
  body: QuiverRequestBody;
  headers?: Record<string, string | undefined>;
  operation: QuiverLanguageModelOptions["operation"];
  abortSignal?: AbortSignal;
}) {
  return postJsonToApi({
    url: config.url(getOperationPath(operation)),
    headers: combineHeaders(config.headers(), headers),
    body: { ...body, stream: true },
    failedResponseHandler: quiverFailedResponseHandler,
    successfulResponseHandler:
      createEventSourceResponseHandler(svgStreamChunkSchema),
    abortSignal,
    fetch: config.fetch,
  });
}

export function getResponseMetadataFromJson({
  response,
  modelId,
}: {
  response: SvgResponse;
  modelId: string;
}) {
  return {
    id: response.id,
    timestamp: new Date(response.created * 1000),
    modelId,
  };
}

export function extractSvgText(response: SvgResponse): string {
  if (response.data.length < 1) {
    throw new InvalidArgumentError({
      argument: "response.data",
      message: "QuiverAI provider received a response without any SVG outputs.",
    });
  }

  return response.data[0].svg;
}

export function getQuiverProviderMetadata(response: SvgResponse) {
  return {
    quiver: {
      outputCount: response.data.length,
      outputs: response.data.map((item, index) => ({
        index,
        svg: item.svg,
        mimeType: item.mime_type,
      })),
    },
  };
}

export function createV3StreamTransformer({
  warnings,
  modelId,
  generateId,
  includeRawChunks,
}: {
  warnings: SharedV3Warning[];
  modelId: string;
  generateId: () => string;
  includeRawChunks: boolean | undefined;
}) {
  let usage: SvgUsage | undefined;
  let sentResponseMetadata = false;
  let activeReasoningId: string | null = null;
  let activeTextId: string | null = null;
  let textSnapshot = "";
  let sawError = false;

  return new TransformStream<
    ParseResult<SvgStreamChunk>,
    LanguageModelV3StreamPart
  >({
    start(controller) {
      controller.enqueue({ type: "stream-start", warnings });
    },

    transform(chunk, controller) {
      if (includeRawChunks) {
        controller.enqueue({ type: "raw", rawValue: chunk.rawValue });
      }

      if (!chunk.success) {
        sawError = true;
        controller.enqueue({ type: "error", error: chunk.error });
        return;
      }

      const value = chunk.value;
      usage = value.usage ?? usage;

      if (!sentResponseMetadata && value.id != null) {
        sentResponseMetadata = true;
        controller.enqueue({
          type: "response-metadata",
          id: value.id,
          modelId,
        });
      }

      // QuiverAI guidance is to map `draft` SVG token deltas directly to AI SDK
      // reasoning and `content` SVG snapshots to AI SDK text. Dedicated
      // reasoning/generating events are transitional and intentionally ignored
      // here.
      if (value.type === "reasoning" || value.type === "generating") {
        return;
      }

      if (value.type === "draft") {
        if (activeTextId != null) {
          controller.enqueue({ type: "text-end", id: activeTextId });
          activeTextId = null;
        }

        if (activeReasoningId == null) {
          activeReasoningId = generateId();
          controller.enqueue({
            type: "reasoning-start",
            id: activeReasoningId,
          });
        }

        if (value.svg.length > 0) {
          controller.enqueue({
            type: "reasoning-delta",
            id: activeReasoningId,
            delta: value.svg,
          });
        }

        return;
      }

      const diff = getSnapshotDelta(textSnapshot, value.svg);

      if (activeReasoningId != null) {
        controller.enqueue({ type: "reasoning-end", id: activeReasoningId });
        activeReasoningId = null;
      }

      if (diff.reset && activeTextId != null) {
        controller.enqueue({ type: "text-end", id: activeTextId });
        activeTextId = null;
      }

      if (activeTextId == null) {
        activeTextId = generateId();
        controller.enqueue({ type: "text-start", id: activeTextId });
      }

      if (diff.delta.length > 0) {
        controller.enqueue({
          type: "text-delta",
          id: activeTextId,
          delta: diff.delta,
        });
      }

      textSnapshot = value.svg;
    },

    flush(controller) {
      if (activeReasoningId != null) {
        controller.enqueue({ type: "reasoning-end", id: activeReasoningId });
      }

      if (activeTextId != null) {
        controller.enqueue({ type: "text-end", id: activeTextId });
      }

      if (textSnapshot.length > 0) {
        controller.enqueue({
          type: "file",
          mediaType: "image/svg+xml",
          data: new TextEncoder().encode(textSnapshot),
        });
      }

      controller.enqueue({
        type: "finish",
        finishReason: mapQuiverFinishReasonV3(sawError ? "error" : "stop"),
        usage: convertQuiverUsageV3(usage),
      });
    },
  });
}

export function createV2StreamTransformer({
  warnings,
  modelId,
  generateId,
  includeRawChunks,
}: {
  warnings: LanguageModelV2CallWarning[];
  modelId: string;
  generateId: () => string;
  includeRawChunks: boolean | undefined;
}) {
  let usage: SvgUsage | undefined;
  let sentResponseMetadata = false;
  let activeReasoningId: string | null = null;
  let activeTextId: string | null = null;
  let textSnapshot = "";
  let sawError = false;

  return new TransformStream<
    ParseResult<SvgStreamChunk>,
    LanguageModelV2StreamPart
  >({
    start(controller) {
      controller.enqueue({ type: "stream-start", warnings });
    },

    transform(chunk, controller) {
      if (includeRawChunks) {
        controller.enqueue({ type: "raw", rawValue: chunk.rawValue });
      }

      if (!chunk.success) {
        sawError = true;
        controller.enqueue({ type: "error", error: chunk.error });
        return;
      }

      const value = chunk.value;
      usage = value.usage ?? usage;

      if (!sentResponseMetadata && value.id != null) {
        sentResponseMetadata = true;
        controller.enqueue({
          type: "response-metadata",
          id: value.id,
          modelId,
        });
      }

      // QuiverAI guidance is to map `draft` SVG token deltas directly to AI SDK
      // reasoning and `content` SVG snapshots to AI SDK text. Dedicated
      // reasoning/generating events are transitional and intentionally ignored
      // here.
      if (value.type === "reasoning" || value.type === "generating") {
        return;
      }

      if (value.type === "draft") {
        if (activeTextId != null) {
          controller.enqueue({ type: "text-end", id: activeTextId });
          activeTextId = null;
        }

        if (activeReasoningId == null) {
          activeReasoningId = generateId();
          controller.enqueue({
            type: "reasoning-start",
            id: activeReasoningId,
          });
        }

        if (value.svg.length > 0) {
          controller.enqueue({
            type: "reasoning-delta",
            id: activeReasoningId,
            delta: value.svg,
          });
        }

        return;
      }

      const diff = getSnapshotDelta(textSnapshot, value.svg);

      if (activeReasoningId != null) {
        controller.enqueue({ type: "reasoning-end", id: activeReasoningId });
        activeReasoningId = null;
      }

      if (diff.reset && activeTextId != null) {
        controller.enqueue({ type: "text-end", id: activeTextId });
        activeTextId = null;
      }

      if (activeTextId == null) {
        activeTextId = generateId();
        controller.enqueue({ type: "text-start", id: activeTextId });
      }

      if (diff.delta.length > 0) {
        controller.enqueue({
          type: "text-delta",
          id: activeTextId,
          delta: diff.delta,
        });
      }

      textSnapshot = value.svg;
    },

    flush(controller) {
      if (activeReasoningId != null) {
        controller.enqueue({ type: "reasoning-end", id: activeReasoningId });
      }

      if (activeTextId != null) {
        controller.enqueue({ type: "text-end", id: activeTextId });
      }

      controller.enqueue({
        type: "finish",
        finishReason: mapQuiverFinishReasonV2(sawError ? "error" : "stop"),
        usage: convertQuiverUsageV2(usage),
      });
    },
  });
}

function buildRequestBody({
  modelId,
  operationOptions,
  prompt,
  stream,
  maxOutputTokens,
  temperature,
  topP,
  presencePenalty,
}: {
  modelId: string;
  operationOptions: QuiverLanguageModelOptions;
  prompt:
    | LanguageModelV2CallOptions["prompt"]
    | LanguageModelV3CallOptions["prompt"];
  stream: boolean;
  maxOutputTokens: number | undefined;
  temperature: number | undefined;
  topP: number | undefined;
  presencePenalty: number | undefined;
}): QuiverRequestBody {
  if (stream && operationOptions.n != null && operationOptions.n > 1) {
    throw new UnsupportedFunctionalityError({
      functionality: "providerOptions.quiver.n>1 for streaming",
      message:
        "QuiverAI streaming currently supports only a single output. Use generateText with providerOptions.quiver.n for multiple outputs.",
    });
  }

  const convertedPrompt = convertToQuiverPrompt({
    prompt,
    operation: operationOptions.operation,
  });

  if (convertedPrompt.operation === "generate") {
    if (
      operationOptions.autoCrop !== undefined ||
      operationOptions.targetSize !== undefined
    ) {
      throw new InvalidArgumentError({
        argument: "providerOptions.quiver",
        message:
          "QuiverAI generate mode does not accept autoCrop or targetSize options.",
      });
    }

    return {
      model: modelId,
      n: operationOptions.n ?? 1,
      stream,
      temperature,
      top_p: topP,
      max_output_tokens: maxOutputTokens,
      presence_penalty: presencePenalty,
      instructions: convertedPrompt.instructions,
      prompt: convertedPrompt.prompt,
      references: convertedPrompt.references,
    };
  }

  return {
    model: modelId,
    n: operationOptions.n ?? 1,
    stream,
    temperature,
    top_p: topP,
    max_output_tokens: maxOutputTokens,
    presence_penalty: presencePenalty,
    image: convertedPrompt.image,
    auto_crop: operationOptions.autoCrop,
    target_size: operationOptions.targetSize,
  };
}

async function parseQuiverOptions({
  providerOptions,
}: {
  providerOptions:
    | LanguageModelV2CallOptions["providerOptions"]
    | LanguageModelV3CallOptions["providerOptions"];
}): Promise<QuiverLanguageModelOptions> {
  const options = await parseProviderOptions({
    provider: "quiver",
    providerOptions,
    schema: quiverLanguageModelOptionsSchema,
  });

  if (options == null) {
    throw new InvalidArgumentError({
      argument: "providerOptions.quiver.operation",
      message:
        'QuiverAI requires providerOptions.quiver.operation to be set to "generate" or "vectorize".',
    });
  }

  return options;
}

function collectWarningsV3(
  options: LanguageModelV3CallOptions,
): SharedV3Warning[] {
  const warnings: SharedV3Warning[] = [];

  if (options.topK != null)
    warnings.push({ type: "unsupported", feature: "topK" });
  if (options.frequencyPenalty != null) {
    warnings.push({ type: "unsupported", feature: "frequencyPenalty" });
  }
  if (options.seed != null)
    warnings.push({ type: "unsupported", feature: "seed" });
  if (options.stopSequences != null) {
    warnings.push({ type: "unsupported", feature: "stopSequences" });
  }

  return warnings;
}

function collectWarningsV2(
  options: LanguageModelV2CallOptions,
): LanguageModelV2CallWarning[] {
  const warnings: LanguageModelV2CallWarning[] = [];

  if (options.topK != null) {
    warnings.push({ type: "unsupported-setting", setting: "topK" });
  }
  if (options.frequencyPenalty != null) {
    warnings.push({
      type: "unsupported-setting",
      setting: "frequencyPenalty",
    });
  }
  if (options.seed != null) {
    warnings.push({ type: "unsupported-setting", setting: "seed" });
  }
  if (options.stopSequences != null) {
    warnings.push({
      type: "unsupported-setting",
      setting: "stopSequences",
    });
  }

  return warnings;
}

function validateUnsupportedFeatures(
  options: LanguageModelV3CallOptions | LanguageModelV2CallOptions,
) {
  if (options.tools != null && options.tools.length > 0) {
    throw new UnsupportedFunctionalityError({
      functionality: "tools",
      message: "QuiverAI does not support tools or tool calling.",
    });
  }

  if (options.toolChoice != null) {
    throw new UnsupportedFunctionalityError({
      functionality: "toolChoice",
      message: "QuiverAI does not support tool choice configuration.",
    });
  }

  if (options.responseFormat?.type === "json") {
    throw new UnsupportedFunctionalityError({
      functionality: "responseFormat.json",
      message: "QuiverAI only returns SVG text and does not support JSON mode.",
    });
  }
}

function getOperationPath(operation: QuiverLanguageModelOptions["operation"]) {
  return operation === "generate"
    ? "/svgs/generations"
    : "/svgs/vectorizations";
}

function getSnapshotDelta(previous: string, next: string) {
  if (previous.length === 0) {
    return { reset: false, delta: next };
  }

  if (next.startsWith(previous)) {
    return {
      reset: false,
      delta: next.slice(previous.length),
    };
  }

  return { reset: true, delta: next };
}

export { publicErrorEnvelopeSchema, svgResponseSchema, svgStreamChunkSchema };
export type { PublicErrorEnvelope };
