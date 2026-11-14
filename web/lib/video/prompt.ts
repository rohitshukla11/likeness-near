/**
 * The video's two prompts, copied from likeness-paypal's video pipeline (its lib/ai/eth-prompts.ts and
 * render-video.ts), with our campaign's screened scene and product added:
 *   stillPrompt   for the start frame: Google's image model makes it from the creator's REAL reference photo (never
 *                 from a FLUX ad), as the opening frame of a 16:9 clip, with paypal's identity, wardrobe, accessory and
 *                 pose rules.
 *   videoPrompt   for the clip: the start frame is the exact first frame; the action runs continuously with a
 *                 following camera; the person, product and setting of the first frame are kept, face recognisable.
 * The brief, scene, product and action were screened for banned uses before they get here. Pure.
 */

/** What the start frame shows: the brand's brief with the campaign's scene and product. */
export function videoBrief(brief: string, scene: string, product: string): string {
  return `${brief.trim()} Scene: ${scene.trim()}. Product: ${product.trim()}.`;
}

/** paypal's stillPrompt(brief, "video"), word for word. */
export function stillPrompt(brief: string): string {
  return [
    "The image shows one real, consenting adult who has licensed their face for this advertising image.",
    "Generate a new photorealistic image of exactly this person, keeping their face, identity and appearance faithful to the reference photo.",
    "Their face is clearly visible, unobstructed and well lit; one person only.",
    "Compose it as the opening frame of a short video ad: landscape 16:9, the person in the centre third with room to move, already in the middle of the brief's action (for example mid-stride if they are running), not posing for the camera.",
    "Do not add any text, logos, captions or watermarks.",
    "Clothing: as the brief describes; if it names none, plain, simple clothing with no logos, text, prints or brand marks. Never copy the clothing from the reference photo.",
    "Accessories: none from the reference photo (no earbuds, headphones, hats, bags, badges, microphones or jewellery from it) unless the brief asks for them.",
    "Pose and expression: doing what the brief describes, caught mid-movement when it has an action (for example mid-stride when running), otherwise natural and suited to the brief (for example relaxed and smiling in a café); never the reference photo's straight-on pose or neutral expression.",
    `Brief: ${brief.trim()}`,
  ].join("\n");
}

/** paypal's first-frame line (render-video.ts) + its motionPrompt(action), then our scene and product. */
export function videoPrompt(action: string, scene: string, product: string): string {
  return [
    "Use this image as the exact first frame of the video and animate the scene from it, keeping the person, their face and the setting as they are.",
    `Action: ${action.trim()}`,
    "The person performs the action in the brief continuously for the whole clip, with natural full-body movement (for example, if they are running, they keep running along the path at a steady pace); they never stop to stand or pose.",
    "The camera moves with them (a smooth tracking or follow shot) so they stay in frame. One continuous shot, no cuts.",
    "Keep exactly the person, product and setting of the first frame; their face stays visible and recognisable throughout.",
    "Photorealistic advertising footage. No text, captions, logos or watermarks.",
    `Scene: ${scene.trim()}. Product: ${product.trim()}.`,
  ].join("\n");
}
