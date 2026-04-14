import { InvalidArgumentError, SharedV4Warning } from "@ai-sdk/provider";
import {
  createJsonResponseHandler,
  convertUint8ArrayToBase64,
  parseProviderOptions,
  postJsonToApi,
} from "@ai-sdk/provider-utils";
import { z } from "zod";
import { QuiverAIConfig } from "./quiverai-config";
import { quiveraiFailedResponseHandler } from "./quiverai-error";
import {
  SvgGenerationResponse,
  SvgUsage,
  svgGenerationResponseSchema,
} from "./quiverai-api-types";

export const quiverAIImageModelOptionsSchema = z
  .object({
    operation: z.enum(["generate", "vectorize"]).optional(),
    instructions: z.string().min(1).optional(),
    temperature: z.number().min(0).max(2).optional(),
    topP: z.number().min(0).max(1).optional(),
    presencePenalty: z.number().min(-2).max(2).nullable().optional(),
    maxOutputTokens: z.number().int().min(1).max(131072).optional(),
    autoCrop: z.boolean().optional(),
    targetSize: z.number().int().min(128).max(4096).optional(),
    stream: z.boolean().optional(),
  })
  .strict();

export type QuiverAIImageModelOptions = z.infer<
  typeof quiverAIImageModelOptionsSchema
>;

type QuiverGenerateBody = {
  model: string;
  n: number;
  prompt: string;
  stream?: false;
  instructions?: string;
  temperature?: number;
  top_p?: number;
  presence_penalty?: number | null;
  max_output_tokens?: number;
  references?: Array<{ url: string } | { base64: string }>;
};

type QuiverVectorizeBody = {
  model: string;
  n: number;
  image: { url: string } | { base64: string };
  stream?: false;
  temperature?: number;
  top_p?: number;
  presence_penalty?: number | null;
  max_output_tokens?: number;
  auto_crop?: boolean;
  target_size?: number;
};

export type QuiverOperation = "generate" | "vectorize";

export type QuiverRequestBody = QuiverGenerateBody | QuiverVectorizeBody;

export async function parseQuiverAIImageModelOptions(providerOptions?: {
  [key: string]: unknown;
}): Promise<QuiverAIImageModelOptions & { operation: QuiverOperation }> {
  const options = await parseProviderOptions({
    provider: "quiverai",
    providerOptions,
    schema: quiverAIImageModelOptionsSchema,
  });

  return {
    ...options,
    operation: options?.operation ?? "generate",
  };
}

export function buildRequestBody({
  modelId,
  n,
  prompt,
  files,
  providerOptions,
}: {
  modelId: string;
  n: number;
  prompt: string | undefined;
  files: ImageInput[] | undefined;
  providerOptions: QuiverAIImageModelOptions & { operation: QuiverOperation };
}): QuiverRequestBody {
  const sharedOptions = {
    temperature: providerOptions.temperature,
    top_p: providerOptions.topP,
    presence_penalty: providerOptions.presencePenalty,
    max_output_tokens: providerOptions.maxOutputTokens,
    stream: false as const,
  };

  if (providerOptions.operation === "generate") {
    const references = files?.map(toQuiverAIImageReference);

    if (references != null && references.length > 4) {
      throw new InvalidArgumentError({
        argument: "files",
        message:
          "QuiverAI generate supports up to 4 reference images in this provider.",
      });
    }

    if (prompt == null || prompt.trim().length === 0) {
      throw new InvalidArgumentError({
        argument: "prompt",
        message:
          "QuiverAI image generation requires a non-empty prompt for generateImage.",
      });
    }

    return {
      model: modelId,
      n,
      prompt,
      ...sharedOptions,
      instructions: providerOptions.instructions,
      references,
    };
  }

  if (files == null || files.length === 0) {
    throw new InvalidArgumentError({
      argument: "files",
      message:
        'QuiverAI vectorize requires an input image. Pass an image in the generateImage prompt and set providerOptions.quiverai.operation to "vectorize".',
    });
  }

  if (files.length > 1) {
    throw new InvalidArgumentError({
      argument: "files",
      message:
        "QuiverAI vectorize accepts a single input image in this provider.",
    });
  }

  const image = files[0];

  return {
    model: modelId,
    n,
    image: toQuiverAIImageReference(image),
    ...sharedOptions,
    auto_crop: providerOptions.autoCrop,
    target_size: providerOptions.targetSize,
  };
}

function toQuiverAIImageReference(image: ImageInput) {
  return image.type === "url"
    ? { url: image.url }
    : {
        base64:
          typeof image.data === "string"
            ? image.data
            : convertUint8ArrayToBase64(image.data),
      };
}

type ImageInput =
  | {
      type: "file";
      data: string | Uint8Array;
    }
  | {
      type: "url";
      url: string;
    };

export function getOperationPath(operation: QuiverOperation) {
  return operation === "generate"
    ? "/svgs/generations"
    : "/svgs/vectorizations";
}

export async function postGenerateRequest({
  config,
  body,
  headers,
  abortSignal,
  operation,
}: {
  config: QuiverAIConfig;
  body: QuiverRequestBody;
  headers?: Record<string, string | undefined>;
  abortSignal?: AbortSignal;
  operation: QuiverOperation;
}) {
  return postJsonToApi({
    url: config.url(getOperationPath(operation)),
    headers: { ...config.headers(), ...headers },
    body,
    failedResponseHandler: quiveraiFailedResponseHandler,
    successfulResponseHandler: createJsonResponseHandler(
      svgGenerationResponseSchema,
    ),
    abortSignal,
    fetch: config.fetch,
  });
}

export function collectWarnings({
  size,
  aspectRatio,
  seed,
  mask,
  stream,
}: {
  size: `${number}x${number}` | undefined;
  aspectRatio: `${number}:${number}` | undefined;
  seed: number | undefined;
  mask: unknown;
  stream: boolean | undefined;
}): SharedV4Warning[] {
  const warnings: SharedV4Warning[] = [];

  if (size != null) {
    warnings.push({
      type: "unsupported",
      feature: "size",
      details:
        "QuiverAI SVG generation does not expose a size parameter in this provider. The setting was ignored.",
    });
  }

  if (aspectRatio != null) {
    warnings.push({
      type: "unsupported",
      feature: "aspectRatio",
      details:
        "QuiverAI SVG generation does not expose an aspectRatio parameter in this provider. The setting was ignored.",
    });
  }

  if (seed != null) {
    warnings.push({
      type: "unsupported",
      feature: "seed",
      details:
        "QuiverAI SVG generation does not expose a seed parameter in this provider. The setting was ignored.",
    });
  }

  if (mask != null) {
    warnings.push({
      type: "unsupported",
      feature: "mask",
      details:
        "QuiverAI SVG generation does not support masks in this provider. The mask was ignored.",
    });
  }

  if (stream) {
    warnings.push({
      type: "unsupported",
      feature: "stream",
      details:
        "QuiverAI streaming responses are not exposed through this generateImage provider. The request was executed in non-streaming mode.",
    });
  }

  return warnings;
}

export function convertResponseToProviderMetadata(
  response: SvgGenerationResponse,
) {
  return {
    quiverai: {
      images: response.data.map((image, index) => ({
        index,
        mimeType: image.mime_type,
      })),
    },
  };
}

export function convertResponseToImages(response: SvgGenerationResponse) {
  const encoder = new TextEncoder();
  return response.data.map((image) => encoder.encode(image.svg));
}

export function convertUsage(usage: SvgUsage | undefined) {
  if (usage == null) {
    return undefined;
  }

  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    totalTokens: usage.total_tokens,
  };
}
