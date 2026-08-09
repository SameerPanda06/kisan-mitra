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
  district?: string;
  acreage?: string;
  phone?: string;
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
  lastTopic?: string;
  lastDiagnosis?: LastDiagnosis;
  history: HistoryEntry[];
  lastProactiveDay?: string; // yyyy-mm-dd, prevents double-sending on restarts
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

  get(conversationId: string): ConversationState {
    if (!this.data[conversationId]) {
      this.data[conversationId] = { profile: {}, history: [] };
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

  all(): Array<{ conversationId: string; state: ConversationState }> {
    return Object.entries(this.data).map(([conversationId, state]) => ({
      conversationId,
      state,
    }));
  }
}
