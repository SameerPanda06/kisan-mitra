import { describe, expect, it } from "vitest";
import {
  normalizeCrop,
  crops,
  entriesForCrop,
  allEntries,
  findEntry,
} from "../src/knowledge.js";
import { DISEASES } from "../src/knowledge/diseases.js";

describe("crop synonyms", () => {
  it("maps Hindi and English crop names", () => {
    expect(normalizeCrop("meri fasal tomato hai")).toBe("tomato");
    expect(normalizeCrop("main aloo ugata hoon")).toBe("potato");
    expect(normalizeCrop("bhindi")).toBe("okra");
    expect(normalizeCrop("gehoon")).toBe("wheat");
    expect(normalizeCrop("xyzzy")).toBeNull();
  });
});

describe("knowledge base coverage", () => {
  it("covers every crop in the synonym table with entries", () => {
    for (const crop of crops()) {
      expect(entriesForCrop(crop).length, `${crop} has entries`).toBeGreaterThanOrEqual(2);
    }
  });

  it("every entry has the fields the prompt depends on", () => {
    expect(DISEASES.length).toBeGreaterThanOrEqual(30);
    for (const d of DISEASES) {
      expect(d.crop).toBeTruthy();
      expect(d.name).toBeTruthy();
      expect(d.hindi).toBeTruthy();
      expect(d.symptoms.length).toBeGreaterThan(0);
      expect(d.organic).toBeTruthy();
      expect(d.chemical).toBeTruthy();
      expect(d.prevention).toBeTruthy();
    }
  });

  it("findEntry matches case-insensitively", () => {
    const hit = findEntry(allEntries(), "EARLY BLIGHT");
    expect(hit).not.toBeNull();
    expect(hit?.crop).toBe("tomato");
  });
});
