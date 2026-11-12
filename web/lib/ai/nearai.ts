/**
 * NEAR AI Cloud (OpenAI-compatible, https://cloud-api.near.ai/v1). Every billed call first reserves its price under the
 * AI cost cap (lib/costcap.ts). The key is read from NEARAI_API_KEY and never logged.
 *
 * AI_MODE=test makes NO model call: callers get `null` and use their rule-based path, which every result labels as
 * such (never presented as a model's answer).
 */
import "server-only";
import { reserveAi, type PRICE_MICROS } from "../costcap";

export const BASE = process.env.NEARAI_BASE_URL || "https://cloud-api.near.ai/v1";
export const CHAT_MODEL = "Qwen/Qwen3.8-27B";
export const IMAGE_MODEL = "black-forest-labs/FLUX.2-klein-4B";

export const aiEnabled = () => process.env.AI_MODE !== "test" && !!process.env.NEARAI_API_KEY;

export class AiError extends Error {}

function key(): string {
  const k = process.env.NEARAI_API_KEY;
  if (!k) throw new AiError("NEAR AI isn't configured (NEARAI_API_KEY)");
  return k;
}

export type ChatContent = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
export interface ChatMessage {
  role: "system" | "user";
  content: ChatContent;
}

/**
 * One chat completion with a strict JSON schema and reasoning off. Returns the parsed JSON object (unvalidated: the
 * caller validates it), plus usage. Throws AiError on timeout, HTTP error or non-JSON output.
 */
export async function chatJson(o: {
  brand: string;
  what: keyof typeof PRICE_MICROS;
  messages: ChatMessage[];
  schemaName: string;
  schema: object;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ json: unknown; usage: unknown; ms: number }> {
  await reserveAi(o.brand, o.what);
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${key()}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: CHAT_MODEL,
        temperature: 0,
        max_tokens: o.maxTokens ?? 400,
        chat_template_kwargs: { enable_thinking: false },
        messages: o.messages,
        response_format: { type: "json_schema", json_schema: { name: o.schemaName, strict: true, schema: o.schema } },
      }),
      signal: AbortSignal.timeout(o.timeoutMs ?? 45_000),
    });
  } catch (e) {
    throw new AiError(`NEAR AI didn't answer in time (${(e as Error).name})`);
  }
  const ms = Date.now() - t0;
  const text = await res.text();
  if (!res.ok) throw new AiError(`NEAR AI answered HTTP ${res.status}`);
  const body = JSON.parse(text) as { choices?: { message?: { content?: string } }[]; usage?: unknown };
  const content = (body.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "");
  const s = content.indexOf("{");
  const e = content.lastIndexOf("}");
  if (s < 0 || e <= s) throw new AiError("NEAR AI's answer wasn't JSON");
  try {
    return { json: JSON.parse(content.slice(s, e + 1)), usage: body.usage, ms };
  } catch {
    throw new AiError("NEAR AI's answer wasn't valid JSON");
  }
}
