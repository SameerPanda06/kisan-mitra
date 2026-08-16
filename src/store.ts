import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Per-conversation state: farmer profile + short history + last diagnosis.
 * Keyed by the SDK's stable conversation_id, persisted as JSON on disk.
 * Render free-tier disk is ephemeral across restarts; acceptable for a demo,
 * noted in the README.
 */

export interface Profile {
  name?: string;
  crop?: string;
  crops?: string[]; // multiple crops
  district?: string;
  locations?: Location[]; // multiple saved locations
  acreage?: string;
  phone?: string;
}

export interface Location {
  id: string;
  name: string; // display name e.g. "gaon Bhubaneswar"
  district: string;
  state?: string;
  lat?: number;
  lon?: number;
  isDefault: boolean;
}

export interface CropRecord {
  crop: string;
  problems: CropProblem[];
  createdAt: string;
  updatedAt: string;
}

export interface CropProblem {
  id: string;
  date: string;
  symptoms: string;
  diagnosis: {
    disease: string;
    confidence: number;
    organic: string;
    chemical: string;
    prevention: string;
  };
  solutionProvided: string;
  outcome?: "resolved" | "improved" | "same" | "worsened" | "pending";
  outcomeDate?: string;
  impactNotes?: string; // farmer's feedback on impact
  photos?: string[]; // photo URLs
}

export interface CommandLog {
  command: string;
  args: string;
  timestamp: string;
  success: boolean;
}

export interface HistoryEntry {
  role: "user" | "assistant";
  text: string;
  ts: string;
}

export interface LastDiagnosis {
  disease: string;
  crop: string;
  organic: string;
  chemical: string;
  prevention: string;
}

export interface ConversationState {
  profile: Profile;
  crops: CropRecord[];
  commandHistory: CommandLog[];
  lastTopic?: string;
  lastDiagnosis?: LastDiagnosis;
  history: HistoryEntry[];
  lastProactiveDay?: string; // yyyy-mm-dd, prevents double-sending on restarts
  convBrainState?: object; // persisted ConversationBrain learning state
}

type Data = Record<string, ConversationState>;

const now = () => new Date().toISOString();

export class Store {
  private data: Data = {};

  /** memory=true keeps state in-process only, for tests and dry runs. */
  constructor(
    private path: string,
    private memory = false,
  ) {
    if (!memory) this.load();
  }

  private load() {
    if (existsSync(this.path)) {
      try {
        this.data = JSON.parse(readFileSync(this.path, "utf8")) as Data;
      } catch {
        this.data = {};
      }
    }
  }

  private persist() {
    if (this.memory) return;
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      writeFileSync(this.path, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error("[store] persist failed:", e);
    }
  }

  /** Persist all in-memory state to disk (used by periodic maintenance). */
  persistAll(): void {
    this.persist();
  }

  get(conversationId: string): ConversationState {
    if (!this.data[conversationId]) {
      this.data[conversationId] = {
        profile: {},
        crops: [],
        commandHistory: [],
        history: []
      };
    }
    return this.data[conversationId];
  }

  patchProfile(conversationId: string, patch: Partial<Profile>): ConversationState {
    const s = this.get(conversationId);
    s.profile = { ...s.profile, ...patch };
    this.persist();
    return s;
  }

  setLastTopic(conversationId: string, topic: string): void {
    this.get(conversationId).lastTopic = topic;
    this.persist();
  }

  setLastDiagnosis(conversationId: string, d: LastDiagnosis): void {
    this.get(conversationId).lastDiagnosis = d;
    this.persist();
  }

  addHistory(conversationId: string, role: "user" | "assistant", text: string): void {
    const s = this.get(conversationId);
    s.history.push({ role, text, ts: now() });
    if (s.history.length > 40) s.history = s.history.slice(-40);
    this.persist();
  }

  setProactiveDay(conversationId: string, day: string): void {
    this.get(conversationId).lastProactiveDay = day;
    this.persist();
  }

