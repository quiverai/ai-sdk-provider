import { InvalidArgumentError, SharedV3Warning } from "@ai-sdk/provider";
import {
  combineHeaders,
  createJsonResponseHandler,
  convertUint8ArrayToBase64,
  parseProviderOptions,
  postJsonToApi,
} from "@ai-sdk/provider-utils";
import { z } from "zod";
import { QuiverApiConfig } from "./quiverai-config";
import { quiveraiFailedResponseHandler } from "./quiverai-error";
import {
  SvgGenerationResponse,
  SvgUsage,
  svgGenerationResponseSchema,
} from "./quiverai-api-types";

const quiverImageModelOptionsSchema = z
  .object({
    operation: z.enum(["generate", "vectorize"]).optional(),
  })
  .strict();

type QuiverGenerateBody = {
  model: string;
  n: number;
  prompt: string;
};

type QuiverVectorizeBody = {
  model: string;
  n: number;
  image: { url: string } | { base64: string };
};

export type QuiverOperation = "generate" | "vectorize";

export type QuiverRequestBody = QuiverGenerateBody | QuiverVectorizeBody;

export async function parseQuiverImageOptions(providerOptions?: {
  [key: string]: unknown;
}): Promise<{ operation: QuiverOperation }> {
  const options = await parseProviderOptions({
    provider: "quiverai",
    providerOptions,
    schema: quiverImageModelOptionsSchema,
  });

  return {
    operation: options?.operation ?? "generate",
  };
}

export function buildRequestBody({
  modelId,
  n,
  prompt,
  files,
  operation,
}: {
  modelId: string;
  n: number;
  prompt: string | undefined;
  files: ImageInput[] | undefined;
  operation: QuiverOperation;
}): QuiverRequestBody {
  if (operation === "generate") {
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
    image:
      image.type === "url"
        ? { url: image.url }
        : {
            base64:
              typeof image.data === "string"
                ? image.data
                : convertUint8ArrayToBase64(image.data),
          },
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
  config: QuiverApiConfig;
  body: QuiverRequestBody;
  headers?: Record<string, string | undefined>;
  abortSignal?: AbortSignal;
  operation: QuiverOperation;
}) {
  return postJsonToApi({
    url: config.url(getOperationPath(operation)),
    headers: combineHeaders(config.headers(), headers),
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
}: {
  size: `${number}x${number}` | undefined;
  aspectRatio: `${number}:${number}` | undefined;
  seed: number | undefined;
  mask: unknown;
}): SharedV3Warning[] {
  const warnings: SharedV3Warning[] = [];

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
