/**
 * After the creator approves: if the brand left the scene or the product empty, the agent writes them (text only, from
 * the brief and the use), screens them for banned uses like anything a brand writes, and saves them to the campaign,
 * so every render of that campaign uses the same scene and product. With AI off, a plain default per use.
 */
import "server-only";
import { setCampaignScene, log, type CampaignRow } from "../db/records";
import { HttpError } from "../http";
import { FIELD_MAX, isUse, USE_LABELS, type Use } from "../rules";
import { screen } from "../ai/filter";
import { aiEnabled, chatJson } from "../ai/nearai";
import { clean } from "../ai/prompt";

const SYSTEM = `You are a brand's advertising agent. Write the scene and the product for a fixed photo template (head-and-shoulders
or waist-up, front-facing, the creator's face unchanged), from the brief and the licensed use. Plain descriptions, each
at most 200 characters, no people other than the creator, no text or logos, nothing political, sexual, involving minors,
impersonating anyone, or deceptive. Keep whatever the brand already gave. Answer only with JSON matching the schema.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["scene", "product"],
  properties: { scene: { type: "string", maxLength: FIELD_MAX }, product: { type: "string", maxLength: FIELD_MAX } },
};

const DEFAULT_PRODUCT: Record<Use, string> = {
  Fashion: "a plain jacket with no logo",
  Beauty: "a plain skincare bottle with no label",
  FoodDrink: "a white ceramic cup with no logo",
  Tech: "a plain laptop with no logo",
  Travel: "a plain travel backpack with no logo",
  Fitness: "plain white running shoes with no logo",
  Finance: "a plain smartphone with no logo",
  Other: "a plain product with no logo",
};

/** The campaign's scene and product, writing (and screening, and saving) any the brand left empty. */
export async function ensureScene(brand: string, c: CampaignRow): Promise<{ scene: string; product: string; wrote: boolean }> {
  if (c.scene && c.product) return { scene: c.scene, product: c.product, wrote: false };
  const use: Use = isUse(c.usage) ? c.usage : "Other";
  let scene = c.scene || "a bright, simple studio with soft daylight";
  let product = c.product || DEFAULT_PRODUCT[use];
  let by = "defaults (AI off)";
  if (aiEnabled()) {
    const { json } = await chatJson({
      brand,
      what: "chat",
      schemaName: "scene_product",
      schema: SCHEMA,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify({ brief: c.brief, use: USE_LABELS[use], scene: c.scene || null, product: c.product || null }) },
      ],
    });
    const o = json as { scene?: unknown; product?: unknown };
    if (!c.scene && typeof o.scene === "string" && clean(o.scene)) scene = clean(o.scene);
    if (!c.product && typeof o.product === "string" && clean(o.product)) product = clean(o.product);
    by = "model";
  }
  const s = await screen(brand, use, { scene, product });
  if (!s.allowed) {
    await log(brand, { kind: "blocked", summary: `the agent's scene/product was refused (${s.by}): ${s.reasons.join("; ")}`, licenceId: c.licence_id });
    throw new HttpError(409, `the agent's scene/product was refused: ${s.reasons.join("; ")}`);
  }
  await setCampaignScene(c.id, scene, product);
  await log(brand, { kind: "plan", summary: `wrote the scene and product (${by}): scene "${scene}"; product "${product}"`, licenceId: c.licence_id });
  return { scene, product, wrote: true };
}
