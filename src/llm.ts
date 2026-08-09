import OpenAI from "openai";
import { config } from "./config.js";

/**
 * LLM client — text + vision on Google's OpenAI-compatible endpoint.
 * The same provider pattern Nexora runs (tech-genius/src/agent/llm.py),
 * ported to TypeScript with a vision path added.
 */

export type ChatPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string | ChatPart[];
}

export interface CompleteOptions {
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
}

const client = new OpenAI({
  apiKey: config.geminiApiKey,
  baseURL: config.geminiBaseUrl,
});

/** Chat completion, optionally in JSON mode (with a plain retry fallback). */
export async function complete(
  messages: ChatMsg[],
  opts: CompleteOptions = {},
): Promise<string> {
  if (!config.geminiApiKey) throw new Error("GEMINI_API_KEY not set");
  const { temperature = 0.2, maxTokens = 2048, json = false } = opts;
  const base = {
    model: config.geminiModel,
    // openai's types are stricter than the wire; Gemini accepts these shapes.
    messages: messages as never,
    temperature,
    max_tokens: maxTokens,
  } as Parameters<typeof client.chat.completions.create>[0];

  try {
    const resp = (await client.chat.completions.create(
      json ? { ...base, response_format: { type: "json_object" } } : base,
    )) as OpenAI.Chat.Completions.ChatCompletion;
    return resp.choices[0]?.message?.content ?? "";
  } catch (firstErr) {
    // Some Gemini deployments reject response_format; retry plain, the caller
    // parses JSON out of the text. Re-throw real errors when not in JSON mode.
    if (!json) throw firstErr;
    const resp = (await client.chat.completions.create(
      base,
    )) as OpenAI.Chat.Completions.ChatCompletion;
    return resp.choices[0]?.message?.content ?? "";
  }
}

/** JSON-mode completion that tolerates a ragged response; null on failure. */
export async function completeJson<T>(
  messages: ChatMsg[],
  opts: CompleteOptions = {},
): Promise<T | null> {
  const raw = await complete(messages, { ...opts, json: true, temperature: 0 });
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) return null;
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
