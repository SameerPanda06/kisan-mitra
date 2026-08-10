import "dotenv/config";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { config } from "../src/config.js";
import { Store } from "../src/store.js";
import { Brain } from "../src/brain.js";

/**
 * Diagnosis accuracy harness. Requires GEMINI_API_KEY.
 *
 * Drop leaf photos into tests/fixtures/. Name each file after its true
 * disease to score it, e.g. `early-blight.jpg`, `healthy-leaf.png`. Then:
 *
 *   npm run eval
 *
 * Prints a per-image result and overall accuracy. Target: 8/10.
 */
const FIXTURES = "./tests/fixtures";
const TARGET_CROP = process.env.EVAL_CROP ?? "tomato";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

function matches(got: string, label: string): boolean {
  const g = normalize(got);
  const l = normalize(label);
  if (!g || !l) return false;
  if (g === l) return true;
  // One side is a substring of the other (e.g. label "early blight leaf").
  return g.includes(l) || l.includes(g);
}

async function main(): Promise<void> {
  if (!config.geminiApiKey) {
    console.log("GEMINI_API_KEY not set. Copy .env.example to .env and add it first.");
    process.exit(1);
  }
  if (!existsSync(FIXTURES)) {
    console.log("No tests/fixtures yet.");
    return;
  }
  const files = readdirSync(FIXTURES).filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f));
  if (!files.length) {
    console.log(`No leaf images in ${FIXTURES}.`);
    return;
  }

  const brain = new Brain(new Store("memory", true));
  brain["store"].patchProfile("eval", { crop: TARGET_CROP });

  const rows: Array<{ file: string; label: string; got: string; ok: boolean }> = [];
  for (const f of files) {
    const b64 = readFileSync(join(FIXTURES, f)).toString("base64");
    const label = f.replace(/\.(jpe?g|png|webp|gif)$/i, "").replace(/[-_]/g, " ");
    const { diagnosis } = await brain.diagnoseImage(
      "eval",
      { data: b64, mimeType: "image/jpeg", name: f },
      "",
    );
    const ok = diagnosis.disease === "unknown" ? false : matches(diagnosis.disease, label);
    rows.push({ file: f, label, got: diagnosis.disease, ok });
    console.log(
      `${ok ? "✓" : "✗"}  ${f.padEnd(28)} → ${diagnosis.disease.padEnd(18)} ` +
        `conf ${diagnosis.confidence.toFixed(2)}  (label: ${label})`,
    );
  }

  const passed = rows.filter((r) => r.ok).length;
  const total = rows.length;
  console.log(`\nAccuracy: ${passed}/${total}`);
  if (total >= 10 && passed / total < 0.8) {
    console.log("Below the 8/10 target — check the photos, the crop filter, or the KB prompts.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
