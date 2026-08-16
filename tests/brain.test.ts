import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/llm.js", () => ({
  complete: vi.fn(),
  completeJson: vi.fn(),
}));

vi.mock("../src/weather.js", () => ({
  getWeather: vi.fn(),
}));

import { complete, completeJson } from "../src/llm.js";
import { getWeather } from "../src/weather.js";
import { Brain } from "../src/brain.js";
import { Store } from "../src/store.js";

const mockedComplete = vi.mocked(complete);
const mockedCompleteJson = vi.mocked(completeJson);
const mockedGetWeather = vi.mocked(getWeather);

function newBrain() {
  return new Brain(new Store("memory", true));
}

function msg(conversationId: string, text: string | null, media: unknown[] = []) {
  return {
    conversationId,
    channel: "telegram",
    text,
    media: media as never[],
  };
}

describe("brain routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replies with the help card", async () => {
    const brain = newBrain();
    const r = await brain.handle(msg("c1", "help"));
    expect(r.text).toContain("Kisan Mitra");
    expect(r.blocks?.some((b) => b.type === "list")).toBe(true);
    expect(mockedComplete).not.toHaveBeenCalled();
  });

  it("stores the crop from a profile statement", async () => {
    mockedComplete.mockResolvedValue("tomato ki kheti? Badhiya chunav. Iska khayal rakhoonga. Gaon batao to mausam bhi doonga.");
    const brain = newBrain();
    const r = await brain.handle(msg("c1", "meri fasal tomato hai"));
    expect(r.text).toContain("tomato");
    expect(brain["store"].get("c1").profile.crop).toBe("tomato");
  });

  it("stores the district and warns that crop is still unknown for weather", async () => {
    const brain = newBrain();
    await brain.handle(msg("c1", "hamara gaon Bhubaneswar hai"));
    expect(brain["store"].get("c1").profile.district).toBe("Bhubaneswar");
  });

  it("returns the weather card for 'mausam' when a district is set", async () => {
    mockedGetWeather.mockResolvedValue({
      location: "Bhubaneswar",
      summary: "Mostly dry today.",
      days: [
        { date: "2026-08-10", tMax: 32, tMin: 26, rainMm: 0, rainProb: 10, windKmh: 12, uv: 7 },
      ],
    });
    const brain = newBrain();
    await brain.handle(msg("c1", "hamara gaon Bhubaneswar hai"));
    const r = await brain.handle(msg("c1", "mausam"));
    expect(r.text).toContain("Bhubaneswar");
    expect(r.blocks?.some((b) => b.type === "heading")).toBe(true);
    expect(mockedGetWeather).toHaveBeenCalledWith("Bhubaneswar");
    // No LLM call for the weather reply now (deterministic + KB tips)
    expect(mockedComplete).not.toHaveBeenCalled();
  });

  it("asks for a location before weather when none is set", async () => {
    const brain = newBrain();
    const r = await brain.handle(msg("c1", "mausam"));
    expect(r.text).toContain("gaon");
    expect(mockedGetWeather).not.toHaveBeenCalled();
    expect(mockedComplete).not.toHaveBeenCalled();
  });

  it("diagnoses a photo and grounds the treatment in the KB", async () => {
    mockedCompleteJson.mockResolvedValue({
      disease: "Early Blight",
      crop: "tomato",
      confidence: 0.9,
      organic: "neem",
      chemical: "mancozeb",
      prevention: "rotation",
      note: "purane patte",
    });
    const brain = newBrain();
    await brain.handle(msg("c1", "meri fasal tomato hai"));
    const r = await brain.handle(msg("c1", "tomato pe dhabbe hain", [
      { data: "aGVsbG8=", mimeType: "image/jpeg", name: "leaf.jpg" },
    ]));
    expect(r.text).toContain("jhulsa"); // Hindi name from the KB
    const stored = brain["store"].get("c1").lastDiagnosis;
    expect(stored?.disease).toBe("Early Blight");
    expect(r.blocks?.some((b) => b.type === "card")).toBe(true);
    expect(mockedCompleteJson).toHaveBeenCalledTimes(1);
  });

  it("refuses to invent a treatment for an unknown diagnosis", async () => {
    mockedCompleteJson.mockResolvedValue({
      disease: "Some Made Up Blight",
      crop: "tomato",
      confidence: 0.7,
      organic: "x",
      chemical: "y",
      prevention: "z",
      note: "kuch samajh nahi aaya",
    });
    const brain = newBrain();
    const r = await brain.handle(msg("c1", "", [
      { data: "aGVsbG8=", mimeType: "image/jpeg", name: "leaf.jpg" },
    ]));
    expect(r.text).toContain("Samajh nahi");
    expect(brain["store"].get("c1").lastDiagnosis).toBeUndefined();
  });

  it("asks for a photo when disease is described in words (now grounded from KB)", async () => {
    const brain = newBrain();
    await brain.handle(msg("c1", "meri fasal tomato hai"));
    const r = await brain.handle(msg("c1", "tomato ke patte peele ho rahe hain"));
    expect(r.text).toContain("photo");
    // No LLM call — grounded from KB symptom matcher
    expect(mockedComplete).not.toHaveBeenCalled();
  });

  it("answers a general question through the LLM", async () => {
    mockedComplete.mockResolvedValue("bhindi ki sabzi banao");
    const brain = newBrain();
    const r = await brain.handle(msg("c1", "kya khana banaun"));
    expect(r.text).toContain("bhindi");
  });

  it("grounds a wheat 'safed dhabe' text symptom to Powdery Mildew from KB", async () => {
    const brain = newBrain();
    const r = await brain.handle(msg("c1", "meri gehu ki kheti mein safed dhabe lag rahe hain"));
    expect(r.text).toMatch(/Powdery Mildew|Churni/i);
    expect(r.blocks?.some((b) => b.type === "heading")).toBe(true);
    expect(mockedComplete).not.toHaveBeenCalled();
  });

  it("extracts 'ranchi ilake' as the district from a combined message", async () => {
    const brain = newBrain();
    await brain.handle(msg("c1", "bhai meri fasal mein safed dhabe lag rahe hain meri gehu ki kheti hai mein ranchi ilake mein kheti karta hun"));
    expect(brain["store"].get("c1").profile.district).toBe("ranchi");
    expect(brain["store"].get("c1").profile.crop).toBe("wheat");
  });

  it("routes 'samadhan batao' to the ilaj flow (no LLM round-trip)", async () => {
    mockedCompleteJson.mockResolvedValue({
      disease: "Early Blight",
      crop: "tomato",
      confidence: 0.9,
      organic: "neem",
      chemical: "mancozeb",
      prevention: "rotation",
      note: "purane patte",
    });
    const brain = newBrain();
    await brain.handle(msg("c1", "meri fasal tomato hai"));
    await brain.handle(msg("c1", "", [
      { data: "aGVsbG8=", mimeType: "image/jpeg", name: "leaf.jpg" },
    ]));
    mockedCompleteJson.mockClear();
    const r = await brain.handle(msg("c1", "koi samadhan batao mujhe"));
    expect(r.text).toMatch(/mancozeb/i);
    expect(mockedComplete).not.toHaveBeenCalled();
  });

  it("rejects garbage LLM output and asks for a photo/rewrite", async () => {
    mockedComplete.mockResolvedValue(").");
    const brain = newBrain();
    const r = await brain.handle(msg("c1", "kya karun"));
    expect(r.text).toContain("Samajh nahi paya");
    expect(mockedComplete).toHaveBeenCalled();
  });

  it("morning advisory is null when there is no profile", async () => {
    const brain = newBrain();
    await brain.handle(msg("c1", "hello"));
    const out = await brain.morningAdvisory("c1");
    expect(out).toBeNull();
  });

  it("routes a tapped Mausam button through handleValue", async () => {
    mockedGetWeather.mockResolvedValue({
      location: "Bhubaneswar",
      summary: "Mostly dry today.",
      days: [
        { date: "2026-08-10", tMax: 32, tMin: 26, rainMm: 0, rainProb: 10, windKmh: 12, uv: 7 },
      ],
    });
    const brain = newBrain();
    await brain.handle(msg("c1", "hamara gaon Bhubaneswar hai"));
    const r = await brain.handleValue("c1", "mausam");
    expect(r.text).toContain("Bhubaneswar");
    expect(mockedComplete).not.toHaveBeenCalled();
  });

  it("routes a tapped Ilaj button to the stored treatment", async () => {
    mockedCompleteJson.mockResolvedValue({
      disease: "Early Blight",
      crop: "tomato",
      confidence: 0.9,
      organic: "neem",
      chemical: "mancozeb",
      prevention: "rotation",
      note: "purane patte",
    });
    const brain = newBrain();
    await brain.handle(msg("c1", "meri fasal tomato hai"));
    await brain.handle(msg("c1", "photo", [
      { data: "aGVsbG8=", mimeType: "image/jpeg", name: "leaf.jpg" },
    ]));
    const r = await brain.handleValue("c1", "ilaj");
    expect(r.text).toContain("Mancozeb"); // grounded KB treatment
    expect(r.text).toContain("Roktham");
  });

  it("refuses non-image files politely", async () => {
    const brain = newBrain();
    const r = await brain.handle(msg("c1", null, [
      { data: "aGVsbG8=", mimeType: "application/pdf", name: "doc.pdf" },
    ]));
    expect(r.text).toContain("file padh nahi");
  });

  it("diagnoseImage returns unknown for an unmatched name", async () => {
    mockedCompleteJson.mockResolvedValue({
      disease: "Totally Fake Disease",
      crop: "tomato",
      confidence: 0.9,
      organic: "x",
      chemical: "y",
      prevention: "z",
      note: "kuch nahi mila",
    });
    const brain = newBrain();
    const out = await brain.diagnoseImage("c1", {
      data: "aGVsbG8=",
      mimeType: "image/jpeg",
      name: "leaf.jpg",
    });
    expect(out.disease).toBe("unknown");
    expect(out.matched).toBeNull();
  });
});
