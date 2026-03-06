export const generateSvgResponseFixture = {
  id: "svg-gen-1",
  created: 1_741_215_200,
  data: [
    {
      svg: '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
      mime_type: "image/svg+xml" as const,
    },
  ],
  usage: {
    total_tokens: 30,
    input_tokens: 12,
    output_tokens: 18,
  },
};

export const vectorizeSvgResponseFixture = {
  id: "svg-vec-1",
  created: 1_741_215_260,
  data: [
    {
      svg: '<svg viewBox="0 0 4 4"><path d="M0 0L4 4"/></svg>',
      mime_type: "image/svg+xml" as const,
    },
  ],
  usage: {
    total_tokens: 18,
    input_tokens: 8,
    output_tokens: 10,
  },
};

export const multiOutputSvgResponseFixture = {
  id: "svg-gen-many",
  created: 1_741_215_280,
  data: [
    {
      svg: '<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
      mime_type: "image/svg+xml" as const,
    },
    {
      svg: '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
      mime_type: "image/svg+xml" as const,
    },
  ],
  usage: {
    total_tokens: 42,
    input_tokens: 12,
    output_tokens: 30,
  },
};

export const generateStreamChunksFixture = [
  toSseChunk({
    type: "generating",
    reasoning: "Legacy QuiverAI reasoning text that should be ignored.",
  }),
  toSseChunk({
    type: "draft",
    id: "svg-stream-1",
    svg: "<svg>",
  }),
  toSseChunk({
    type: "draft",
    id: "svg-stream-1",
    svg: '<path d="M0 0',
  }),
  toSseChunk({
    type: "content",
    id: "svg-stream-1",
    svg: "<svg>",
  }),
  toSseChunk({
    type: "content",
    id: "svg-stream-1",
    svg: '<svg><path d="M0 0L10 10"/></svg>',
    usage: {
      total_tokens: 24,
      input_tokens: 9,
      output_tokens: 15,
    },
  }),
];

export const resetStreamChunksFixture = [
  toSseChunk({
    type: "generating",
    reasoning: "Legacy QuiverAI reasoning text that should be ignored.",
  }),
  toSseChunk({
    type: "draft",
    id: "svg-stream-reset",
    svg: "<svg>",
  }),
  toSseChunk({
    type: "draft",
    id: "svg-stream-reset",
    svg: '<rect width="10"/>',
  }),
  toSseChunk({
    type: "content",
    id: "svg-stream-reset",
    svg: '<svg><path d="M0 0"/></svg>',
    usage: {
      total_tokens: 14,
      input_tokens: 6,
      output_tokens: 8,
    },
  }),
  toSseChunk({
    type: "content",
    id: "svg-stream-reset",
    svg: '<svg><path d="M1 1"/></svg>',
  }),
];

export const vectorizeStreamChunksFixture = [
  toSseChunk({
    type: "content",
    id: "svg-stream-vec",
    svg: '<svg viewBox="0 0 4 4">',
  }),
  toSseChunk({
    type: "content",
    id: "svg-stream-vec",
    svg: '<svg viewBox="0 0 4 4"><path d="M0 0L4 4"/></svg>',
    usage: {
      total_tokens: 16,
      input_tokens: 7,
      output_tokens: 9,
    },
  }),
];

export const malformedSvgResponseFixture = {
  id: "bad-svg-1",
  created: 1_741_215_320,
  data: [],
};

function toSseChunk(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}
