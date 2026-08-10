# Kisan Mitra 🌾

*Your farm fits in your pocket.* A farm advisory agent that lives where farmers already are — Telegram, WhatsApp-style chat, and email — instead of inside an app nobody installs.

Built for the [Caspian Buildathon](https://caspian.devpost.com/): **one agent identity, one handler, many channels.** The same `onMessage` handler answers on email, Telegram, Discord, and Slack. No dashboards, no app store, no reading barrier. A farmer texts a photo of a sick leaf and gets a diagnosis, a treatment, and the week's weather back in Hinglish.

## The pitch

146 million farmers in India. Most of them have a feature phone or a cheap Android, a chat app, and a full day of field work. They are not going to install a farm app. But they will text a number or send an email.

Kisan Mitra is that number:

- **Photo diagnosis.** Send a photo of a leaf with spots; the agent reads it with Gemini vision and returns a grounded diagnosis + treatment. Every treatment comes from a curated knowledge base — the agent never invents a cure.
- **Weather, spoken plainly.** "mausam" returns a 3-day forecast with a crop-specific tip.
- **Remembers you.** One-time profile setup — "meri fasal tomato hai", "hamara gaon Bhubaneswar hai" — and it tailors everything to your crop and district.
- **Acts without being asked.** Every morning at 06:30 IST it messages each farmer the day's weather and one crop tip.
- **One identity.** The same agent, the same memory, across email + Telegram + Discord + Slack.

## Architecture

```
farmer ── Telegram / email / Discord / Slack
              │  (caspian-sdk transports)
              ▼
        one onMessage handler  ── src/handler.ts
              │
              ▼
         src/brain.ts  (intent routing)
        ┌──────┼──────────┬───────────┐
        ▼      ▼          ▼           ▼
   vision   weather    profile     advice
   src/brain Open-Meteo  src/store   Gemini
   + diseases.ts         (JSON)
```

- `src/brain.ts` — the single brain behind every channel. Regex-first routing (deterministic for the demo), LLM for diagnosis and free-form advice.
- `src/knowledge/diseases.ts` — ~38 curated crop-disease entries. The KB is the **only** allowed set of diagnoses; anything the model can't match becomes "unknown" with a request for a clearer photo.
- `src/llm.ts` — Gemini 2.5 Flash over Google's OpenAI-compatible endpoint (text + vision in one client, same provider pattern as Nexora).
- `src/weather.ts` — Open-Meteo, free, no key.
- `src/store.ts` — per-conversation profile + last diagnosis, persisted to JSON.
- `src/proactive.ts` — daily 06:30 IST morning advisory via `send_message`.
- `src/cards.ts` — provider-neutral blocks (cards, images, buttons) that render natively on each channel.

## Quickstart

**Prereqs:** Node 18+, a `CASPIAN_API_KEY`, a `GEMINI_API_KEY` (free at aistudio.google.com), and optionally a Telegram bot token from @BotFather.

**Get the Caspian key (free, no signup, no card):**

```bash
curl -s -X POST https://api.trycaspianai.com/v1/projects/sandbox-H \
  -H 'Content-Type: application/json' -d '{"name":"kisan-mitra"}'
```

Copy the `api_key` (starts `comm_sandbox_`) into `.env`. Email, Telegram, Discord, and Slack channels are free; the $25 hackathon credit is Featherless inference, not a Caspian payment.

**Get a Telegram bot token:** open @BotFather in Telegram → `/newbot` → name + username → copy the token into `.env`.

Then:

```bash
npm install
cp .env.example .env        # fill in the keys
npm run dev                 # connects channels + listens
```

You should see email, telegram, and slack connect, and `listen()` start. Message your agent on Telegram, email the agent's address, and invite the Slack app — the same handler answers all of them.

**No channels yet?** Run the offline smoke test, which exercises the brain without any channel:

```bash
npm run smoke              # needs only GEMINI_API_KEY
```

**Tests:**

```bash
npm test                   # 14 unit tests, no network, no keys
npm run typecheck
```

Drop a real leaf photo at `tests/fixtures/leaf.jpg` and `npm run smoke` will run a live diagnosis against it.

## Channels

| Channel | How | Cost |
|---|---|---|
| Email | auto-provisioned inbox (`AGENT_EMAIL_USERNAME`) | free |
| Telegram | bot token from @BotFather | free |
| Discord | bot token or shared install | free |
| Slack | one-click shared app (prints an authorize_url) | free |

## Deploy to Render

1. Push this repo to GitHub.
2. On Render, create a Blueprint from `render.yaml` (or a Web Service: build `npm ci`, start `npm start`, health check `/health`).
3. Set `GEMINI_API_KEY`, `CASPIAN_API_KEY`, and optionally `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN` in the service Environment.
4. Edit `.github/workflows/keep-alive.yml` to your real `.onrender.com` URL — the cron pings `/health` every ~13 min so the free tier never sleeps.

Note: Render free-tier disk is ephemeral; the store (farmer profiles) resets on a cold restart. Fine for a demo; a future version swaps in Postgres.

## The demo flow (film this)

1. Open Telegram on a phone, text the bot: *"meri tomato pe dhabbe hain"* + attach a photo of a spotted leaf.
2. Bot replies with a diagnosis card and treatment.
3. Tap **Mausam** — a 3-day forecast with a tomato tip.
4. Email the agent a follow-up in English; the same agent answers in the same thread.
5. Freeze-frame the handler: three `connect_*()` lines, one `onMessage`.

Full shot list in `demo/DEMO_SCRIPT.md`.

## Roadmap (stretch, post-core)

- **Drone field scan.** A scheduled job that ingests a field image and messages the farmer when it spots stress — the agent's literal eyes in the sky.
- WhatsApp and SMS channels (paid/hosted) for farmers who don't use Telegram.
- Voice replies in Odia/Bengali.

## License

MIT — code written for the Caspian Buildathon 2026.
