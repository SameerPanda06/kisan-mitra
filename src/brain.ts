import type { Block, Media } from "caspian-sdk";
import { complete, completeJson, type ChatMsg } from "./llm.js";
import {
  normalizeCrop,
  entriesForCrop,
  allEntries,
  kbPromptBlock,
  findEntry,
  matchSymptoms,
} from "./knowledge.js";
import type { DiseaseEntry } from "./knowledge/diseases.js";
import { getWeather, type WeatherReport } from "./weather.js";
import { Store, type ConversationState } from "./store.js";
import { helpCard, diagnosisCard, weatherCard, type Diagnosis } from "./cards.js";
import { ConversationBrain, detectLanguage, learnFromMessage, inferCrop, inferTopic, summarizeHistory, pruneHistory, scoreReply, tidyReply, fewShotBlock, FEW_SHOT_EXAMPLES } from "./conversation-brain.js";
import { findSoil, findScheme, findState, getSeason, SEASONS, GOVT_SCHEMES, KVK_INFO, STATE_INFO } from "./indian-knowledge.js";

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

const PERSONA = `Tum "Kisan Mitra" ho — gaon ka dost jo kheti ki salah deta hai. Seedhi baat karo, kam shabdon mein.

**Niyam (hard rules):**
1. **Bhasha:** Hinglish (Roman script Hindi). Kisaan English likhe → simple English jawab. Kabhi pure Hindi/Devanagari mat bolo.
2. **Lambai:** 1-2 line MAX. Ek baar mein ek hi baat bolo. Fizool bakwas nahi.
3. **Bimari/Ilaj:** Sirf **photo + knowledge base** se. Kabhi man se dawa, dose, ya spray schedule mat banao. Exact dose ke liye hamesha: "kshetriya krishi adhikari / KVK se milen" bolo.
4. **Aam salah:** Paani, dhoop, fasal rotation, khaad timing de sakte ho — par **exact quantity nahi**.
5. **Action-oriented:** Har jawab ke baad kisaan ko **clear next step** batao (photo bhejein, mausam dekhein).
6. **Sachai:** Agar nahi pata to seedha bolo "photo bhejein ya KVK se puchhein." Jhooth mat bolo, na hi lambi bhashan do.
7. **Memory:** Kisaan ki fasal, gaon yaad rakho. Baar baar mat poochho.
8. Har jawab mein ek hi sawal ya ek hi next step ho. Zyada honorific mat ghusao — "bhai" ya "ji" ek baar kaafi hai.
`;

/** Deterministic quick replies for common farmer queries — NO LLM call. */
const QUICK_REPLIES: Array<[RegExp, string]> = [
  [/^\/?(hi+|hello|hey|namaste|namaskar|salaam|ram ram|pranam)$/i, "Namaste! 🌾 Kisan Mitra hoon. Fasal ki photo bhejein ya sawal likhein."],
  [/^\/?(menu|help|kya kar sakte ho|madad)\b/i, "Main hoon Kisan Mitra 🌾 — aapki fasal ka saathi.\n\n**Kaise use karein:**\n1. 📸 **Patte ki photo bhejein** → bimari + ilaaj turant\n2. ☁️ **mausam** likhein → 3 din ka purvabhas + fasal ki tip\n3. 🌱 **meri fasal tomato hai** → apni fasal set karein\n4. 📍 **hamara gaon Bhubaneswar hai** → location set karein\n5. 🌾 **/crop** → apni fasalon ka record dekhiye\n6. ✅ **/outcome** → ilaaj ka result update karein\n7. 🗑️ **/delete haan** → pura memory delete karein\n\nType `/help` poora menu dekhne ke liye."],
  [/\b(shukriya|dhanyavaad|thank you|thanks|thanku)\b/i, "Khush raho! Aur kuch puchna ho to likhein 🌾"],
  [/\b(kitna paani|paani kitna|sichai kitni|water how much)\b/i, "Fasal aur mausam pe depend karta hai. 'mausam' likho, phir bataunga kitna paani chahiye."],
  [/\b(khaad kab|khad kab|fertilizer kab|urea kab|dap kab)\b/i, "Fasal stage aur mausam dekh ke bataunga. Pehle 'mausam' likho ya apna gaon batao."],
  [/\b(beej|seed|buaai|plantation|nursery)\b/i, "Beej ka sawal KVK se puchho — wo area ke hisaab se best variety batainge."],
  [/\b(bhav|rate|market price|mandi bhav|kitna milega)\b/i, "Mandi bhav roz badlta hai. Local mandi ya KVK se puchho, usi time ka sahi rate milega."],
  [/\b(kisan samman|pm kisan|subsidy|yojana|scheme)\b/i, "Sarkari yojana ki jaankari block office ya CSC center se milegi. Main fasal bimari aur mausam ki madad karta hoon."],
  [/\b(kaise ho|kya haal|kaisa hai)\b/i, "Theek hoon! Aap batao — fasal ki koi dikkat hai?"],
  [/\b(bye|goodbye|alvida|chalta hoon)\b/i, "Chalo, khush raho! Zaroorat pade to dobara likhna 🌾"],
];

