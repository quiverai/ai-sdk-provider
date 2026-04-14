import { createJsonErrorResponseHandler } from "@ai-sdk/provider-utils";
import { publicErrorEnvelopeSchema } from "./quiverai-api-types";

export const quiveraiFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: publicErrorEnvelopeSchema,
  errorToMessage: (error) => error.message,
  isRetryable: (response) => response.status === 429 || response.status >= 500,
});
