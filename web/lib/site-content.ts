/**
 * Marketing copy that is data, not code. Every number here is a real measurement or true by construction, with its
 * source; testimonials are real quotes only. An empty list hides the section entirely.
 */

export const MEASUREMENTS = {
  /** By construction: the contract's submit_render writes a receipt keyed by the ad's sha256 before anything is paid. */
  rendersWithReceipt: {
    value: 100,
    source: "submit_render records a receipt for the ad's sha256; approve_render pays only against that receipt",
  },
} as const;

export type Testimonial = { quote: string; name: string; role: string };

/** Real, attributed quotes only. Leave empty until there are some: the section is then not rendered. */
export const TESTIMONIALS: Testimonial[] = [];

export const BUILT_ON = ["NEAR Protocol", "NEAR AI Cloud", "Next.js"];
