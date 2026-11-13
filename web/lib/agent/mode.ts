/**
 * Who gets the full agent and who gets demo mode on "Find creators". The server holds one function-call key, for one
 * brand (AGENT_ACCOUNT_ID): only that brand, signed in, gets "agent" mode (shortlist stored, licence requests
 * on-chain). Everyone else, signed in or not, gets "demo": the banned-use screen and the agent's shortlist with its
 * reasons, nothing stored and nothing on-chain; its AI spend is counted under one shared "demo" scope. Pure.
 */
export type FindMode = "agent" | "demo";

export const DEMO_SCOPE = "demo";
export const DEMO_BANNER = "Demo mode: the agent shows its shortlist. Licence requests run only for the brand that holds the agent key.";

export function findMode(account: string | null, agentAccount: string, agentConfigured: boolean): FindMode {
  return agentConfigured && !!account && account === agentAccount ? "agent" : "demo";
}
