import {
  LanguageModelV2FinishReason,
  LanguageModelV3FinishReason,
} from "@ai-sdk/provider";

export function mapQuiverFinishReasonV3(
  raw: string | undefined = "stop",
): LanguageModelV3FinishReason {
  return {
    unified: mapFinishReason(raw),
    raw,
  };
}

export function mapQuiverFinishReasonV2(
  raw: string | undefined = "stop",
): LanguageModelV2FinishReason {
  return raw == null ? "unknown" : mapFinishReason(raw);
}

function mapFinishReason(
  raw: string,
): Exclude<LanguageModelV2FinishReason, "unknown"> {
  switch (raw) {
    case "stop":
    case "length":
    case "content-filter":
    case "tool-calls":
    case "error":
    case "other":
      return raw;
    default:
      return "other";
  }
}