export class Brain {
  private convBrain: ConversationBrain;
  constructor(private store: Store) {
    this.convBrain = new ConversationBrain();
  }

  /** Restore conversation brain state if available. */
  private restoreConvBrain(conversationId: string): void {
    const state = this.store.get(conversationId);
    if (state.convBrainState) {
      this.convBrain.deserialize(state.convBrainState);
    }
  }

  async handle(msg: BrainMessage): Promise<ReplySpec> {
    // Restore learning state for this farmer
    this.restoreConvBrain(msg.conversationId);
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

    // Intercept slash commands first
    if (text.startsWith("/")) {
      return this.handleCommand(msg, text);
    }

    this.store.addHistory(msg.conversationId, "user", text);

    // Learn how the farmer talks (language, crop hints, topics) for this exchange.
    const learned = this.convBrain.preprocess(text);
    // Periodically summarize + prune old memory so context stays fresh.
    const summary = this.convBrain.maintain(this.store.get(msg.conversationId));

    // Persist conversation brain state for this farmer
    this.saveConvBrain(msg.conversationId);

    const lower = text.toLowerCase();

    // Disease described in words only — ground against KB, get a photo.
    // Also extract location if mentioned in the same message.
    if (isDiseaseText(lower)) {
      const loc = extractLocation(text);
      if (loc) this.store.patchProfile(msg.conversationId, { district: loc });
      const spec = await this.textOnlyDisease(msg, lower);
      return this.finalize(msg, spec);
    }

    // Weather request first (may also carry a location to remember).
    if (isWeatherRequest(lower)) {
      const loc = extractLocation(text);
      if (loc) this.store.patchProfile(msg.conversationId, { district: loc });
      return this.finalize(msg, await this.weatherFlow(msg));
    }

    // Location set: "hamara gaon Bhubaneswar hai".
    const loc = extractLocation(text);
    if (loc) return this.finalize(msg, await this.setDistrict(msg, loc));

    // Crop set: "meri fasal tomato hai", "main aloo ugata hoon".
    if (isCropStatement(lower)) return this.finalize(msg, await this.setCrop(msg, lower));

    // Follow-up on a stored diagnosis: "ilaj", "dawai", "samadhan".
    if (isIlajRequest(lower)) return this.finalize(msg, await this.ilajFlow(msg));

    // Help / greeting.
    if (isHelp(lower)) return this.finalize(msg, { text: "Main hoon Kisan Mitra 🌾", blocks: helpCard() });

    // Quick deterministic replies for common queries — NO LLM call.
    for (const [pattern, reply] of QUICK_REPLIES) {
      if (pattern.test(text)) {
        return this.finalize(msg, { text: reply });
      }
    }

    // Everything else: general crop/farming question (LLM as last resort).
    return this.finalize(msg, await this.generalQuestion(msg, text));
  }

  /** Handle slash commands: /weather, /crop, /set, /location, /history, /help, etc. */
  private async handleCommand(msg: BrainMessage, text: string): Promise<ReplySpec> {
    const parts = text.slice(1).split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1).join(" ").trim();

