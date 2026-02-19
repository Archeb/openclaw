export type SplitOptions = {
  maxLines?: number;
  maxParagraphs?: number;
};

export function splitMessage(text: string, options: SplitOptions = {}): string[] {
  const maxLines = options.maxLines ?? 20;
  const maxParagraphs = options.maxParagraphs ?? 4;

  if (!text || typeof text !== "string") {
    return [];
  }

  // 1. Identify atomic chunks (paragraphs, code blocks)
  // We want to avoid splitting inside code blocks.

  // Support both ``` and ~~~ fences
  const codeBlockRegex = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;
  let match;
  let lastIndex = 0;
  let chunks: string[] = [];

  // We can't use matchAll because we need the index adjustments for slicing
  // and maintaining order, which exec loop does well.
  // Reset regex index just in case, though logically it's fresh.
  codeBlockRegex.lastIndex = 0;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Content before code block
    const before = text.slice(lastIndex, match.index);
    if (before.trim()) {
      chunks = chunks.concat(splitTextIntoChunks(before));
    }

    // The code block itself is an atomic chunk
    chunks.push(match[0]);

    lastIndex = match.index + match[0].length;
  }

  // Content after last code block
  const remaining = text.slice(lastIndex);
  if (remaining.trim()) {
    chunks = chunks.concat(splitTextIntoChunks(remaining));
  }

  // If no code blocks found, regular split
  if (chunks.length === 0) {
    chunks = splitTextIntoChunks(text);
  }

  // 2. Group chunks into messages
  const messages: string[] = [];
  let currentMessage: string[] = [];
  let currentLines = 0;
  let currentParagraphs = 0;

  for (const chunk of chunks) {
    // Count lines roughly
    const chunkLines = chunk.split(/\r\n|\r|\n/).length;

    // Check if adding this chunk would exceed limits
    // We always add at least one chunk to an empty message
    if (
      currentMessage.length > 0 &&
      (currentLines + chunkLines > maxLines || currentParagraphs + 1 > maxParagraphs)
    ) {
      messages.push(currentMessage.join("\n\n"));
      currentMessage = [];
      currentLines = 0;
      currentParagraphs = 0;
    }

    currentMessage.push(chunk);
    currentLines += chunkLines;
    currentParagraphs += 1;
  }

  if (currentMessage.length > 0) {
    messages.push(currentMessage.join("\n\n"));
  }

  return messages;
}

function splitTextIntoChunks(text: string): string[] {
  // Split text by double newlines to get paragraphs.
  // Preserves list integrity mostly (unless they have blank lines).
  // Trim each chunk to remove leading/trailing whitespace.
  return text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}
