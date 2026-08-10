import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Downloads a handful of real tomato leaf images into tests/fixtures so the
 * diagnosis eval can be scored. Source: venkat121998/Mobile-Application-To-
 * Detect-Tomato-Leaf-Diseases (public GitHub repo, PlantVillage-derived).
 *
 * Run:  npm run fetch:fixtures
 * Then: npm run eval   (needs GEMINI_API_KEY)
 */

const BASE =
  "https://raw.githubusercontent.com/venkat121998/Mobile-Application-To-Detect-Tomato-Leaf-Diseases/master";

const IMAGES: Array<{ path: string; name: string }> = [
  { path: "Rest_Api/static/Bacterial%20spot_train.JPG", name: "bacterial-spot.jpg" },
  { path: "Rest_Api/static/early.jpg", name: "early-blight.jpg" },
  { path: "tomatoleaf/app/src/main/res/drawable/lb.jpg", name: "late-blight.jpg" },
  { path: "tomatoleaf/app/src/main/res/drawable/ylc.jpg", name: "yellow-leaf-curl.jpg" },
  { path: "tomatoleaf/app/src/main/res/drawable/sm.jpg", name: "septoria-leaf-spot.jpg" },
  { path: "tomatoleaf/app/src/main/res/drawable/ms.jpg", name: "mosaic-virus.jpg" },
  { path: "tomatoleaf/app/src/main/res/drawable/lm.jpg", name: "leaf-mold.jpg" },
  { path: "tomatoleaf/app/src/main/res/drawable/bs.jpg", name: "bacterial-spot-2.jpg" },
];

const OUT = "tests/fixtures";

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  let ok = 0;
  for (const { path, name } of IMAGES) {
    const dest = join(OUT, name);
    if (existsSync(dest)) {
      console.log(`skip  ${name} (exists)`);
      ok++;
      continue;
    }
    try {
      const res = await fetch(`${BASE}/${path}`);
      if (!res.ok) {
        console.log(`fail  ${name}  http ${res.status}`);
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 2048) {
        console.log(`fail  ${name}  too small (${buf.length} bytes)`);
        continue;
      }
      writeFileSync(dest, buf);
      console.log(`ok    ${name}  ${buf.length} bytes`);
      ok++;
    } catch (e) {
      console.log(`fail  ${name}  ${(e as Error).message}`);
    }
  }
  console.log(`\n${ok}/${IMAGES.length} fixtures in place. Run "npm run eval" to score.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
