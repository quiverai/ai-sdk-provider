import {
  InvalidArgumentError,
  InvalidPromptError,
  LanguageModelV2FilePart,
  LanguageModelV2Message,
  LanguageModelV2Prompt,
  LanguageModelV2TextPart,
  LanguageModelV3FilePart,
  LanguageModelV3Message,
  LanguageModelV3Prompt,
  LanguageModelV3TextPart,
} from "@ai-sdk/provider";
import { convertToBase64 } from "@ai-sdk/provider-utils";
import { QuiverOperation } from "./quiver-language-model-options";

const RASTER_MEDIA_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

type QuiverReference = { url: string } | { base64: string };

type QuiverPromptConversion =
  | {
      operation: "generate";
      instructions: string | undefined;
      prompt: string;
      references: QuiverReference[] | undefined;
    }
  | {
      operation: "vectorize";
      image: QuiverReference;
    };

type PromptInput = LanguageModelV3Prompt | LanguageModelV2Prompt;
type QuiverMessage = LanguageModelV3Message | LanguageModelV2Message;
type QuiverSystemMessage = Extract<QuiverMessage, { role: "system" }>;
type QuiverUserMessage = Extract<QuiverMessage, { role: "user" }>;
type QuiverTextPart = LanguageModelV3TextPart | LanguageModelV2TextPart;
type QuiverFilePart = LanguageModelV3FilePart | LanguageModelV2FilePart;

export function convertToQuiverPrompt({
  prompt,
  operation,
}: {
  prompt: PromptInput;
  operation: QuiverOperation;
}): QuiverPromptConversion {
  const systemMessages = prompt.filter(isSystemMessage);
  const userMessages = prompt.filter(isUserMessage);
  const unsupportedMessages = prompt.filter(
    (message) => message.role === "assistant" || message.role === "tool",
  );

  if (unsupportedMessages.length > 0) {
    throw new InvalidPromptError({
      prompt,
      message:
        "Quiver only supports a single-turn prompt with optional system and user messages.",
    });
  }

  if (systemMessages.length > 1 || userMessages.length !== 1) {
    throw new InvalidPromptError({
      prompt,
      message:
        "Quiver requires exactly one user message and at most one system message.",
    });
  }

  if (prompt.length !== systemMessages.length + userMessages.length) {
    throw new InvalidPromptError({
      prompt,
      message:
        "Quiver does not support multi-turn prompts or additional message roles.",
    });
  }

  const systemText = systemMessages[0]?.content;
  const userMessage = userMessages[0];
  const userParts = userMessage.content as Array<
    QuiverTextPart | QuiverFilePart
  >;

  const textParts = userParts
    .filter(isTextPart)
    .map((part) => part.text)
    .filter((text) => text.length > 0);

  const fileParts = userParts.filter(isFilePart);

  if (operation === "generate") {
    if (textParts.length === 0) {
      throw new InvalidPromptError({
        prompt,
        message: "Quiver generate mode requires user text input.",
      });
    }

    if (fileParts.length > 4) {
      throw new InvalidPromptError({
        prompt,
        message: "Quiver generate mode supports at most 4 reference images.",
      });
    }

    return {
      operation,
      instructions: systemText,
      prompt: textParts.join("\n\n"),
      references:
        fileParts.length > 0
          ? fileParts.map((part) =>
              convertFilePart({ part, allowAnyImage: true, operation }),
            )
          : undefined,
    };
  }

  if (systemText) {
    throw new InvalidPromptError({
      prompt,
      message:
        "Quiver vectorize mode does not support system instructions or user text.",
    });
  }

  if (textParts.length > 0) {
    throw new InvalidPromptError({
      prompt,
      message:
        "Quiver vectorize mode does not support system instructions or user text.",
    });
  }

  if (fileParts.length !== 1) {
    throw new InvalidPromptError({
      prompt,
      message: "Quiver vectorize mode requires exactly one raster image input.",
    });
  }

  return {
    operation,
    image: convertFilePart({
      part: fileParts[0],
      allowAnyImage: false,
      operation,
    }),
  };
}

function convertFilePart({
  part,
  allowAnyImage,
  operation,
}: {
  part: QuiverFilePart;
  allowAnyImage: boolean;
  operation: QuiverOperation;
}): QuiverReference {
  if (!part.mediaType.startsWith("image/")) {
    throw new InvalidPromptError({
      prompt: part,
      message: `Quiver only supports image file parts, received ${part.mediaType}.`,
    });
  }

  if (!allowAnyImage && !RASTER_MEDIA_TYPES.has(part.mediaType)) {
    throw new InvalidPromptError({
      prompt: part,
      message: `Quiver ${operation} mode only supports PNG, JPEG, or WebP inputs.`,
    });
  }

  const data = part.data;

  if (data instanceof URL) {
    if (!/^https?:$/i.test(data.protocol)) {
      throw new InvalidArgumentError({
        argument: "file.data",
        message: "Quiver only supports http/https file URLs.",
      });
    }

    return { url: data.toString() };
  }

  if (typeof data === "string" && /^https?:\/\//i.test(data)) {
    return { url: data };
  }

  return { base64: convertToBase64(data) };
}

function isTextPart(
  part: QuiverTextPart | QuiverFilePart,
): part is QuiverTextPart {
  return part.type === "text";
}

function isFilePart(
  part: QuiverTextPart | QuiverFilePart,
): part is QuiverFilePart {
  return part.type === "file";
}

function isSystemMessage(
  message: QuiverMessage,
): message is QuiverSystemMessage {
  return message.role === "system";
}

function isUserMessage(message: QuiverMessage): message is QuiverUserMessage {
  return message.role === "user";
}