    this.store.logCommand(msg.conversationId, cmd, args, true);

    switch (cmd) {
      case "help":
      case "menu":
      case "start":
        return this.finalize(msg, {
          text: "Main hoon Kisan Mitra 🌾 — aapki fasal ka saathi.\n\n**Kaise use karein:**\n1. 📸 **Patte ki photo bhejein** → bimari + ilaaj turant\n2. ☁️ **mausam** likhein → 3 din ka purvabhas + fasal ki tip\n3. 🌱 **meri fasal tomato hai** → apni fasal set karein\n4. 📍 **hamara gaon Bhubaneswar hai** → location set karein\n5. 🌾 **/crop** → apni fasalon ka record dekhiye\n6. ✅ **/outcome** → ilaaj ka result update karein\n7. 🗑️ **/delete haan** → pura memory delete karein\n\nType `/help` poora menu dekhne ke liye.",
          blocks: helpCard(),
        });

      case "weather":
      case "mausam":
        return this.finalize(msg, await this.weatherFlow(msg));

      case "crop":
        return this.handleCropCommand(msg, args);

      case "set":
        return this.handleSetCommand(msg, args);

      case "location":
      case "gaon":
        return this.handleLocationCommand(msg, args);

      case "history":
      case "record":
        return this.handleHistoryCommand(msg, args);

      case "problem":
      case "bimari":
        return this.handleProblemCommand(msg, args);

      case "outcome":
      case "parinam":
        return this.handleOutcomeCommand(msg, args);

      case "delete":
      case "reset":
      case "forget":
        return this.handleDeleteCommand(msg, args);

      default:
        return this.finalize(msg, { text: `Pehchana nahi command: /${cmd}. "/help" likhein puri list ke liye.` });
    }
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

