import cron from "node-cron";
import type { CommClient } from "caspian-sdk";
import { config } from "./config.js";
import { Store } from "./store.js";
import { Brain } from "./brain.js";

/**
 * The agent's "hands": every morning at 06:30 IST it messages each farmer who
 * has a profile, with the day's weather and one crop tip — without being asked.
 */
export function startProactive(client: CommClient, store: Store, brain: Brain): void {
  cron.schedule(
    `${config.proactiveMinute} ${config.proactiveHour} * * *`,
    async () => {
      console.log("[proactive] running morning advisory");
      const today = new Date().toISOString().slice(0, 10);
      for (const { conversationId, state } of store.all()) {
        if (state.lastProactiveDay === today) continue;
        try {
          const spec = await brain.morningAdvisory(conversationId);
          if (!spec) continue;
          await client.sendMessage(
            conversationId,
            spec.text ?? null,
            null,
            spec.blocks ?? null,
            spec.media ?? null,
          );
          store.setProactiveDay(conversationId, today);
          console.log(`[proactive] sent to ${conversationId}`);
        } catch (e) {
          console.error(`[proactive] failed for ${conversationId}:`, e);
        }
      }
    },
    { timezone: config.timezone },
  );
}
