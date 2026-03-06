import {
  FetchFunction,
  loadApiKey,
  loadOptionalSetting,
  withUserAgentSuffix,
  withoutTrailingSlash,
} from "@ai-sdk/provider-utils";
import { VERSION } from "./version";

export interface QuiverProviderSettings {
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: FetchFunction;
  name?: string;
  generateId?: () => string;
}

export type QuiverLanguageModelConfig = {
  provider: string;
  url: (path: string) => string;
  headers: () => Record<string, string>;
  fetch?: FetchFunction;
  generateId?: () => string;
};

function normalizeBaseURL(baseURL: string | undefined): string | undefined {
  const trimmedBaseURL = baseURL?.trim();
  return trimmedBaseURL && trimmedBaseURL.length > 0 ? trimmedBaseURL : undefined;
}

export function createQuiverConfig(
  options: QuiverProviderSettings = {},
): QuiverLanguageModelConfig {
  const baseURL =
    normalizeBaseURL(
      withoutTrailingSlash(
        loadOptionalSetting({
          settingValue: options.baseURL,
          environmentVariableName: "QUIVER_BASE_URL",
        }),
      ),
    ) ?? "https://api.quiver.ai/v1";

  const providerName = options.name ?? "quiver";

  const headers = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: "QUIVER_API_KEY",
          description: "QuiverAI",
        })}`,
        ...options.headers,
      },
      `ai-sdk/quiver/${VERSION}`,
    );

  return {
    provider: providerName,
    url: (path) => `${baseURL}${path}`,
    headers,
    fetch: options.fetch,
    generateId: options.generateId,
  };
}
