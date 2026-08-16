import type { Block } from "caspian-sdk";
import type { WeatherReport } from "./weather.js";

/**
 * Block builders. Blocks are provider-neutral plain objects: Slack Block Kit,
 * Discord embeds, Telegram inline keyboards, and HTML email all render from
 * the same payload (caspian-sdk docs: rich messages).
 */

export interface Diagnosis {
  disease: string; // "" for unknown
  crop: string;
  confidence: number;
  organic: string;
  chemical: string;
  prevention: string;
  note: string;
}

export function helpCard(): Block[] {
  return [
    { type: "heading", text: "Main hoon Kisan Mitra 🌾" },
    {
      type: "text",
      text: "Aapki fasal, bimari aur mausam ki salah. Kuch aise kar sakte ho:",
    },
    {
      type: "list",
      items: [
        "📸 **Patte ki photo bhejein** → bimari + ilaaj",
        "☁️ **/weather** ya **mausam** → 3 din ka purvabhas",
        "🌱 **/set crop <naam>** → fasal set karein (jaise: /set crop tomato)",
        "📍 **/set location <gaon>** → apna gaon/sheher set karein",
        "🌾 **/crop** → sab fasalen dekhiye, **/crop <naam>** → detail",
        "📝 **/problem list** → sab problems ki list",
        "✅ **/outcome <fasal> <id> <resolved|improved|same|worsened>** → result update karein",
        "🕐 **/history** → command history dekhiye",
        "📍 **/location list|add|default|remove** → locations manage karein",
        "👤 **/set name <naam> | /set acreage <zameen>** → profile complete karein",
        "🗑️ **/delete yes** → **pura memory delete karein** (profile, fasal, history, sab)",
      ],
    },
  ];
}

export function diagnosisCard(d: Diagnosis, photoUrl?: string, crop?: string): Block[] {
  if (!d.disease || d.disease === "unknown") {
    return [
      { type: "heading", text: "Samajh nahi paya 🙏" },
      {
        type: "text",
        text:
          d.note ||
          "Yeh photo thodi aspaas hai. Achhi roshni mein, seedha upar se ek aur photo bhejein. Ya apne kshetriya krishi adhikari se milen.",
      },
    ];
  }
  const blocks: Block[] = [];
  if (photoUrl) blocks.push({ type: "image", url: photoUrl, alt: "leaf photo" });
  blocks.push({
    type: "card",
    title: d.disease,
    subtitle: crop ? `Fasal: ${crop}` : undefined,
    text: d.organic,
    buttons: [
      { label: "Mausam", value: "mausam" },
      { label: "Ilaj (full)", value: "ilaj" },
      { label: "Naya sawal", value: "sawal" },
    ],
  });
  return blocks;
}

export function weatherCard(w: WeatherReport): Block[] {
  return [
    { type: "heading", text: `Mausam · ${w.location}` },
    { type: "text", text: w.summary },
    {
      type: "fields",
      fields: w.days.slice(0, 3).map((d) => ({
        label: d.date.slice(5),
        value: `${d.tMin}°–${d.tMax}°C · barish ${d.rainProb}%`,
      })),
    },
  ];
}
