/**
 * The banned-use screen for everything a brand (or its agent) writes: the brief, the scene and the product.
 *   1. keyword rules for the five uses banned for everyone (lib/rules.ts), always;
 *   2. then a classifier on NEAR AI (Qwen3.8-27B, strict JSON, reasoning off): banned uses, and whether the text fits
 *      the licensed use. If it can't answer, the text is REFUSED (fail closed).
 * With AI_MODE=test only the keyword rules run, and the result says so.
 */
import "server-only";
import { bannedHits, USE_LABELS, type Use } from "../rules";
import { aiEnabled, chatJson } from "./nearai";

export interface ScreenResult {
  allowed: boolean;
  reasons: string[];
  /** "keywords+model" or "keywords only (AI_MODE=test)". */
  by: string;
}

const BANNED = ["political", "adult", "minors", "impersonation", "deception"] as const;

const SYSTEM = `You screen text for an AI ad generator that edits a real, consenting adult's photo under a licence.
Banned uses, never allowed under any licence:
- political: elections, candidates, parties, policy advocacy;
- adult: sexual or sexualised content, nudity;
- minors: anything involving minors or a childlike depiction;
- impersonation: presenting the person as someone else, or as endorsing or saying something they did not;
- deception: fake news, fake evidence, fake testimonials, depicting crimes or events as real.
The licence covers exactly one use. Decide whether the text fits it. Answer only with JSON matching the schema; reason under 25 words.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["banned", "fits_use", "reason"],
  properties: {
    banned: { type: "array", items: { type: "string", enum: [...BANNED] } },
    fits_use: { type: "boolean" },
    reason: { type: "string", maxLength: 200 },
  },
};

export async function screen(brand: string, use: Use, fields: Record<string, string>): Promise<ScreenResult> {
  const reasons: string[] = [];
  for (const [name, text] of Object.entries(fields)) reasons.push(...bannedHits(text).map((h) => `banned use in the ${name}: ${h}`));
  if (reasons.length) return { allowed: false, reasons, by: "keywords" };
  if (!aiEnabled()) return { allowed: true, reasons: [], by: "keywords only (AI_MODE=test)" };
  try {
    const text = Object.entries(fields)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    const { json } = await chatJson({
      brand,
      what: "chat",
      schemaName: "banned_use_screen",
      schema: SCHEMA,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Licensed use: ${USE_LABELS[use]}\n${text}` },
      ],
    });
    const o = json as { banned?: unknown; fits_use?: unknown; reason?: unknown };
    if (!Array.isArray(o.banned) || !o.banned.every((b) => BANNED.includes(b as never)) || typeof o.fits_use !== "boolean" || typeof o.reason !== "string") {
      throw new Error("the answer didn't match the schema");
    }
    for (const b of o.banned) reasons.push(`banned use: ${b} (${o.reason})`);
    if (!o.fits_use) reasons.push(`outside the licensed use (${USE_LABELS[use]}): ${o.reason}`);
  } catch (e) {
    reasons.push(`the safety check couldn't run, so this is refused: ${(e as Error).message.slice(0, 160)}`);
  }
  return { allowed: reasons.length === 0, reasons, by: "keywords+model" };
}