      // Track this problem in crop history
      if (crop) {
        const problemId = `prob_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const solutionText = `${matched.organic}\n${matched.chemical}\n${matched.prevention}`;
        this.store.addCropProblem(msg.conversationId, crop, {
          id: problemId,
          date: new Date().toISOString(),
          symptoms: farmerText || "photo diagnosis",
          diagnosis: {
            disease: matched.name,
            confidence: 0.8,
            organic: matched.organic,
            chemical: matched.chemical,
            prevention: matched.prevention,
          },
          solutionProvided: solutionText,
          outcome: "pending",
        });
      }
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
    const text = `Theek hai, ${crop} ki fasal ka khayal rakhoonga. 🌱${
      state.profile.district
        ? "\nAb 'mausam' likho ya kisi bimari ki photo bhejo."
        : "\nAur batayein: aapka gaon ya sheher kaunsa hai? (jaise: 'hamara gaon Bhubaneswar hai')"
    }`;
    return { text };
  }

  private async setDistrict(msg: BrainMessage, loc: string): Promise<ReplySpec> {
    this.store.patchProfile(msg.conversationId, { district: loc });
    this.store.setLastTopic(msg.conversationId, "profile");
    const hasCrop = this.store.get(msg.conversationId).profile.crop;
    const text = hasCrop
      ? `Theek hai, ${loc} ka mausam dekhoonga. Ab kisi bimari ki photo bhejein, ya 'mausam' likhein.`
      : `Theek hai, ${loc} yaad rakha. Kaunsi fasal ugate hain? (jaise: 'meri fasal gehu hai')`;
    return { text };
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
        text: `'${state.profile.district}' mausam mein nahi mila. Kripya sahi naam batayein, jaise 'hamara gaon Cuttack hai'.`,
      };
    }
    let text = `${report.location}: ${report.summary}`;
    const tip = await this.cropTip(state, report);
    const blocks = weatherCard(report);
    if (tip) {
      text += `\n\n${tip}`;
      blocks.push({ type: "text", text: tip });
    }
    this.store.setLastTopic(msg.conversationId, "weather");
    return { text, blocks };
  }

  private async ilajFlow(msg: BrainMessage): Promise<ReplySpec> {
    const state = this.store.get(msg.conversationId);
    const d = state.lastDiagnosis;
    if (!d) {
      return {
        text: "Pehle kisi bimari ki photo bhejein ya lakshan likhein, phir ilaaj bata paoonga.",
      };
    }
    const e = findEntry(allEntries(), d.disease);
    const line = e
      ? `${e.name} (${e.hindi})\n\nIlaaj:\n${e.chemical}\n\nRoktham:\n${e.prevention}`
      : `${d.disease}\n\nIlaaj:\n${d.chemical}\n\nRoktham:\n${d.prevention}`;
    return { text: line };
  }

  private async textOnlyDisease(msg: BrainMessage, lower: string): Promise<ReplySpec> {
    const mentionedCrop = normalizeCrop(lower);
    const state = this.store.get(msg.conversationId);
    // Persist crop if mentioned in this message
    if (mentionedCrop && !state.profile.crop) {
      this.store.patchProfile(msg.conversationId, { crop: mentionedCrop });
    }
    const crop = state.profile.crop ?? mentionedCrop ?? undefined;
    // Ground the symptom description against the KB before asking for a photo.
    const match = matchSymptoms(lower, crop);
    if (match) {
      this.store.setLastDiagnosis(msg.conversationId, {
        disease: match.name,
        crop: match.crop,
        organic: match.organic,
        chemical: match.chemical,
        prevention: match.prevention,
      });
      this.store.setLastTopic(msg.conversationId, "diagnosis");

      // Track this problem in crop history
      if (crop) {
        const problemId = `prob_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        const solutionText = `${match.organic}\n${match.chemical}\n${match.prevention}`;
        this.store.addCropProblem(msg.conversationId, crop, {
          id: problemId,
          date: new Date().toISOString(),
          symptoms: lower,
          diagnosis: {
            disease: match.name,
            confidence: 0.8,
            organic: match.organic,
            chemical: match.chemical,
            prevention: match.prevention,
          },
          solutionProvided: solutionText,
          outcome: "pending",
        });
      }
      const text =
        `${match.hindi} (${match.name}) lag raha hai. Patte ki photo bhejein to pakka confirm kar loonga.\n\n` +
        `Ilaaj:\n${match.chemical}\n\nRoktham:\n${match.prevention}\n\n` +
        `Exact dose ke liye kshetriya krishi adhikari / KVK se milen.`;
      const blocks: Block[] = [
        { type: "heading", text: `${match.hindi} · ${match.name}` },
        { type: "text", text: text },
      ];
      return { text, blocks };
    }
    let fallback = "Patte ki photo bhejein, bimari theek se bata paoonga. 📸\n";
    if (!crop) {
      fallback += "Aur batayein, kaunsi fasal hai? (jaise: 'meri fasal tomato hai')";
    }
    return { text: fallback };
  }

  private async generalQuestion(msg: BrainMessage, text: string): Promise<ReplySpec> {
    const state = this.store.get(msg.conversationId);
    const profileLine = state.profile.crop ? `Kisaan ki fasal: ${state.profile.crop}.` : "";
    const ctxHint = this.convBrain.contextHint(state);
    const history = state.history
      .slice(-6)
      .map((h) => `${h.role === "user" ? "Kisaan" : "Kisan Mitra"}: ${h.text}`)
      .join("\n");

    // Inject India-specific context
    let indiaContext = "";
    if (state.profile.district) {
      const stateInfo = findState(state.profile.district);
      if (stateInfo) {
        indiaContext += `\nRegion: ${stateInfo.state} (${stateInfo.agroZone}). Major crops: ${stateInfo.majorCrops.join(", ")}. Soil: ${stateInfo.soilType}. ${stateInfo.kvkNote}`;
      }
      const soil = findSoil(state.profile.district);
      if (soil) {
        indiaContext += `\nSoil type: ${soil.name} — ${soil.notes}`;
      }
    }
    const season = getSeason(new Date().getMonth() + 1);
    indiaContext += `\nCurrent season: ${season.hindi} (${season.months}). Crops: ${season.crops.join(", ")}.`;

    const sys = `${PERSONA}\n${profileLine} ${ctxHint ? `Context: ${ctxHint}.` : ""}${indiaContext}\n\nYeh rahe farmer aur Kisan Mitra ke pehle ke examples — inhi ke andaaz mein jawab do:\n${fewShotBlock()}\n\nChhota, seedha jawab do (1-2 line).`;
    const userContent = history ? `Pehli baatcheet:\n${history}\n\nAb kisaan poochhta hai: ${text}` : text;
    try {
      const out = await complete(
        [
          { role: "system", content: sys },
          { role: "user", content: userContent },
        ],
        { temperature: 0.5, maxTokens: 200 },
      );
      const trimmed = out.trim();
      // Reject garbage: empty, just punctuation, or unreadable
      if (!trimmed || /^[)\]\}\.,;!]+$/.test(trimmed) || trimmed.length < 5) {
        return { text: "Samajh nahi paya. Kripya dobara likhein ya photo bhejein." };
      }
      return { text: trimmed };
    } catch (e) {
      console.error("[brain] generalQuestion failed:", e);
      return { text: "Abhi mere paas jawab nahi. Kripya dobara koshish karein ya photo bhejein. 🙏" };
    }
  }

  private async cropTip(state: ConversationState, report: WeatherReport): Promise<string | null> {
    if (!state.profile.crop) return null;
    const today = report.days[0];
    const crop = state.profile.crop;
    let tip: string | null = null;
    if (today.rainProb >= 50) {
      if (["tomato", "potato", "chilli", "brinjal", "okra", "maize"].includes(crop)) {
        tip = `Barish aayegi (~${today.rainMm}mm). Spray/paani roko, drainage check karo.`;
      } else if (["rice", "wheat", "onion", "cotton"].includes(crop)) {
        tip = `Barish hogi. Khet mein paani bharne na dein, nikasi theek rakho.`;
      } else {
        tip = `Barish ka chance hai. Khet dekh lo, paani nikasi ka intzaam karo.`;
      }
    } else if (today.tMax > 35) {
      tip = `Garmi zyada hai (${today.tMax}°C). Sham ko paani dein, mulch laga dein.`;
    } else if (today.tMin < 10) {
      tip = `Thand hai (${today.tMin}°C). Poudhon ko dhak dein, paani kam dein.`;
    } else {
      tip = `Mausam theek hai. Niyamit paani dein, fasal dekhbhal karte raho.`;
    }
    return tip;
  }

  // ==================== SLASH COMMAND HANDLERS ====================

  private handleCropCommand(msg: BrainMessage, args: string): ReplySpec {
    const state = this.store.get(msg.conversationId);
    const crops = state.crops;

    if (!args) {
      // List all tracked crops
      if (crops.length === 0) {
        return { text: "Abhi koi fasal track nahi ho rahi. /set crop <naam> se start karein." };
      }
      let text = `📋 **Aapki fasalen:**\n`;
      for (const c of crops) {
        const problems = c.problems.length;
        const resolved = c.problems.filter(p => p.outcome === "resolved").length;
        text += `\n• **${c.crop}** — ${problems} dikkat${problems > 1 ? "en" : ""} (${resolved} suljhi)`;
      }
      text += `\n\nDetail ke liye: /crop <fasal naam>`;
      return { text };
    }

    // Show specific crop detail
    const cropName = args.toLowerCase();
    const crop = crops.find(c => c.crop.toLowerCase() === cropName);
    if (!crop) {
      return { text: `Fasal "${args}" track nahi ho rahi. /crop likhein list dekhne ke liye.` };
    }

    let text = `📊 **${crop.crop} — Fasla Record**\n`;
    text += `Shuru: ${crop.createdAt.slice(0, 10)}\n`;
    text += `Update: ${crop.updatedAt.slice(0, 10)}\n\n`;

    if (crop.problems.length === 0) {
      text += "Abhi koi dikkat record nahi hai.";
    } else {
      for (const p of crop.problems) {
        const status = p.outcome ? ` ✅ ${p.outcome}` : ` ⏳ ${p.outcome || "pending"}`;
        text += `\n🗓 ${p.date.slice(0, 10)} — ${p.diagnosis.disease}${status}`;
        text += `\n  Lakshan: ${p.symptoms.slice(0, 60)}`;
        text += `\n  Ilaj: ${p.solutionProvided.slice(0, 80)}`;
        if (p.impactNotes) text += `\n  Prabhav: ${p.impactNotes.slice(0, 80)}`;
        text += "\n";
      }
    }
    return { text };
  }

  private async handleSetCommand(msg: BrainMessage, args: string): Promise<ReplySpec> {
    const parts = args.split(/\s+/);
    const sub = parts[0].toLowerCase();
    const value = parts.slice(1).join(" ").trim();

    if (!sub) {
      return { text: `Upyog: /set crop <naam> | /set location <gaon> | /set name <naam> | /set acreage <zameen>` };
    }

    const state = this.store.get(msg.conversationId);

    switch (sub) {
      case "crop":
      case "fasal":
        if (!value) return { text: "Fasal ka naam batayein. Jaise: /set crop tomato" };
        const crop = value.toLowerCase();
        this.store.patchProfile(msg.conversationId, { crop });
        if (!state.profile.crops?.includes(crop)) {
          if (!state.profile.crops) state.profile.crops = [];
          state.profile.crops.push(crop);
        }
        this.store.addCropRecord(msg.conversationId, crop);
        this.store.persistAll();
        return { text: `✅ Fasal set: **${crop}**. Ab /crop ${crop} likhein detail dekhne ke liye.` };

      case "location":
      case "gaon":
        if (!value) return { text: "Gaon/sheher ka naam batayein. Jaise: /set location Bhubaneswar" };
        return this.finalize(msg, await this.setDistrict(msg, value));

      case "name":
        if (!value) return { text: "Naam batayein. Jaise: /set name Ramesh" };
        this.store.patchProfile(msg.conversationId, { name: value });
        return { text: `✅ Naam set: **${value}**.` };

      case "acreage":
      case "zameen":
        if (!value) return { text: "Zameen ka area batayein. Jaise: /set acreage 5 acre" };
        this.store.patchProfile(msg.conversationId, { acreage: value });
        return { text: `✅ Zameen set: **${value}**.` };

      default:
        return { text: `Pehchana nahi: /set ${sub}. Upyog: crop, location, name, acreage` };
    }
  }

  private async handleLocationCommand(msg: BrainMessage, args: string): Promise<ReplySpec> {
    const parts = args.split(/\s+/);
    const sub = parts[0].toLowerCase();
    const value = parts.slice(1).join(" ").trim();

    const state = this.store.get(msg.conversationId);
    const locations = this.store.getLocations(msg.conversationId);

    if (!sub || sub === "list") {
      if (locations.length === 0) {
        return { text: "Koi location save nahi hai. /set location <gaon> se add karein." };
      }
      let text = "📍 **Bachayi hui locations:**\n";
      for (const loc of locations) {
        const def = loc.isDefault ? " ⭐ (default)" : "";
        text += `\n• ${loc.name} — ${loc.district}${loc.state ? `, ${loc.state}` : ""}${def}`;
      }
      return { text };
    }

    switch (sub) {
      case "add":
        if (!value) return { text: "Location ka naam aur district batayein. Jaise: /location add Bhubaneswar, Odisha" };
        const [name, district, stateName] = value.split(",").map(s => s.trim());
        if (!name || !district) return { text: "Format: /location add <gaon>, <district>, [state]" };
        const newLoc = this.store.addLocation(msg.conversationId, { name, district, state: stateName });
        return { text: `✅ Location add: **${newLoc.name}** (${newLoc.district}${newLoc.state ? `, ${newLoc.state}` : ""})` };

      case "default":
      case "set":
        if (!value) return { text: "Location ID ya naam batayein. /location list se ID dekhiye." };
        const locId = locations.find(l => l.id === value || l.name.toLowerCase() === value.toLowerCase())?.id;
        if (!locId) return { text: "Location nahi mili. /location list se check karein." };
        this.store.setDefaultLocation(msg.conversationId, locId);
        return { text: `✅ Default location set: **${value}**. Mausam ab isi ke liye aayega.` };

      case "remove":
      case "delete":
        if (!value) return { text: "Location ID ya naam batayein jise hataana hai." };
        const removed = this.store.removeLocation(msg.conversationId, value);
        if (removed) return { text: `✅ Location hata di.` };
        return { text: "Location nahi mili." };

      default:
        return { text: `Upyog: /location list | /location add <gaon>, <district> | /location default <naam>` };
    }
  }

  private handleHistoryCommand(msg: BrainMessage, args: string): ReplySpec {
    const state = this.store.get(msg.conversationId);
    const logs = this.store.getCommandHistory(msg.conversationId);

    if (logs.length === 0) {
      return { text: "Koi command history nahi. /help se start karein." };
    }

    let text = "🕐 **Command History (aakhri 20):**\n";
    for (const log of logs.slice(-20).reverse()) {
      const status = log.success ? "✅" : "❌";
      text += `\n${status} /${log.command} ${log.args} — ${log.timestamp.slice(11, 16)}`;
    }
    return { text };
  }

  private handleProblemCommand(msg: BrainMessage, args: string): ReplySpec {
    const parts = args.split(/\s+/);
    const sub = parts[0].toLowerCase();
    const value = parts.slice(1).join(" ").trim();

    if (sub === "list") {
      const state = this.store.get(msg.conversationId);
      let text = "🐛 **Sabhi problems:**\n";
      for (const crop of state.crops) {
        for (const p of crop.problems) {
          text += `\n• ${crop.crop}: ${p.diagnosis.disease} (${p.date.slice(0, 10)}) — ${p.outcome || "pending"}`;
        }
      }
      return text ? { text } : { text: "Koi problem record nahi." };
    }

    return { text: `Upyog: /problem list` };
  }

  private handleOutcomeCommand(msg: BrainMessage, args: string): ReplySpec {
    // /outcome <crop> <problem-id> <resolved|improved|same|worsended> [notes]
    const parts = args.split(/\s+/);
    if (parts.length < 3) {
      return { text: `Upyog: /outcome <fasal> <problem-id> <resolved|improved|same|worsened> [prabhav notes]` };
    }
    const [crop, problemId, outcome, ...notes] = parts;
    const success = this.store.updateCropProblemOutcome(msg.conversationId, crop, problemId, outcome as any, notes.join(" "));
    return success
      ? { text: `✅ Outcome update: ${crop} — ${problemId} = ${outcome}` }
      : { text: "Problem nahi mili. /crop <fasal> se IDs dekhiye." };
  }

  private handleDeleteCommand(msg: BrainMessage, args: string): ReplySpec {
    const parts = args.split(/\s+/);
    const confirm = parts[0]?.toLowerCase();

    if (confirm !== "yes" && confirm !== "haan" && confirm !== "confirm" && confirm !== "kar do") {
      return {
        text: `⚠️ **Yeh action pura memory delete karega!**\n\n` +
          `Ismein shamil hain:\n` +
          `• Aapka profile (fasal, gaon, naam, zameen)\n` +
          `• Sabhi fasal records aur problems\n` +
          `• Command history\n` +
          `• Baatcheet history\n` +
          `• Seekhi hui preferences (ConversationBrain)\n\n` +
          `**Pakka karna hai?**\n` +
          `Likhein: /delete yes\n` +
          `Ya: /delete haan\n\n` +
          `Baad mein wapas nahi aa sakta — soch ke likhein.`
      };
    }

    const deleted = this.store.delete(msg.conversationId);
    if (deleted) {
      // Reset the conversation brain for this conversation
      this.convBrain = new ConversationBrain();
      return { text: "✅ **Pura memory delete ho gaya.**\n\nNaye kisaan ki tarah shuru kar sakte hain:\n`/start` ya `meri fasal <naam> hai` likhein.\n\nRam ram! 🌾" };
    }
    return { text: "Kuch delete karne ko nahi mila. Pehle /start karein." };
  }

  /** Post-process every reply: add assistant to history, tidy/guard, attach blocks. */
  private finalize(msg: BrainMessage, spec: ReplySpec): ReplySpec {
    const text = this.convBrain.postprocess(spec.text);
    this.store.addHistory(msg.conversationId, "assistant", text);
    return { ...spec, text };
  }

  /** Persist conversation brain state for a conversation. */
  private saveConvBrain(conversationId: string): void {
    const state = this.store.get(conversationId);
    state.convBrainState = this.convBrain.serialize();
    this.store.persistAll();
  }

  /** Periodic maintenance: prune old history so memory stays fresh (no stale confusion). */
  runMaintenance(): void {
    for (const { conversationId, state } of this.store.all()) {
      const summary = this.convBrain.maintain(state);
      if (summary) {
        // Inject a summary marker as the first history entry so future prompts
        // keep the gist without the full transcript.
        state.history.unshift({ role: "assistant", text: summary, ts: new Date().toISOString() });
        console.log(`[maintenance] summarized ${conversationId}`);
      }
      // Also save convBrain state periodically
      state.convBrainState = this.convBrain.serialize();
    }
    this.store.persistAll();
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
  const tl = t.toLowerCase();
  const LOC_KEYWORDS = /\b(gaon|gau[nm]|sheher|shahar|district|village|block|jila|town|ilake|ilaka|area)\b/;
  const FILLERS = new Set(["hai","hain","mein","main","ka","ke","ki","karta","karti","hu","hun","se","me","in","the","is","mera","meri","apna","ki","ne","ko","pe","par","se","hamara","humara","hamare","aapka","apna"]);
  const words = t.split(/\s+/);

  // Pattern 1: word immediately before a keyword → location name
  // e.g. "ranchi ilake mein" → "ranchi"
  for (let i = 1; i < words.length; i++) {
    const w = words[i].toLowerCase();
    if (LOC_KEYWORDS.test(w) && !FILLERS.has(words[i - 1].toLowerCase())) {
      return words[i - 1].trim();
    }
  }

  // Pattern 2: keyword then name — "gaon Bhubaneswar"
  // Use word-by-word to avoid greedy regex
  for (let i = 0; i < words.length - 1; i++) {
    const w = words[i].toLowerCase();
    if (LOC_KEYWORDS.test(w)) {
      // next word(s) that aren't fillers
      const next = words[i + 1];
      if (!FILLERS.has(next.toLowerCase())) {
        // Take up to 2 more words if they look like place names
        let loc = next;
        if (i + 2 < words.length && !FILLERS.has(words[i + 2].toLowerCase())) {
          loc += " " + words[i + 2];
        }
        if (i + 3 < words.length && !FILLERS.has(words[i + 3].toLowerCase())) {
          loc += " " + words[i + 3];
        }
        return loc.trim();
      }
    }
  }

  return null;
}

