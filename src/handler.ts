import type { CommClient, Message } from "caspian-sdk";
import { Brain, type ReplySpec } from "./brain.js";
import fs from "fs";
import path from "path";

/**
 * Adapts an SDK Message into the brain and routes the reply back to the same
 * channel and thread. One handler for every channel.
 *
 * During rolling deploys or multiple instances (local + Render), the same
 * message may be delivered to multiple processes. This file-based dedup
 * ensures each message is only handled once across all instances within
 * a short window.
 */
const DEDUP_WINDOW_MS = 10_000;
const DEDUP_DIR = path.join(process.cwd(), ".dedup");

function ensureDedupDir(): void {
  if (!fs.existsSync(DEDUP_DIR)) {
    fs.mkdirSync(DEDUP_DIR, { recursive: true });
  }
}

function getDedupFile(conversationId: string): string {
  // Hash conversationId to avoid filesystem issues with special chars
  const hash = Buffer.from(conversationId).toString("base64url").slice(0, 32);
  return path.join(DEDUP_DIR, `${hash}.json`);
}

function isDuplicate(conversationId: string, message: Message): boolean {
  ensureDedupDir();
  const file = getDedupFile(conversationId);
  const now = Date.now();

  // Use conversationId + text + first-media-name as the dedup key
  const mediaKey = message.media?.[0]?.name ?? message.media?.[0]?.url ?? "";
  const key = `${conversationId}::${message.text ?? ""}::${mediaKey}`;

  let prev: { key: string; ts: number } | null = null;
  if (fs.existsSync(file)) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      prev = JSON.parse(content);
    } catch {
      // corrupted file, ignore
    }
  }

  if (prev && prev.key === key && now - prev.ts < DEDUP_WINDOW_MS) {
    return true;
  }

  // Write new dedup entry
  try {
    fs.writeFileSync(file, JSON.stringify({ key, ts: now }), "utf-8");
  } catch {
    // best effort, don't block on dedup failure
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
