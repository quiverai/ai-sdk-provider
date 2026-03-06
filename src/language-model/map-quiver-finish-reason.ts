import {
  LanguageModelV2FinishReason,
  LanguageModelV3FinishReason,
} from "@ai-sdk/provider";

export function mapQuiverFinishReasonV3(
  raw: string | undefined = "stop",
): LanguageModelV3FinishReason {
  return {
    unified: raw === "stop" ? "stop" : "other",
    raw,
  };
}

export function mapQuiverFinishReasonV2(
  raw: string | undefined = "stop",
): LanguageModelV2FinishReason {
  return raw === "stop" ? "stop" : "other";
}
