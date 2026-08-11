# Devpost submission — Kisan Mitra

Copy-paste ready. Title, tagline, and description for the Caspian Buildathon.

## Repo description (GitHub → About → description)

Farm advisory agent for the Caspian Buildathon — photo diagnosis, live weather, and a morning tip in Hinglish, on Telegram, email, Discord, and Slack through one handler.

## Title

**Kisan Mitra — your farm fits in your pocket**

## Tagline (one line)

An AI agent that diagnoses crop disease, reads the weather, and texts the farmer every morning — on the channels they already use, through one handler.

## Description (for the "Story" field)

146 million farmers in India. Most have a cheap Android phone, a chat app, and a full day in the field. They are not going to install a farm app. They will text a number or send an email.

**Kisan Mitra is that number.** One agent identity, one handler, four channels — email, Telegram, Discord, and Slack. The same `onMessage` handler answers everywhere.

### What it does

1. **Photo diagnosis.** A farmer texts a photo of a sick leaf. Gemini vision reads it, and the agent matches it against a curated knowledge base of 40 crop diseases across 11 crops (tomato, potato, chilli, brinjal, rice, wheat, maize, okra, mango, cotton, onion). Every treatment comes from the KB — the agent never invents a cure. If nothing matches, it says so and asks for a clearer photo.
2. **Weather, spoken plainly.** "mausam" returns a live 3-day forecast for the farmer's district with a crop-specific tip.
3. **Remembers you.** One-time setup — "meri fasal tomato hai", "hamara gaon Bhubaneswar hai" — and every answer is tailored to their crop and place.
4. **Acts without being asked.** Every morning at 06:30 IST, it messages each farmer the day's weather and one crop tip. The agent has hands: it doesn't wait.

### Why this is creative (not another chatbot)

Most agent demos are a chat window that talks. This agent **does a real job** for a population that is invisible to most AI products. It reaches farmers through the apps they already open, speaks their language, and acts on a schedule without being prompted. The "many channels, one handler" requirement is not a checkbox — it is the product. A farmer doesn't need email, Telegram, and Discord. The farmer needs *one way in*, and the agent is there in all of them.

### Architecture

```
farmer ── Telegram / email / Discord / Slack
              │  (caspian-sdk transports)
              ▼
        one onMessage handler
              │
              ▼
         brain (intent routing)
        ┌──────┼───────┬──────────┐
        ▼      ▼       ▼          ▼
   vision    weather  profile    advice
   + KB     Open-Meteo JSON store Gemini
```

- **One handler, many channels.** Three `connect_*()` calls, one `onMessage`. Tappable buttons (Mausam / Ilaj) route through `onInteraction`.
- **Grounded diagnosis.** The knowledge base is the only allowed set of answers. Anything the model can't match becomes "unknown".
- **Proactive.** `node-cron` sends the morning advisory via `send_message`.
- **Zero paid services.** Free channels, free Open-Meteo, Gemini 2.5 Flash.

### Built with

caspian-sdk · Gemini 2.5 Flash (vision + text) · Open-Meteo · Node.js + TypeScript · vitest · Render

### What's next

- WhatsApp + SMS for farmers who don't use Telegram (paid/hosted channels).
- Voice replies in Odia and Bengali.
- A scheduled drone field-scan — the agent's literal eyes in the sky.

## Repo structure (for the judges)

| Path | What it is |
|---|---|
| `src/main.ts` | channel connects + handlers |
| `src/brain.ts` | the single handler + intent routing |
| `src/knowledge/diseases.ts` | curated disease KB |
| `src/weather.ts` | Open-Meteo client |
| `src/proactive.ts` | morning advisory |
| `tests/` | 30 unit tests, no network |
| `demo/DEMO_SCRIPT.md` | the demo video shot list |

## Submission checklist

- [ ] Public GitHub repo
- [ ] Demo video (2:00, real run) — see `demo/DEMO_SCRIPT.md`
- [ ] Project screenshot (the diagnosis card on a phone)
- [ ] Live URL in the "Try it out" field: `https://kisan-mitra-mqgy.onrender.com`
- [ ] List email + Telegram (and Discord + Slack) as the channels
- [ ] Devpost tags: AI, Agriculture, Hinglish, Gemini, TypeScript, Caspian
- [ ] Submit before **Aug 17, 2026, 00:00 IST**
