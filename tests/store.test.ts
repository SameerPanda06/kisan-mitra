import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Store } from "../src/store.js";

describe("Store", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "kisan-store-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("memory mode never touches the disk", () => {
    const path = join(dir, "store.json");
    const store = new Store(path, true);
    store.patchProfile("c1", { crop: "tomato" });
    store.addHistory("c1", "user", "hello");
    expect(existsSync(path)).toBe(false);
  });

  it("persists profile + diagnosis to disk and reloads them", () => {
    const path = join(dir, "store.json");
    const store = new Store(path);
    store.patchProfile("c1", { crop: "tomato", district: "Bhubaneswar" });
    store.setLastDiagnosis("c1", {
      disease: "Early Blight",
      crop: "tomato",
      organic: "neem",
      chemical: "mancozeb",
      prevention: "rotation",
    });
    store.addHistory("c1", "user", "meri fasal tomato hai");

    const reloaded = new Store(path);
    const state = reloaded.get("c1");
    expect(state.profile.crop).toBe("tomato");
    expect(state.profile.district).toBe("Bhubaneswar");
    expect(state.lastDiagnosis?.disease).toBe("Early Blight");
    expect(state.history).toHaveLength(1);
  });

  it("caps history and dedups the proactive day", () => {
    const store = new Store(join(dir, "store.json"));
    for (let i = 0; i < 50; i++) store.addHistory("c1", "user", `m${i}`);
    expect(store.get("c1").history).toHaveLength(40);

    store.setProactiveDay("c1", "2026-08-10");
    store.setProactiveDay("c1", "2026-08-10");
    expect(store.get("c1").lastProactiveDay).toBe("2026-08-10");
  });

  it("all() lists conversations with profiles only for proactive send", () => {
    const store = new Store(join(dir, "store.json"));
    store.patchProfile("c1", { district: "Bhubaneswar" });
    store.get("c2"); // no profile
    const rows = store.all();
    expect(rows.length).toBe(2);
    expect(rows[0].conversationId).toBe("c1");
  });
});
