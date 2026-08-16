import { DISEASES, type DiseaseEntry } from "./knowledge/diseases.js";

/**
 * Crop lookup + knowledge base accessors. The KB is the ONLY set of diagnoses
 * the agent is allowed to return, so it never invents a cure.
 */

const CROP_SYNONYMS: Record<string, string[]> = {
  tomato: ["tomato", "tomata", "tamatar", "tomatoes"],
  potato: ["potato", "potatoes", "aloo", "alu", "aalu"],
  chilli: ["chilli", "chili", "chillies", "mirch", "mirchi"],
  brinjal: ["brinjal", "eggplant", "baingan", "baigan"],
  rice: ["rice", "paddy", "dhan", "chaaval", "chawal"],
  wheat: ["wheat", "gehoon", "gehun", "gahun", "gehu"],
  maize: ["maize", "corn", "makka", "bhutta", "makkai"],
  okra: ["okra", "bhindi", "lady finger", "ladyfinger"],
  mango: ["mango", "aam"],
  cotton: ["cotton", "kapas", "ruyi", "rui"],
  onion: ["onion", "pyaaz", "kanda", "piyaz"],
};

export function normalizeCrop(input: string): string | null {
  const q = input.toLowerCase();
  for (const [crop, syns] of Object.entries(CROP_SYNONYMS)) {
    if (syns.some((s) => q.includes(s))) return crop;
  }
  return null;
}

export function crops(): string[] {
  return Object.keys(CROP_SYNONYMS);
}

export function entriesForCrop(crop: string): DiseaseEntry[] {
  return DISEASES.filter((d) => d.crop === crop);
}

export function allEntries(): DiseaseEntry[] {
  return DISEASES;
}

/** The KB as a compact JSON block for a system prompt. */
export function kbPromptBlock(entries: DiseaseEntry[]): string {
  return JSON.stringify(
    entries.map((d) => ({
      crop: d.crop,
      name: d.name,
      hindi: d.hindi,
      symptoms: d.symptoms,
      organic: d.organic,
      chemical: d.chemical,
      prevention: d.prevention,
    })),
  );
}

/** Case-insensitive lookup of a disease by its English name. */
export function findEntry(entries: DiseaseEntry[], name: string): DiseaseEntry | null {
  return entries.find((e) => e.name.toLowerCase() === name.trim().toLowerCase()) ?? null;
}

/**
 * Match a farmer's words to KB entries by their symptom keywords. Used for
 * text-only disease messages (no photo) so the agent can ground a reply in the
 * KB without a vision call or an ungrounded LLM answer.
 */
const SYMPTOM_KEYWORDS: Record<string, string[]> = {
  "safed dhabe": ["Powdery Mildew", "Churni phuphendi"],
  "bhure dhabe": ["Brown Spot", "Brown Rust", "Baingani dhabbe", "Matti dhabbe"],
  "kaale dhabe": ["Black Rust", "Anthracnose", "Kona dhabbe"],
  "peele dhabe": ["Yellow Rust", "Yellow Vein Mosaic Virus", "Purple Blotch"],
  "dhabbe": ["Leaf Spot", "Patta dhabbe"],
  "jhulsa": ["Blast jhulsa", "Patta jhulsa", "Der se jhulsa", "Shuruaati jhulsa", "Common Rust"],
  "mud": ["Patta mudna", "Patta chhota rog", "Peeli nas rog"],
  "keeda": ["Phal ka keeda", "Murjhana", "Patta chhota rog"],
  "murjha": ["Mala rog", "Murjhana", "Bacteriyai murjhana"],
  "gal": ["Phal galana", "Phal sadna", "Phal ka keeda"],
  "patta peela": ["Yellow Rust", "Powdery Mildew", "Peeli nas rog"],
  "sukh": ["Leaf Curl Virus", "Fusarium Wilt", "Cercospora Leaf Spot"],
};

export function matchSymptoms(text: string, crop?: string): DiseaseEntry | null {
  const q = text.toLowerCase();
  const pool = crop ? entriesForCrop(crop) : allEntries();
  let best: DiseaseEntry | null = null;
  let bestScore = 0;
  for (const entry of pool) {
    let score = 0;
    for (const [kw, names] of Object.entries(SYMPTOM_KEYWORDS)) {
      if (q.includes(kw) && names.some((n) => entry.name === n || entry.hindi === n)) score++;
    }
    // also match the entry's own symptom strings loosely
    for (const sym of entry.symptoms) {
      const head = sym.toLowerCase().split(" ").slice(0, 2).join(" ");
      if (head.length > 4 && q.includes(head)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return bestScore > 0 ? best : null;
}
