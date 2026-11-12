import type { ReactNode } from "react";

/**
 * What a page shows while the part it needs hasn't landed yet (an API route, the contract): said plainly, never
 * replaced by sample data.
 */
export function NotConnected({ what, children }: { what: string; children?: ReactNode }) {
  return (
    <section role="status" className="rounded-[20px] border border-dashed border-field bg-white p-5 text-[15px] text-ink">
      <p className="m-0 font-semibold">Not connected yet</p>
      <p className="mt-1 mb-0 text-grey">{what} isn&apos;t connected in this build, so there is nothing to show. No sample data is shown in its place.</p>
      {children}
    </section>
  );
}
