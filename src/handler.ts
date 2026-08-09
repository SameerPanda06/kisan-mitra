import type { CommClient, Message } from "caspian-sdk";
import { Brain, type ReplySpec } from "./brain.js";

/**
 * Adapts an SDK Message into the brain and routes the reply back to the same
 * channel and thread. One handler for every channel.
 */
export function makeHandler(client: CommClient, brain: Brain) {
  return async (message: Message): Promise<void> => {
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
