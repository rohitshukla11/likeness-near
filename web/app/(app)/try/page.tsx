"use client";

/**
 * /try: "Find creators" for any visitor, signed in or not, in DEMO MODE (lib/agent/mode.ts). The brief is screened for
 * banned uses, then the agent shows its top 3 with reasons and who wasn't eligible. Nothing is requested, stored or
 * put on-chain; licence requests run only for the brand that holds the server's agent key.
 */
import { AppPage } from "@/components/ds";
import { AgentFlow } from "@/components/brand/AgentFlow";
import { DEMO_BANNER } from "@/lib/agent/mode";

export default function TryPage() {
  return (
    <AppPage title="Try the agent" description="Brief a brand's agent and see which creators it would ask, and why. No wallet needed.">
      <p className="m-0 rounded-[16px] bg-violet-soft px-4 py-3 text-[14px] font-semibold text-wait">{DEMO_BANNER}</p>
      <AgentFlow onChanged={() => undefined} />
    </AppPage>
  );
}
