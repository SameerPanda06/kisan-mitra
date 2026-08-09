import type { Block, Media } from "caspian-sdk";
import { complete, completeJson, type ChatMsg } from "./llm.js";
import {
  normalizeCrop,
  entriesForCrop,
  allEntries,
  kbPromptBlock,
  findEntry,
} from "./knowledge.js";
import type { DiseaseEntry } from "./knowledge/diseases.js";
import { getWeather, type WeatherReport } from "./weather.js";
import { Store, type ConversationState } from "./store.js";
import { helpCard, diagnosisCard, weatherCard, type Diagnosis } from "./cards.js";

/**
 * The single brain behind every channel. One handler, many channels: email,
 * Telegram, Discord, Slack all land here and get the same treatment.
 *
 * Routing is regex-first so the demo is deterministic; the LLM handles
 * diagnosis and free-form advisory. Every diagnosis is grounded against the
 * knowledge base before a treatment is returned.
 */

export interface BrainMessage {
  conversationId: string;
  channel: string;
  text: string | null;
  media: Media[];
}

export interface ReplySpec {
  text: string;
  blocks?: Block[];
  media?: Media[];
}

const PERSONA = `Tum Kisan Mitra ho — Hindustan ke kisaano ka dost jo fasal, mausam aur bimari mein madad karta hai. Hamesha Hinglish mein jawab do (Roman script mein Hindi). Chhota, saaf aur seedha jawab do. Kisaan jis bhasha mein likhe, usi mein jawab do. Dawa ki baat ho to exact dose ke liye apne kshetriya krishi adhikari se milne ki salah zaroor do. Kabhi bhi man se dawai mat batao.`;

export class Brain {
  constructor(private store: Store) {}

  async handle(msg: BrainMessage): Promise<ReplySpec> {
    const image = firstImage(msg.media);
    if (image) return this.diagnoseFlow(msg, image);
    if (msg.media.length > 0) {
      return {
        text: "Yeh file padh nahi sakta. Kripya kisi patte ki photo bhejein, ya apna sawal seedha likhein.",
      };
    }

    const text = (msg.text ?? "").trim();
    if (!text) {
      return { text: "Namaste! 🌾 Fasal ki photo bhejein ya sawal likhein. 'help' likh kar dekhein." };
    }
    this.store.addHistory(msg.conversationId, "user", text);

    const lower = text.toLowerCase();

    // Weather request first (may also carry a location to remember).
    if (isWeatherRequest(lower)) {
      const loc = extractLocation(text);
      if (loc) this.store.patchProfile(msg.conversationId, { district: loc });
      return this.weatherFlow(msg);
    }

    // Location set: "hamara gaon Bhubaneswar hai".
    const loc = extractLocation(text);
    if (loc) return this.setDistrict(msg, loc);

    // Crop set: "meri fasal tomato hai", "main aloo ugata hoon".
    if (isCropStatement(lower)) return this.setCrop(msg, lower);

    // Follow-up on a stored diagnosis: "ilaj", "dawai".
    if (isIlajRequest(lower)) return this.ilajFlow(msg);

    // Help / greeting.
    if (isHelp(lower)) return { text: "Main hoon Kisan Mitra 🌾", blocks: helpCard() };

    // Disease described in words only — get a photo.
    if (isDiseaseText(lower)) return this.textOnlyDisease(msg, lower);

    // Everything else: general crop/farming question.
    return this.generalQuestion(msg, text);
  }

  /** Morning advisory sent proactively to every conversation with a profile. */
  async morningAdvisory(conversationId: string): Promise<ReplySpec | null> {
    const state = this.store.get(conversationId);
    if (!state.profile.district && !state.profile.crop) return null;

    const blocks: Block[] = [{ type: "heading", text: "Aaj ki salah · Kisan Mitra" }];
    let text = state.profile.name ? `${state.profile.name} ji, namaste 🌾` : "Namaste 🌾";

    if (state.profile.district) {
      const report = await getWeather(state.profile.district);
      if (report) {
        blocks.push({ type: "text", text: report.summary });
        text += `\n${report.summary}`;
        const tip = await this.cropTip(state, report);
        if (tip) blocks.push({ type: "text", text: tip });
      }
    } else {
      blocks.push({ type: "text", text: "Mausam ke liye apna gaon batayein." });
    }
    return { text, blocks };
  }

