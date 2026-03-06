import { LanguageModelV2Usage, LanguageModelV3Usage } from "@ai-sdk/provider";
import { SvgUsage } from "./quiver-api-types";

export function convertQuiverUsageV3(
  usage: SvgUsage | undefined,
): LanguageModelV3Usage {
  return {
    inputTokens: {
      total: usage?.input_tokens,
      noCache: usage?.input_tokens,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: usage?.output_tokens,
      text: usage?.output_tokens,
      reasoning: undefined,
    },
    raw: usage,
  };
}

export function convertQuiverUsageV2(
  usage: SvgUsage | undefined,
): LanguageModelV2Usage {
  return {
    inputTokens: usage?.input_tokens,
    outputTokens: usage?.output_tokens,
    totalTokens: usage?.total_tokens,
    reasoningTokens: undefined,
    cachedInputTokens: undefined,
  };
}
