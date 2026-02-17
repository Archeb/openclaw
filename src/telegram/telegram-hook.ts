/**
 * Telegram message hook loader.
 *
 * Loads an external JS module (if present) that can intercept, buffer, enrich,
 * or otherwise transform inbound Telegram messages before they reach the
 * standard message processor.
 *
 * Hook path is resolved from (in order):
 *   1. OPENCLAW_TELEGRAM_HOOK env var
 *   2. ~/.openclaw/telegram-hook.mjs
 *
 * The external module should export:
 *   onInboundMessage({ ctx, allMedia, storeAllowFrom, options, processMessage }) => Promise<void>
 *
 * When the hook handles the message itself (e.g. buffering for batch),
 * it simply does NOT call processMessage. When it wants normal processing,
 * it calls processMessage(ctx, allMedia, storeAllowFrom, options).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { TelegramMediaRef } from "./bot-message-context.js";
import type { TelegramContext } from "./bot/types.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const logger = createSubsystemLogger("telegram-hook");

export type ProcessMessageFn = (
  primaryCtx: TelegramContext,
  allMedia: TelegramMediaRef[],
  storeAllowFrom: string[],
  options?: { messageIdOverride?: string; forceWasMentioned?: boolean },
) => Promise<void>;

export type TelegramHookArgs = {
  ctx: TelegramContext;
  allMedia: TelegramMediaRef[];
  storeAllowFrom: string[];
  options?: { messageIdOverride?: string; forceWasMentioned?: boolean };
  processMessage: ProcessMessageFn;
  log: (message: string) => void;
};

export type TelegramHookModule = {
  onInboundMessage: (args: TelegramHookArgs) => Promise<void>;
};

function resolveHookPath(): string {
  if (process.env.OPENCLAW_TELEGRAM_HOOK) {
    return process.env.OPENCLAW_TELEGRAM_HOOK;
  }
  return path.join(os.homedir(), ".openclaw", "telegram-hook.mjs");
}

/**
 * Wraps a processMessage function with an optional external hook.
 *
 * The hook is loaded lazily on first invocation so that this function
 * remains synchronous (createTelegramBot is sync and we don't want to
 * change its signature).
 */
export function wrapWithTelegramHook(original: ProcessMessageFn): ProcessMessageFn {
  let resolved = false;
  let hook: TelegramHookModule | null = null;

  const loadHook = async (): Promise<TelegramHookModule | null> => {
    if (resolved) {
      return hook;
    }
    resolved = true;

    const hookPath = resolveHookPath();
    if (!fs.existsSync(hookPath)) {
      logger.info("telegram-hook: no hook file found, using default processing");
      return null;
    }

    try {
      const mod = (await import(hookPath)) as TelegramHookModule;
      if (typeof mod.onInboundMessage !== "function") {
        logger.warn(
          `telegram-hook: hook at ${hookPath} does not export onInboundMessage, skipping`,
        );
        return null;
      }
      logger.info(`telegram-hook: loaded hook from ${hookPath}`);
      hook = mod;
      return hook;
    } catch (err) {
      logger.error(`telegram-hook: failed to load hook from ${hookPath}: ${String(err)}`);
      return null;
    }
  };

  return async (ctx, allMedia, storeAllowFrom, options) => {
    const h = await loadHook();
    if (!h) {
      await original(ctx, allMedia, storeAllowFrom, options);
      return;
    }
    await h.onInboundMessage({
      ctx,
      allMedia,
      storeAllowFrom,
      options,
      processMessage: original,
      log: (message: string) => logger.info(message),
    });
  };
}