  // ---------------- flows ----------------

  /** Handle a tapped button value (onInteraction): mausam / ilaj / sawal / anything. */
  async handleValue(conversationId: string, value: string): Promise<ReplySpec> {
    const v = value.trim().toLowerCase();
    if (v === "mausam") return this.weatherFlow({ conversationId, channel: "interaction", text: "mausam", media: [] });
    if (v === "ilaj") return this.ilajFlow({ conversationId, channel: "interaction", text: "ilaj", media: [] });
    if (v === "sawal" || v === "naya sawal") {
      return { text: "Kya poochna hai? Jaise: 'tomato ko kitna paani chahiye?' ya 'khaad kab dalun?'" };
    }
    return this.generalQuestion({ conversationId, channel: "interaction", text: v, media: [] }, value);
  }

  private async diagnoseFlow(msg: BrainMessage, image: Media): Promise<ReplySpec> {
    const state = this.store.get(msg.conversationId);
    const crop = state.profile.crop;
    const farmerText = (msg.text ?? "").trim();

    const dataUrl = await toDataUrl(image);
    if (!dataUrl) {
      return { text: "Photo nahi padh paya. Kripya dobara achhi roshni mein photo bhejein." };
    }

    const { diagnosis, matched } = await this.diagnoseImage(msg.conversationId, image, farmerText);

    if (matched) {
      this.store.setLastDiagnosis(msg.conversationId, {
        disease: matched.name,
        crop: matched.crop,
        organic: matched.organic,
        chemical: matched.chemical,
        prevention: matched.prevention,
      });
    }
    this.store.setLastTopic(msg.conversationId, "diagnosis");

    const blocks = diagnosisCard(diagnosis, image.url, crop ?? undefined);
    const noCropHint = crop ? "" : "\nBata dijiye kaunsi fasal hai? (jaise: 'meri fasal tomato hai') — isse main sahi bimari ke liye behtar dekh sakta hoon.";
    const text =
      diagnosis.disease === "unknown"
        ? `Samajh nahi paya 🙏${noCropHint}`
        : `${matched!.hindi} lag raha hai. Neeche ilaaj diya hai.`;
    return { text, blocks };
  }

  /**
   * Grounded diagnosis for an image. Returns the disease only if it matches a
   * KB entry (so treatments are never invented), otherwise "unknown".
   */
  async diagnoseImage(
    conversationId: string,
    image: Media,
    farmerText = "",
  ): Promise<{ disease: string; diagnosis: Diagnosis; matched: DiseaseEntry | null }> {
    const crop = this.store.get(conversationId).profile.crop;
    const entries = crop ? entriesForCrop(crop) : allEntries();
    const dataUrl = await toDataUrl(image);
    if (!dataUrl) {
      return {
        disease: "unknown",
        diagnosis: { disease: "unknown", crop: crop ?? "?", confidence: 0, organic: "", chemical: "", prevention: "", note: "image not readable" },
        matched: null,
      };
    }
    const raw = await this.runDiagnosis(dataUrl, crop ?? null, entries, farmerText);
    const matched = raw.disease ? findEntry(entries, raw.disease) : null;
    if (matched) {
      return {
        disease: matched.name,
        diagnosis: { ...raw, organic: matched.organic, chemical: matched.chemical, prevention: matched.prevention },
        matched,
      };
    }
    return { disease: "unknown", diagnosis: { ...raw, disease: "unknown" }, matched: null };
  }

