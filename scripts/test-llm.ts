import "dotenv/config";
import { config } from "../src/config.js";
import { complete, completeJson } from "../src/llm.js";

async function main(): Promise<void> {
  console.log("Testing LLM with model:", config.geminiModel);
  console.log("API Key set:", !!config.geminiApiKey);

  if (!config.geminiApiKey) {
    console.log("No GEMINI_API_KEY set");
    return;
  }

  try {
    // Test 1: Simple text completion
    console.log("\n--- Test 1: Simple completion ---");
    const text = await complete([
      { role: "system", content: "You are Kisan Mitra, a friendly farmer advisor. Reply in Hinglish." },
      { role: "user", content: "Namaste, kaise ho?" }
    ], { temperature: 0.8, maxTokens: 100 });
    console.log("Response:", text);

    // Test 2: JSON completion (for diagnosis)
    console.log("\n--- Test 2: JSON completion ---");
    const json = await completeJson<{ disease: string; confidence: number }>([
      { role: "system", content: 'Reply only in JSON: {"disease": "...", "confidence": 0-1}' },
      { role: "user", content: "Test" }
    ], { temperature: 0, maxTokens: 100 });
    console.log("Response:", json);

    console.log("\n✅ All LLM tests passed!");
  } catch (e) {
    console.error("❌ LLM test failed:", e);
    process.exit(1);
  }
}

main();