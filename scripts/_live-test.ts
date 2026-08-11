import { Brain } from "../src/brain.js";
import { Store } from "../src/store.js";

const brain = new Brain(new Store("memory", true));

async function say(text: string): Promise<void> {
  const r = await brain.handle({
    conversationId: "live-test",
    channel: "telegram",
    text,
    media: [],
  });
  console.log(`\n>>> ${text}\n${r.text}`);
  if (r.blocks) console.log(`    [blocks: ${r.blocks.map((b) => b.type).join(", ")}]`);
}

await say("meri fasal tomato hai");
await say("namaste");
await say("hamara gaon Bhubaneswar hai");
await say("mausam");
await say("tomato ke patte peele ho rahe hain");
await say("ilaj");
await say("thanks bhai");
