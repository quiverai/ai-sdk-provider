import {
  FetchFunction,
  loadApiKey,
  loadOptionalSetting,
  withUserAgentSuffix,
  withoutTrailingSlash,
} from "@ai-sdk/provider-utils";
import { VERSION } from "./version";

export interface QuiverAIProviderSettings {
  /**
   * QuiverAI API key. Default value is taken from the `QUIVERAI_API_KEY`
   * environment variable.
   */
  apiKey?: string;
  /**
   * Base URL for the API calls. Defaults to `https://api.quiver.ai/v1`.
   */
  baseURL?: string;
  /**
   * Custom headers to include in the requests.
   */
  headers?: Record<string, string>;
  /**
   * Custom fetch implementation. You can use it as a middleware to intercept
   * requests, or to provide a custom fetch implementation for testing.
   */
  fetch?: FetchFunction;
}

export type QuiverAIConfig = {
  provider: string;
  url: (path: string) => string;
  headers: () => Record<string, string>;
  fetch?: FetchFunction;
};

export function createQuiverAIConfig(
  options: QuiverAIProviderSettings = {},
): QuiverAIConfig {
  const baseURL =
    withoutTrailingSlash(
      loadOptionalSetting({
        settingValue: options.baseURL,
        environmentVariableName: "QUIVERAI_BASE_URL",
      }),
    ) ?? "https://api.quiver.ai/v1";

  const headers = () =>
    withUserAgentSuffix(
      {
        Authorization: `Bearer ${loadApiKey({
          apiKey: options.apiKey,
          environmentVariableName: "QUIVERAI_API_KEY",
          description: "QuiverAI",
        })}`,
        ...options.headers,
      },
      `ai-sdk/quiverai/${VERSION}`,
    );

  return {
    provider: "quiverai.image",
    url: (path) => `${baseURL}${path}`,
    headers,
    fetch: options.fetch,
  };
}
