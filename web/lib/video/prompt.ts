/**
 * The video prompt: a fixed template around the campaign's scene and product (both already screened for banned uses
 * when the brand or the agent wrote them). The start frame is the creator-approved ad image, so identity comes from
 * the pixels, not from words. Pure.
 */
export function videoPrompt(scene: string, product: string): string {
  return [
    "Use this image as the exact first frame of the video and animate it, keeping the person, their face and the setting exactly as they are.",
    "Subtle, natural motion only: the person breathes, smiles and moves slightly; the camera holds a steady, slow push-in. Head-and-shoulders or waist-up, front-facing, face large in frame.",
    `Scene: ${scene}. Product: ${product}.`,
    "One person only, no other people. No text, captions, logos or watermarks. No audio.",
  ].join("\n");
}
