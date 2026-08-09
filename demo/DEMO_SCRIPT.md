# Demo video — 2:00, one continuous take

The judging criterion is "the most creative use case that actually works." So
this is a **real, live** run, not a mocked script. Film it in one take on a
phone; no cuts that hide the wiring. If a reply is slow, keep rolling and let
the "typing" indicator show.

**Props:** a phone, a real leaf with spots (or a clear printed photo), a second
device with the agent's Telegram open.

## Shot list

| # | Time | What happens on screen | Voiceover |
|---|---|---|---|
| 1 | 0:00–0:12 | Phone: open Telegram, find Kisan Mitra bot. Type *"meri fasal tomato hai"* | "146 million farmers in India. No app, no dashboard — just the apps they already use." |
| 2 | 0:12–0:22 | Type *"hamara gaon Bhubaneswar hai"*. Bot confirms. | "The agent remembers who you are and where your farm is." |
| 3 | 0:22–0:45 | Attach a photo of the spotted leaf with text *"meri tomato pe dhabbe hain"*. Bot replies with a diagnosis card + treatment. | "Text a photo of a sick leaf. It reads it with vision, matches it against a real disease knowledge base, and returns a treatment. It never invents a cure." |
| 4 | 0:45–1:05 | Tap the **Mausam** button. Weather card arrives with a tomato tip. | "And the weather it uses to advise you is live, for your district." |
| 5 | 1:05–1:25 | Switch to email: send the agent a follow-up in English. Same agent, same thread. | "One agent, every channel. Email, Telegram, Discord, Slack — the same identity, the same memory." |
| 6 | 1:25–1:45 | Cut to the code: `src/main.ts` — the three `connect_*()` lines and one `onMessage`. | "The whole multi-channel part is three lines. The hard part is the job — and the job is real." |
| 7 | 1:45–2:00 | Night shot (optional, phones only): a notification *"Aaj ki salah"* morning weather message. | "Every morning at 6:30, it shows up without being asked. Your farm fits in your pocket." |

## Live-demo backup (if asked to demo live)

- Pre-answer **"which channels?"** → "email and Telegram through the same handler, plus Discord and Slack connected."
- Pre-answer **"is the model fine-tuned?"** → "No — zero-shot Gemini vision grounded against a 38-disease curated KB. The KB is the guardrail."
- If the network misbehaves, fall back to the email channel: email a photo to the agent, which reads it from the email HTML.

## Good shots to grab

- The morning proactive message arriving as a push notification.
- The "typing…" indicator during a diagnosis.
- The farmer's phone in the field (even a few seconds of b-roll sells it).