function isCropStatement(t: string): boolean {
  if (!normalizeCrop(t)) return false;
  // Must have explicit crop-setting intent words, not just crop name
  return /\b(meri fasal|mera fasal|main .* ugata|kheti karta|fasal .* hai|fasal .* hoti|boyi|lagai|lagaye)\b/.test(t);
}

function isIlajRequest(t: string): boolean {
  return /\b(ilaj|dawai|dava|treatment|medicine|upchar|samadhan|hal|upay|solution)\b/.test(t);
}

function isHelp(t: string): boolean {
  return /^(hi+|hello|hey|namaste|namaskar|salaam|ram ram|ram-ram|help|kya kar sakte ho|madad|\/start|\/menu|\/help|\/start\b)/i.test(t);
}

function isDiseaseText(t: string): boolean {
  // Require explicit disease context words, not just crop names or symptoms alone
  return /\b(bimari|beemari|rog|kya bimari|kaunsi bimari|pehchano|identify|diagnose|ilaaj chahiye|dawai chahiye)\b/.test(t) ||
         /(patte? (peele|sukh|gal|mud))./.test(t) ||
         /(dhabbe? (hai|hain|lage|lagi|lag rahe|lag raha|lag rahi))./.test(t) ||
         /(safed dhabe?|bhure dhabe?|kaale dhabe?|peele dhabe?)./.test(t) ||
         /(keeda|kida|kidi|sundi|illee|kilni|whitefly).{0,10}(hai|hain|laga|lage)/.test(t);
}
