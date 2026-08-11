import "dotenv/config";

/**
 * Kisan Mitra configuration. Mirrors the provider-fallback pattern from
 * tech-genius (Nexora): one OpenAI-compatible endpoint, Gemini first.
 */
export const config = {
  // Caspian gateway. The SDK reads COMM_API_KEY by default; accept the
  // CASPIAN_API_KEY name the docs use as well, and pass it explicitly.
  caspianApiKey: process.env.CASPIAN_API_KEY ?? process.env.COMM_API_KEY ?? "",

  // Gemini — text + vision in one OpenAI-compatible client.
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-flash-latest",
  geminiBaseUrl:
    process.env.GEMINI_BASE_URL ??
    "https://generativelanguage.googleapis.com/v1beta/openai/",

  // Optional channel credentials. Email + Telegram are the two required ones.
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  discordBotToken: process.env.DISCORD_BOT_TOKEN ?? "",

  // Agent identity on email.
  emailUsername: process.env.AGENT_EMAIL_USERNAME ?? "kisan-mitra",

  // Runtime.
  port: Number(process.env.PORT ?? 3000),
  storePath: process.env.STORE_PATH ?? "./data/store.json",

  // Proactive morning advisory (Asia/Kolkata).
  timezone: "Asia/Kolkata",
  proactiveHour: 6,
  proactiveMinute: 30,
};
