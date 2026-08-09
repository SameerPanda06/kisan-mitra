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
  wheat: ["wheat", "gehoon", "gehun", "gahun"],
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
