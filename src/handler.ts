import type { CommClient, Message } from "caspian-sdk";
import { Brain, type ReplySpec } from "./brain.js";
import fs from "fs";
import path from "path";

/**
 * Adapts an SDK Message into the brain and routes the reply back to the same
 * channel and thread. One handler for every channel.
 *
 * Dedup strategy:
 * 1. File-based (shared FS for rolling deploys on same host)
 * 2. In-memory per-process (fast path, catches SDK retries)
 * 3. Single combined reply: merge text + blocks into ONE message to avoid
 *    SDK splitting them on channels like Telegram.
 */
const DEDUP_WINDOW_MS = 10_000;
const DEDUP_DIR = path.join(process.cwd(), ".dedup");

// Per-process memory dedup (catches SDK retries within same process)
const _memoryDedup = new Map<string, { key: string; ts: number }>();

function ensureDedupDir(): void {
  if (!fs.existsSync(DEDUP_DIR)) {
    fs.mkdirSync(DEDUP_DIR, { recursive: true });
  }
}

function getDedupFile(conversationId: string): string {
  const hash = Buffer.from(conversationId).toString("base64url").slice(0, 32);
  return path.join(DEDUP_DIR, `${hash}.json`);
}

function makeDedupKey(conversationId: string, message: Message): string {
  const mediaKey = message.media?.[0]?.name ?? message.media?.[0]?.url ?? "";
  return `${conversationId}::${message.text ?? ""}::${mediaKey}`;
}

function checkMemoryDedup(key: string): boolean {
  const now = Date.now();
  const prev = _memoryDedup.get(key);
  if (prev && now - prev.ts < DEDUP_WINDOW_MS) return true;
  _memoryDedup.set(key, { key, ts: now });
  // Trim stale
  if (_memoryDedup.size > 500) {
    for (const [k, v] of _memoryDedup) {
      if (now - v.ts > DEDUP_WINDOW_MS) _memoryDedup.delete(k);
    }
  }
  return false;
}

function checkFileDedup(conversationId: string, key: string): boolean {
  ensureDedupDir();
  const file = getDedupFile(conversationId);
  const now = Date.now();

  let prev: { key: string; ts: number } | null = null;
  if (fs.existsSync(file)) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      prev = JSON.parse(content);
    } catch {
      // corrupted, ignore
    }
  }

  if (prev && prev.key === key && now - prev.ts < DEDUP_WINDOW_MS) {
    return true;
  }

  try {
    fs.writeFileSync(file, JSON.stringify({ key, ts: now }), "utf-8");
  } catch {
    // best effort
  }
  return false;
}

function isDuplicate(conversationId: string, message: Message): boolean {
  const key = makeDedupKey(conversationId, message);
  // Check both layers - memory first (fast), then file (cross-process on same host)
  if (checkMemoryDedup(key)) return true;
  if (checkFileDedup(conversationId, key)) return true;
  return false;
}

/** Merge text + blocks into single message to prevent SDK splitting on some channels. */
function mergeReply(spec: ReplySpec): { text: string; blocks?: ReplySpec["blocks"]; media?: ReplySpec["media"] } {
  // If we have blocks, append a summary to text and send blocks as-is
  // The SDK will render as one combined message on most channels
  let text = spec.text ?? "";
  if (spec.blocks?.length) {
    const blockSummary = spec.blocks
      .map((b) => {
        if (b.type === "card") return `[Card: ${b.title}]`;
        if (b.type === "heading") return `[${b.text}]`;
        if (b.type === "fields") return `[Fields: ${b.fields.length} items]`;
        if (b.type === "list") return `[List: ${b.items.length} items]`;
        if (b.type === "image") return `[Image]`;
        return `[${b.type}]`;
      })
      .join(" | ");
    text = `${text}\n\n${blockSummary}`.trim();
  }
  return { text, blocks: spec.blocks, media: spec.media };
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
      const merged = mergeReply(spec);
      await sendReply(message, merged);
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

async function sendReply(message: Message, spec: { text: string; blocks?: ReplySpec["blocks"]; media?: ReplySpec["media"] }): Promise<void> {
  await message.reply(spec.text ?? null, null, spec.blocks ?? null, spec.media ?? null);
}
