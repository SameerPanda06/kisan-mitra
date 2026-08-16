import "dotenv/config";
import { config } from "../src/config.js";
import { Store } from "../src/store.js";
import { Brain } from "../src/brain.js";
import { complete } from "../src/llm.js";

/**
 * Comprehensive test to verify all bot functionality works end-to-end
 */
const store = new Store("memory", true);
const brain = new Brain(store);
const conv = "comprehensive-test";

async function test(label: string, text: string | null, media: unknown[] = []): Promise<void> {
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
  console.log("=====================================");
  console.log("Kisan Mitra - Comprehensive Test Suite");
  console.log("=====================================");
  console.log("Model:", config.geminiModel);
  console.log("Gemini API Key:", config.geminiApiKey ? "SET" : "NOT SET");

  // Test 1: Help/Greeting
  await test("1. Help/Greeting", "help");

  // Test 2: Set crop
  await test("2. Set crop (tomato)", "meri fasal tomato hai");

  // Test 3: Set district
  await test("3. Set district (Bhubaneswar)", "hamara gaon Bhubaneswar hai");

  // Test 4: Weather request
  await test("4. Weather request", "mausam");

  // Test 5: Crop advice (general question)
  await test("5. General question", "tomato ko kitna paani chahiye");

  // Test 6: Disease text query (should ask for photo)
  await test("6. Disease text query", "tomato ke patte peele ho rahe hain");

  // Test 7: Ilaj request (no prior diagnosis - should ask for photo)
  await test("7. Ilaj without diagnosis", "ilaj");

  // Test 8: Photo diagnosis (using fixture)
  const fs = await import("fs");
  const fixture = "./tests/fixtures/early-blight.jpg";
  if (fs.existsSync(fixture)) {
    const b64 = fs.readFileSync(fixture).toString("base64");
    await test("8. Photo diagnosis (early blight)", "tomato pe dhabbe hain", [
      { data: b64, mimeType: "image/jpeg", name: "early-blight.jpg" },
    ]);

    // Test 9: Ilaj after diagnosis
    await test("9. Ilaj after diagnosis", "ilaj");
  } else {
    console.log("\n(no fixture found - skipping photo diagnosis)");
  }

  // Test 10: Verify deduplication (same message twice)
  console.log("\n── 10. Deduplication test (same message twice) ──");
  const r1 = await brain.handle({
    conversationId: "dedup-test",
    channel: "cli",
    text: "meri fasal tomato hai",
    media: [],
  });
  console.log("First:", r1.text.slice(0, 80));

  const r2 = await brain.handle({
    conversationId: "dedup-test",
    channel: "cli",
    text: "meri fasal tomato hai",
    media: [],
  });
  console.log("Second:", r2.text.slice(0, 80));
  console.log("Dedup working:", r1.text === r2.text ? "YES (same reply)" : "NO (different replies)");

  // Test 11: LLM direct test
  console.log("\n── 11. LLM Direct Test ──");
  try {
    const llmResp = await complete([
      { role: "system", content: "You are Kisan Mitra. Reply in Hinglish, 1-2 lines." },
      { role: "user", content: "Namaste bhai" }
    ], { temperature: 0.8, maxTokens: 100 });
    console.log("LLM Response:", llmResp);
    console.log("LLM Working: YES");
  } catch (e) {
    console.error("LLM Error:", e);
    console.log("LLM Working: NO");
  }

  console.log("\n=====================================");
  console.log("All tests completed!");
  console.log("=====================================");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});