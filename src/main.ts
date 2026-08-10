import http from "node:http";
import { CommClient } from "caspian-sdk";
import { config } from "./config.js";
import { Store } from "./store.js";
import { Brain } from "./brain.js";
import { makeHandler } from "./handler.js";
import { startProactive } from "./proactive.js";

async function main(): Promise<void> {
  if (!config.caspianApiKey) {
    console.error(
      "No CASPIAN_API_KEY/COMM_API_KEY set. Copy .env.example to .env and add your key (caspian init).",
    );
    process.exit(1);
  }

  const client = new CommClient({ apiKey: config.caspianApiKey });
  const store = new Store(config.storePath);
  const brain = new Brain(store);

  // One identity, many channels. Each connect_* binds to the same handler.
  // Each connect is isolated: a bad token on one channel must not kill the rest.
  async function connect(label: string, fn: () => Promise<{ address?: string; id?: string; authorize_url?: string }>): Promise<void> {
    try {
      const c = await fn();
      const where = c.authorize_url ?? c.address ?? c.id ?? "connected";
      console.log(`[channels] ${label}:`, where);
    } catch (e) {
      console.warn(`[channels] ${label}: skipped — ${(e as Error).message}`);
    }
  }

  await connect("email", () => client.connectEmail({ username: config.emailUsername }));
  await connect("telegram", () => {
    if (!config.telegramBotToken) throw new Error("no TELEGRAM_BOT_TOKEN");
    return client.connectTelegram({ botToken: config.telegramBotToken });
  });
  await connect("discord", () => {
    if (config.discordBotToken) return client.connectDiscord({ botToken: config.discordBotToken });
    // No token? One-click install of the shared bot — zero setup.
    return client.installDiscord({ displayName: "Kisan Mitra" });
  });
  await connect("slack", () => client.installSlack({ displayName: "Kisan Mitra" }));

  client.onMessage(makeHandler(client, brain));

  // Tappable buttons (Mausam / Ilaj / Naya sawal) land here as interactions.
  client.onInteraction(async (interaction) => {
    const conversationId = interaction.conversationId ?? "interaction-standalone";
    try {
      const spec = await brain.handleValue(conversationId, interaction.value ?? "");
      await interaction.reply(spec.text ?? null, null, spec.blocks ?? null, spec.media ?? null);
    } catch (e) {
      console.error("[interaction] error:", e);
      try {
        await interaction.reply("Kuch gadbad ho gayi. 🙏");
      } catch {
        /* nothing else to do */
      }
    }
  });

  startProactive(client, store, brain);
  startHealthServer();

  console.log("Kisan Mitra is listening on email + telegram + discord + slack — one handler.");
  await client.listen();
}

/** Render needs a listening port; /health is what the keep-alive pings. */
function startHealthServer(): void {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, agent: "kisan-mitra" }));
  });
  server.listen(config.port, () => {
    console.log(`[health] listening on :${config.port}`);
  });
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
