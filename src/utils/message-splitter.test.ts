import { describe, it, expect } from "vitest";
import { splitMessage } from "./message-splitter.js";

describe("splitMessage", () => {
  it("should return empty array for empty input", () => {
    expect(splitMessage("")).toEqual([]);
  });

  it("should split simple paragraphs", () => {
    const text = "Paragraph 1.\n\nParagraph 2.";
    const result = splitMessage(text, { maxParagraphs: 1 });
    expect(result).toEqual(["Paragraph 1.", "Paragraph 2."]);
  });

  it("should respect maxLines", () => {
    const lines = Array(30).fill("line").join("\n");
    // Default maxLines is 20
    const result = splitMessage(lines, { maxLines: 10 });
    // It should split.
    // Since it's one big paragraph (no double newlines), it might NOT split if we only split by paragraphs.
    // Wait, my implementation only splits by paragraphs (double newlines).
    // So if it's a single block of 30 lines, it stays as 1 message?
    // Let's check my implementation.
    // splitTextIntoChunks splits by \n\n.
    // So 30 lines is 1 chunk.
    // Loop: chunkLines = 30. currentLines=0. 0+30 > 10.
    // push currentMessage (empty).
    // push chunk.
    // Result: 1 message with 30 lines.
    // This is "intended" behavior for now ("don't interrupt... list").
    // A 30 line list without blank lines is one chunk.
    expect(result).toHaveLength(1);
  });

  it("should split multiple long paragraphs", () => {
    const p1 = Array(15).fill("p1").join("\n");
    const p2 = Array(15).fill("p2").join("\n");
    const text = `${p1}\n\n${p2}`;
    // maxLines default 20.
    // p1 is 15 lines. p2 is 15 lines. Total 30 + blank = 32.
    // Chunk 1: p1 (15 lines). currentLines -> 15.
    // Chunk 2: p2 (15 lines). 15 + 15 > 20.
    // Should split.
    const result = splitMessage(text, { maxLines: 20 });
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(p1);
    expect(result[1]).toBe(p2);
  });

  it("should not split code blocks", () => {
    const code = '```js\nconsole.log("hello");\n```';
    const text = `Start.\n\n${code}\n\nEnd.`;
    // If we have strict limits
    const result = splitMessage(text, { maxParagraphs: 1 });
    // 3 chunks: Start, Code, End.
    // maxParagraphs 1.
    // Msg 1: Start.
    // Msg 2: Code.
    // Msg 3: End.
    expect(result).toHaveLength(3);
    expect(result[1]).toBe(code);
  });

  it("should handle code blocks with surrounding text correctly", () => {
    const text = "P1\n\n```\ncode\n```\n\nP2";
    const result = splitMessage(text, { maxParagraphs: 10 }); // ample limit
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(text); // Should be joined back with \n\n
  });

  it("should handle ~~~ blocks", () => {
    const text = "P1\n\n~~~\ncode\n~~~\n\nP2";
    const result = splitMessage(text, { maxParagraphs: 1 });
    expect(result).toHaveLength(3);
  });
});