  // --- Crop tracking ---
  addCropRecord(conversationId: string, crop: string): CropRecord {
    const s = this.get(conversationId);
    const existing = s.crops.find(c => c.crop.toLowerCase() === crop.toLowerCase());
    if (existing) return existing;
    const record: CropRecord = {
      crop,
      problems: [],
      createdAt: now(),
      updatedAt: now(),
    };
    s.crops.push(record);
    this.persist();
    return record;
  }

  getCropRecord(conversationId: string, crop: string): CropRecord | undefined {
    const s = this.get(conversationId);
    return s.crops.find(c => c.crop.toLowerCase() === crop.toLowerCase());
  }

  addCropProblem(conversationId: string, crop: string, problem: CropProblem): void {
    const s = this.get(conversationId);
    const record = s.crops.find(c => c.crop.toLowerCase() === crop.toLowerCase());
    if (record) {
      record.problems.push(problem);
      record.updatedAt = now();
      this.persist();
    }
  }

  updateCropProblemOutcome(conversationId: string, crop: string, problemId: string, outcome: CropProblem["outcome"], impactNotes?: string): boolean {
    const s = this.get(conversationId);
    const record = s.crops.find(c => c.crop.toLowerCase() === crop.toLowerCase());
    if (record) {
      const problem = record.problems.find(p => p.id === problemId);
      if (problem) {
        problem.outcome = outcome;
        problem.outcomeDate = now();
        if (impactNotes) problem.impactNotes = impactNotes;
        record.updatedAt = now();
        this.persist();
        return true;
      }
    }
    return false;
  }

  // --- Location management ---
  addLocation(conversationId: string, location: Omit<Location, "id" | "isDefault">): Location {
    const s = this.get(conversationId);
    if (!s.profile.locations) s.profile.locations = [];
    const id = `loc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const isDefault = s.profile.locations.length === 0;
    const newLoc: Location = { ...location, id, isDefault };
    s.profile.locations.push(newLoc);
    if (isDefault) s.profile.district = newLoc.district;
    this.persist();
    return newLoc;
  }

  getLocations(conversationId: string): Location[] {
    const s = this.get(conversationId);
    return s.profile.locations || [];
  }

  setDefaultLocation(conversationId: string, locationId: string): boolean {
    const s = this.get(conversationId);
    if (!s.profile.locations) return false;
    for (const loc of s.profile.locations) {
      loc.isDefault = loc.id === locationId;
      if (loc.isDefault) s.profile.district = loc.district;
    }
    this.persist();
    return true;
  }

  removeLocation(conversationId: string, locationId: string): boolean {
    const s = this.get(conversationId);
    if (!s.profile.locations) return false;
    const idx = s.profile.locations.findIndex(l => l.id === locationId);
    if (idx === -1) return false;
    const wasDefault = s.profile.locations[idx].isDefault;
    s.profile.locations.splice(idx, 1);
    if (wasDefault && s.profile.locations.length > 0) {
      s.profile.locations[0].isDefault = true;
      s.profile.district = s.profile.locations[0].district;
    }
    this.persist();
    return true;
  }

  // --- Command history ---
  logCommand(conversationId: string, command: string, args: string, success: boolean): void {
    const s = this.get(conversationId);
    s.commandHistory.push({ command, args, timestamp: now(), success });
    if (s.commandHistory.length > 100) s.commandHistory = s.commandHistory.slice(-100);
    this.persist();
  }

  getCommandHistory(conversationId: string): CommandLog[] {
    const s = this.get(conversationId);
    return s.commandHistory;
  }

  all(): Array<{ conversationId: string; state: ConversationState }> {
    return Object.entries(this.data).map(([conversationId, state]) => ({
      conversationId,
      state,
    }));
  }

  /** Delete a conversation completely — removes all memory for that farmer. */
  delete(conversationId: string): boolean {
    if (this.data[conversationId]) {
      delete this.data[conversationId];
      this.persist();
      return true;
    }
    return false;
  }
}
