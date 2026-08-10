import "dotenv/config";
import { existsSync, readFileSync } from "node:fs";
import { config } from "../src/config.js";
import { Store } from "../src/store.js";
import { Brain } from "../src/brain.js";

/**
 * Local dry run without connecting channels. Exercises help, profile, weather,
 * and (if a fixture image exists) photo diagnosis. Needs GEMINI_API_KEY for the
 * LLM paths; needs no CASPIAN key.
 */
const store = new Store("memory", true);
const brain = new Brain(store);
const conv = "smoke-test";

async function show(label: string, text: string | null, media: unknown[] = []): Promise<void> {
  const spec = await brain.handle({
    conversationId: conv,
    channel: "cli",
    text,
    media: media as never[],
  });
  console.log(`\n── ${label} ──`);
  console.log(spec.text);
  if (spec.blocks?.length) console.log(`[${spec.blocks.length} blocks: ${spec.blocks.map((b) => b.type).join(", ")}]`);
}

async function main(): Promise<void> {
  const hasGemini = !!config.geminiApiKey;
  await show("help", "help");
  await show("set crop", "meri fasal tomato hai");
  await show("set district", "hamara gaon Bhubaneswar hai");

  if (!hasGemini) {
    console.log(
      "\nGEMINI_API_KEY not set — skipping weather tip, crop advice, and photo diagnosis.",
    );
    console.log("Copy .env.example to .env and add GEMINI_API_KEY to test those.");
    return;
  }

  await show("weather", "mausam");

  const fixture = "./tests/fixtures/leaf.jpg";
  if (existsSync(fixture)) {
    const b64 = readFileSync(fixture).toString("base64");
    await show("photo diagnosis", "tomato pe dhabbe hain", [
      { data: b64, mimeType: "image/jpeg", name: "leaf.jpg" },
    ]);
  } else {
    console.log("\n(no tests/fixtures/leaf.jpg — drop a real leaf photo there to test diagnosis)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
