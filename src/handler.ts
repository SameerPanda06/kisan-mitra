import type { CommClient, Message } from "caspian-sdk";
import { Brain, type ReplySpec } from "./brain.js";

/**
 * Adapts an SDK Message into the brain and routes the reply back to the same
 * channel and thread. One handler for every channel.
 *
 * During rolling deploys the SDK may retry the same message several times
 * before the first handler finishes (LLM calls are slow). This per-process
 * dedup map ensures each message is only handled once within a short window.
 */
const DEDUP_WINDOW_MS = 10_000;
const _lastSeen = new Map<string, { key: string; ts: number }>();

function isDuplicate(conversationId: string, message: Message): boolean {
  const now = Date.now();
  // Use conversationId + text + first-media-name as the dedup key so that
  // identical photos or button taps are also caught.
  const mediaKey = message.media?.[0]?.name ?? message.media?.[0]?.url ?? "";
  const key = `${conversationId}::${message.text ?? ""}::${mediaKey}`;
  const prev = _lastSeen.get(conversationId);
  if (prev && prev.key === key && now - prev.ts < DEDUP_WINDOW_MS) {
    return true;
  }
  _lastSeen.set(conversationId, { key, ts: now });
  // Prevent unbounded growth: if the map gets large, trim stale entries.
  if (_lastSeen.size > 500) {
    for (const [k, v] of _lastSeen) {
      if (now - v.ts > DEDUP_WINDOW_MS) _lastSeen.delete(k);
    }
  }
  return false;
}

export function makeHandler(client: CommClient, brain: Brain) {
  return async (message: Message): Promise<void> => {
    if (isDuplicate(message.conversationId, message)) {
      console.log(`[handler] dedup: skipped duplicate for ${message.conversationId}`);
      return;
    }
    try {
      const spec = await brain.handle({
        conversationId: message.conversationId,
        channel: message.channel,
        text: message.text,
        media: message.media,
      });
      await sendReply(message, spec);
    } catch (e) {
      console.error("[handler] error:", e);
      try {
        await message.reply("Kuch gadbad ho gayi. Thoda der baad dobara koshish karein. 🙏");
      } catch {
        /* channel may be gone; nothing to do */
      }
    }
  };
}

async function sendReply(message: Message, spec: ReplySpec): Promise<void> {
  await message.reply(spec.text ?? null, null, spec.blocks ?? null, spec.media ?? null);
}
