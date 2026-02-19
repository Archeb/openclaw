import type { OpenClawConfig } from "../../config/config.js";
import type { ReplyPayload } from "../types.js";
import { splitMessage } from "../../utils/message-splitter.js";

/**
 * Applies configured message splitting to a list of reply payloads.
 * Returns a new list of payloads where text-heavy messages are split into multiple chunks
 * according to `config.messages.splitLongMessages`.
 */
export function applyMessageSplitting(
  replies: ReplyPayload[],
  cfg: OpenClawConfig,
): ReplyPayload[] {
  const splitConfig = cfg.messages?.splitLongMessages;
  if (!splitConfig) {
    return replies;
  }

  const splitOptions = typeof splitConfig === "object" ? splitConfig : {};
  const splitReplies: ReplyPayload[] = [];

  for (const reply of replies) {
    // Only split text-heavy replies without specialized channel data
    if (typeof reply.text === "string" && !reply.channelData) {
      const parts = splitMessage(reply.text, splitOptions);
      // If the message is short enough or can't be split, keep it as is
      if (parts.length <= 1) {
        splitReplies.push(reply);
        continue;
      }

      parts.forEach((part, idx) => {
        const newPayload: ReplyPayload = { ...reply, text: part };
        // For subsequent chunks, strip media and reply-quote info
        // so they appear as natural follow-up messages.
        if (idx > 0) {
          delete newPayload.mediaUrl;
          delete newPayload.mediaUrls;
          delete newPayload.replyToId;
          delete newPayload.replyToTag;
          delete newPayload.replyToCurrent;
          delete newPayload.audioAsVoice;
        }
        splitReplies.push(newPayload);
      });
    } else {
      splitReplies.push(reply);
    }
  }

  return splitReplies;
}