  private async runDiagnosis(
    dataUrl: string,
    crop: string | null,
    entries: DiseaseEntry[],
    farmerText: string,
  ): Promise<Diagnosis> {
    const sys = `${PERSONA}\n\nNeeche sirf wahi bimariyan hain jo tum bata sakte ho:\n${kbPromptBlock(
      entries,
    )}\n\nPhoto ke lakshan inme se kisi ek se milte hain to wahi batao, warna disease="unknown" rakho. Sirf JSON bhejo: {"disease":"...","crop":"...","confidence":0-1,"organic":"...","chemical":"...","prevention":"...","note":"1 line"}. organic/chemical/prevention Hinglish mein, chhota.`;
    const user: ChatMsg = {
      role: "user",
      content: [
        { type: "text", text: `Kisaan ne likha: "${farmerText || "-"}"\nFasal: ${crop ?? "nahi batayi"}` },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    };
    const data = await completeJson<Partial<Diagnosis>>(
      [
        { role: "system", content: sys },
        user,
      ],
      { temperature: 0, maxTokens: 800 },
    );
    return {
      disease: data?.disease ?? "unknown",
      crop: data?.crop ?? crop ?? "?",
      confidence: typeof data?.confidence === "number" ? data.confidence : 0.5,
      organic: data?.organic ?? "",
      chemical: data?.chemical ?? "",
      prevention: data?.prevention ?? "",
      note: data?.note ?? "",
    };
  }

  private async setCrop(msg: BrainMessage, lower: string): Promise<ReplySpec> {
    const crop = normalizeCrop(lower) ?? "";
    const state = this.store.patchProfile(msg.conversationId, { crop });
    this.store.setLastTopic(msg.conversationId, "profile");
    const askDistrict = state.profile.district
      ? ""
      : "\nAur batayein: aapka gaon ya sheher kaunsa hai? (jaise: 'hamara gaon Bhubaneswar hai'). Mausam aur salah ke liye jaruri hai.";
    return { text: `Theek hai, ${crop} ki fasal ka khayal rakhoonga. 🌱${askDistrict}` };
  }

  private async setDistrict(msg: BrainMessage, loc: string): Promise<ReplySpec> {
    this.store.patchProfile(msg.conversationId, { district: loc });
    this.store.setLastTopic(msg.conversationId, "profile");
    return { text: `Theek hai, ${loc} ka mausam dekhoonga. Ab kisi bimari ki photo bhejein, ya 'mausam' likhein.` };
  }

  private async weatherFlow(msg: BrainMessage): Promise<ReplySpec> {
    const state = this.store.get(msg.conversationId);
    if (!state.profile.district) {
      return {
        text: "Mausam batane ke liye apna gaon/sheher batayein. Jaise: 'hamara gaon Bhubaneswar hai'.",
      };
    }
    const report = await getWeather(state.profile.district);
    if (!report) {
      return {
        text: `'${state.profile.district}' nahi mila. Kripya sahi naam batayein, jaise 'hamara gaon Cuttack hai'.`,
      };
    }
    const tip = await this.cropTip(state, report);
    const blocks = weatherCard(report);
    if (tip) blocks.push({ type: "text", text: tip });
    this.store.setLastTopic(msg.conversationId, "weather");
    return { text: report.summary, blocks };
  }

  private async ilajFlow(msg: BrainMessage): Promise<ReplySpec> {
    const state = this.store.get(msg.conversationId);
    const d = state.lastDiagnosis;
    if (!d) {
      return { text: "Pehle kisi bimari ki photo bhejein, phir ilaaj bata paoonga." };
    }
    const e = findEntry(allEntries(), d.disease);
    const line = e
      ? `${e.name} (${e.hindi})\n\nIlaaj:\n${e.chemical}\n\nRoktham:\n${e.prevention}`
      : `${d.disease}\n\nIlaaj:\n${d.chemical}\n\nRoktham:\n${d.prevention}`;
    return { text: line };
  }

  private async textOnlyDisease(msg: BrainMessage, lower: string): Promise<ReplySpec> {
    const crop = normalizeCrop(lower);
    let text = "Patte ki photo bhejein, bimari theek se bata paoonga. 📸\n";
    if (!crop) {
      text += "Aur batayein, kaunsi fasal hai? (jaise: 'meri fasal tomato hai')";
    } else if (!this.store.get(msg.conversationId).profile.crop) {
      text += `Aapki fasal ${crop} hai na? 'meri fasal ${crop} hai' likh kar profile set kar lein.`;
    }
    return { text };
  }

  private async generalQuestion(msg: BrainMessage, text: string): Promise<ReplySpec> {
    const state = this.store.get(msg.conversationId);
    const profileLine = state.profile.crop ? `Kisaan ki fasal: ${state.profile.crop}.` : "";
    const history = state.history
      .slice(-6)
      .map((h) => `${h.role === "user" ? "Kisaan" : "Kisan Mitra"}: ${h.text}`)
      .join("\n");
    const sys = `${PERSONA}\n${profileLine} Chhota, seedha jawab do (2-4 line).`;
    const userContent = history ? `Pehli baatcheet:\n${history}\n\nAb kisaan poochhta hai: ${text}` : text;
    try {
      const out = await complete(
        [
          { role: "system", content: sys },
          { role: "user", content: userContent },
        ],
        { temperature: 0.5, maxTokens: 400 },
      );
      return { text: out.trim() || "Samajh nahi paya. Kripya dobara likhein ya photo bhejein." };
    } catch (e) {
      console.error("[brain] generalQuestion failed:", e);
      return { text: "Abhi mere paas jawab nahi. Kripya dobara koshish karein ya photo bhejein. 🙏" };
    }
  }

  private async cropTip(state: ConversationState, report: WeatherReport): Promise<string | null> {
    if (!state.profile.crop) return null;
    const sys = `${PERSONA}\nKisaan ka gaon: ${report.location}. 3 din ka mausam: ${JSON.stringify(
      report.days,
    )}. Fasal: ${state.profile.crop}. Ek ya do line mein batao kya karna chahiye (paani, spray, khaad). Sirf salah.`;
    try {
      const out = await complete(
        [
          { role: "system", content: sys },
          { role: "user", content: "Mausam ke hisaab se salah dein." },
        ],
        { temperature: 0.4, maxTokens: 200 },
      );
      return out.trim() || null;
    } catch (e) {
      console.error("[brain] cropTip failed:", e);
      return null;
    }
  }
}

// ---------------- helpers ----------------

function firstImage(media: Media[]): Media | undefined {
  return media.find((m) => {
    const mime = m.mimeType ?? m.mime_type ?? "";
    const name = (m.name ?? "").toLowerCase();
    const url = (m.url ?? "").toLowerCase();
    return (
      mime.startsWith("image/") ||
      /\.(png|jpe?g|webp|gif|heic)$/.test(name) ||
      /\.(png|jpe?g|webp|gif|heic)(\?|$)/.test(url)
    );
  });
}

async function toDataUrl(m: Media): Promise<string | null> {
  if (m.data) {
    const mime = m.mimeType ?? m.mime_type ?? "image/jpeg";
    return `data:${mime};base64,${m.data}`;
  }
  if (m.url) {
    const res = await fetch(m.url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    const mime = m.mimeType ?? m.mime_type ?? res.headers.get("content-type") ?? "image/jpeg";
    return `data:${mime};base64,${b64}`;
  }
  return null;
}

function isWeatherRequest(t: string): boolean {
  return /\b(mausam|maasam|weather|barish|baaris|rain)\b/.test(t);
}

function extractLocation(t: string): string | null {
  // Match keywords on a lowercased copy, but capture the actual place name
  // from the original text so casing (Bhubaneswar) is preserved.
  const tl = t.toLowerCase();
  const m = tl.match(
    /(?:gaon|gau[nm]|sheher|shahar|district|village|block|jila|town)\s+(?:ka\s+naam\s+)?([a-zA-Z][a-zA-Z ]{1,24})/,
  );
  if (!m || m.index === undefined) return null;
  const group = m[1];
  const start = m.index + m[0].indexOf(group);
  const loc = t
    .slice(start, start + group.length)
    .trim()
    .replace(/\s+(hai|hain|mein|ka)\s*$/i, "");
  return loc || null;
}

function isCropStatement(t: string): boolean {
  if (!normalizeCrop(t)) return false;
  return /fasal|crop|ugat|boyi|bote|lagai|lagaye|lagaata|plant|boye/.test(t);
}

function isIlajRequest(t: string): boolean {
  return /\b(ilaj|dawai|dava|treatment|medicine|upchar)\b/.test(t);
}

function isHelp(t: string): boolean {
  return /^(hi+|hello|hey|namaste|namaskar|salaam|help|kya kar sakte ho|madad)/.test(t);
}

function isDiseaseText(t: string): boolean {
  return /patte? peele|peele patte|dhabbe?|daag|keeda|kida|kidi|beemari|bimari|rog|gilta|gal rah|sad rah|mud rah|mudna|sukh rah|sukhra|whitefly|sundi|illee|kilni|jhaanth/.test(t);
}
