import { describe, expect, it } from "vitest";
import { helpCard, diagnosisCard, weatherCard, type Diagnosis } from "../src/cards.js";

describe("card builders", () => {
  it("help card is a heading + text + list", () => {
    const blocks = helpCard();
    expect(blocks.map((b) => b.type)).toEqual(["heading", "text", "list"]);
  });

  it("diagnosis card includes the image, the disease, and tappable buttons", () => {
    const d: Diagnosis = {
      disease: "Early Blight",
      crop: "tomato",
      confidence: 0.9,
      organic: "neem",
      chemical: "mancozeb",
      prevention: "rotation",
      note: "",
    };
    const blocks = diagnosisCard(d, "https://img/leaf.jpg", "tomato");
    expect(blocks.some((b) => b.type === "image")).toBe(true);
    const card = blocks.find((b) => b.type === "card");
    expect(card?.title).toBe("Early Blight");
    expect(card?.subtitle).toBe("Fasal: tomato");
    expect(card?.buttons).toEqual([
      { label: "Mausam", value: "mausam" },
      { label: "Ilaj (full)", value: "ilaj" },
      { label: "Naya sawal", value: "sawal" },
    ]);
  });

  it("unknown diagnosis yields a polite no-guess card without a treatment", () => {
    const d: Diagnosis = {
      disease: "unknown",
      crop: "tomato",
      confidence: 0.2,
      organic: "",
      chemical: "",
      prevention: "",
      note: "kuch samajh nahi aaya",
    };
    const blocks = diagnosisCard(d);
    expect(blocks.some((b) => b.type === "card")).toBe(false);
    expect(blocks[0].type).toBe("heading");
  });

  it("weather card renders a fields row per day", () => {
    const blocks = weatherCard({
      location: "Bhubaneswar",
      summary: "Mostly dry today.",
      days: [
        { date: "2026-08-10", tMax: 32, tMin: 26, rainMm: 0, rainProb: 10, windKmh: 12, uv: 7 },
        { date: "2026-08-11", tMax: 31, tMin: 25, rainMm: 2, rainProb: 60, windKmh: 10, uv: 5 },
      ],
    });
    expect(blocks.some((b) => b.type === "heading")).toBe(true);
    const fields = blocks.find((b) => b.type === "fields");
    expect(fields?.fields).toHaveLength(2);
    expect(fields?.fields?.[1].value).toContain("60%");
  });
});
