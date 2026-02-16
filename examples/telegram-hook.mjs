/**
 * Example Telegram hook for openclaw.
 *
 * Place this file at ~/.openclaw/telegram-hook.mjs
 * or set OPENCLAW_TELEGRAM_HOOK env var to its path.
 *
 * This example demonstrates group message batching:
 * - DM messages pass through immediately
 * - Group messages are buffered and flushed after 3 messages or 5s idle
 */

const buffers = new Map();

const BATCH_SIZE = 3;
const IDLE_TIMEOUT_MS = 5000;
const MAX_WAIT_MS = 15000;

/**
 * @param {object} args
 * @param {object} args.ctx - grammY context with .message
 * @param {Array} args.allMedia - resolved media refs (includes fileId)
 * @param {string[]} args.storeAllowFrom
 * @param {object} [args.options]
 * @param {Function} args.processMessage - original processor
 */
export async function onInboundMessage({ ctx, allMedia, storeAllowFrom, options, processMessage }) {
  const msg = ctx.message;
  if (!msg) {
    await processMessage(ctx, allMedia, storeAllowFrom, options);
    return;
  }

  const chatType = msg.chat?.type;
  const isGroup = chatType === "group" || chatType === "supergroup";

  if (!isGroup) {
    // DM: pass through immediately
    await processMessage(ctx, allMedia, storeAllowFrom, options);
    return;
  }

  // --- Group batching logic ---
  const key = `${msg.chat.id}`;
  if (!buffers.has(key)) {
    buffers.set(key, {
      messages: [],
      timer: null,
      maxTimer: null,
      firstAt: Date.now(),
    });
  }
  const batch = buffers.get(key);

  batch.messages.push({
    ctx,
    allMedia,
    storeAllowFrom,
    options,
    senderName: [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" "),
    senderId: msg.from?.id,
    text: msg.text || msg.caption || "",
    timestamp: msg.date ? msg.date * 1000 : Date.now(),
  });

  // Clear idle timer
  if (batch.timer) clearTimeout(batch.timer);

  // Flush if batch size reached
  if (batch.messages.length >= BATCH_SIZE) {
    await flush(key, processMessage);
    return;
  }

  // Set idle timer
  batch.timer = setTimeout(() => flush(key, processMessage), IDLE_TIMEOUT_MS);

  // Set max wait timer (only on first message)
  if (!batch.maxTimer) {
    batch.maxTimer = setTimeout(() => flush(key, processMessage), MAX_WAIT_MS);
  }
}

async function flush(key, processMessage) {
  const batch = buffers.get(key);
  if (!batch || batch.messages.length === 0) return;
  buffers.delete(key);

  if (batch.timer) clearTimeout(batch.timer);
  if (batch.maxTimer) clearTimeout(batch.maxTimer);

  const messages = batch.messages;
  const last = messages[messages.length - 1];

  // Combine all media from all messages
  const combinedMedia = messages.flatMap((m) => m.allMedia);

  // Use the last message's context as primary
  // Override the body to include all messages with sender labels and timestamps
  // The hook can mutate ctx.message.text before calling processMessage
  if (messages.length > 1) {
    const combined = messages
      .map((m) => {
        const time = new Date(m.timestamp).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        return `[${time}] ${m.senderName}: ${m.text}`;
      })
      .join("\n");

    // Override the text on the primary context's message
    if (last.ctx.message) {
      last.ctx.message.text = combined;
    }
  }

  await processMessage(
    last.ctx,
    combinedMedia,
    last.storeAllowFrom,
    last.options,
  );
}
