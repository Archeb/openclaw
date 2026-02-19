import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import type { ReplyPayload } from "../types.js";
import { applyMessageSplitting } from "./split-payloads.js";

describe("applyMessageSplitting", () => {
  it("should return original replies if config is missing", () => {
    const replies: ReplyPayload[] = [{ text: "hello" }];
    const cfg: OpenClawConfig = {};
    expect(applyMessageSplitting(replies, cfg)).toEqual(replies);
  });

  it("should split long messages based on config", () => {
    const longText = "line1\n\nline2\n\nline3\n\nline4";
    const replies: ReplyPayload[] = [{ text: longText }];
    const cfg: OpenClawConfig = {
      messages: {
        splitLongMessages: {
          maxParagraphs: 2,
        },
      },
    };

    const result = applyMessageSplitting(replies, cfg);
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe("line1\n\nline2");
    expect(result[1].text).toBe("line3\n\nline4");
  });

  it("should strip metadata from subsequent chunks", () => {
    const longText = "part1\n\npart2";
    const replies: ReplyPayload[] = [
      {
        text: longText,
        mediaUrl: "http://example.com/image.png",
        replyToId: "123",
      },
    ];
    const cfg: OpenClawConfig = {
      messages: {
        splitLongMessages: {
          maxParagraphs: 1,
        },
      },
    };

    const result = applyMessageSplitting(replies, cfg);
    expect(result).toHaveLength(2);

    // First chunk keeps metadata
    expect(result[0].text).toBe("part1");
    expect(result[0].mediaUrl).toBe("http://example.com/image.png");
    expect(result[0].replyToId).toBe("123");

    // Second chunk strips metadata
    expect(result[1].text).toBe("part2");
    expect(result[1].mediaUrl).toBeUndefined();
    expect(result[1].replyToId).toBeUndefined();
  });

  it("should not split messages with channelData", () => {
    const longText = "line1\n\nline2";
    const replies: ReplyPayload[] = [
      {
        text: longText,
        channelData: { some: "data" },
      },
    ];
    const cfg: OpenClawConfig = {
      messages: {
        splitLongMessages: {
          maxParagraphs: 1,
        },
      },
    };

    const result = applyMessageSplitting(replies, cfg);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(replies[0]);
  });
});
