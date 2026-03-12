import { InvalidPromptError } from "@ai-sdk/provider";
import { describe, expect, it } from "vitest";
import { convertToQuiverPrompt } from "./convert-to-quiverai-prompt";

describe("convertToQuiverPrompt", () => {
  it("maps generate prompts with text, system instructions, and references", () => {
    const prompt = [
      { role: "system" as const, content: "Use clean geometric shapes." },
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: "Draw a square icon." },
          {
            type: "file" as const,
            mediaType: "image/png",
            data: new URL("https://cdn.quiver.ai/reference.png"),
          },
          {
            type: "file" as const,
            mediaType: "image/jpeg",
            data: new Uint8Array([1, 2, 3]),
          },
        ],
      },
    ];

    expect(convertToQuiverPrompt({ prompt, operation: "generate" })).toEqual({
      operation: "generate",
      instructions: "Use clean geometric shapes.",
      prompt: "Draw a square icon.",
      references: [
        { url: "https://cdn.quiver.ai/reference.png" },
        { base64: "AQID" },
      ],
    });
  });

  it("maps vectorize prompts from a single raster image", () => {
    const prompt = [
      {
        role: "user" as const,
        content: [
          {
            type: "file" as const,
            mediaType: "image/webp",
            data: "QUJD",
          },
        ],
      },
    ];

    expect(convertToQuiverPrompt({ prompt, operation: "vectorize" })).toEqual({
      operation: "vectorize",
      image: { base64: "QUJD" },
    });
  });

  it("rejects multi-turn prompts and assistant messages", () => {
    const prompt = [
      {
        role: "user" as const,
        content: [{ type: "text" as const, text: "first" }],
      },
      {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "second" }],
      },
    ];

    expect(() =>
      convertToQuiverPrompt({ prompt, operation: "generate" }),
    ).toThrow(InvalidPromptError);
  });

  it("rejects generate prompts without text input", () => {
    const prompt = [
      {
        role: "user" as const,
        content: [
          {
            type: "file" as const,
            mediaType: "image/png",
            data: new Uint8Array([1]),
          },
        ],
      },
    ];

    expect(() =>
      convertToQuiverPrompt({ prompt, operation: "generate" }),
    ).toThrow("QuiverAI generate mode requires user text input.");
  });

  it("rejects vectorize prompts with text or system instructions", () => {
    const prompt = [
      { role: "system" as const, content: "Please be precise." },
      {
        role: "user" as const,
        content: [{ type: "text" as const, text: "Vectorize this." }],
      },
    ];

    expect(() =>
      convertToQuiverPrompt({ prompt, operation: "vectorize" }),
    ).toThrow("QuiverAI vectorize mode does not support system instructions");
  });

  it("rejects vectorize prompts without exactly one raster image", () => {
    const prompt = [
      {
        role: "user" as const,
        content: [
          {
            type: "file" as const,
            mediaType: "image/svg+xml",
            data: new Uint8Array([1]),
          },
        ],
      },
    ];

    expect(() =>
      convertToQuiverPrompt({ prompt, operation: "vectorize" }),
    ).toThrow(
      "QuiverAI vectorize mode only supports PNG, JPEG, or WebP inputs.",
    );
  });
});
