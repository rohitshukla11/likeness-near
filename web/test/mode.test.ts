// node --test: who gets the full agent and who gets demo mode on "Find creators".
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DEMO_BANNER, findMode } from "../lib/agent/mode.ts";

test("only the brand holding the server's agent key, signed in, gets agent mode; everyone else gets demo", () => {
  assert.equal(findMode("rohitshukla.testnet", "rohitshukla.testnet", true), "agent");
  assert.equal(findMode("someone.testnet", "rohitshukla.testnet", true), "demo");
  assert.equal(findMode(null, "rohitshukla.testnet", true), "demo", "signed out");
  assert.equal(findMode("rohitshukla.testnet", "rohitshukla.testnet", false), "demo", "no key configured on the server");
  assert.match(DEMO_BANNER, /Licence requests run only for the brand that holds the agent key/);
});

test("demo mode never stores or requests: the find path returns before addCampaign and logs nothing", () => {
  const src = readFileSync(new URL("../lib/agent/brandAgent.ts", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("export async function findCreators("), src.indexOf("export async function requestCreator("));
  const demoReturn = body.indexOf("if (demo) return");
  assert.ok(demoReturn > 0 && demoReturn < body.indexOf("addCampaign("), "the demo return comes before the campaign is stored");
  assert.equal((body.match(/await log\(/g) ?? []).length, 0, "every log in find goes through `note`, a no-op in demo");
  assert.doesNotMatch(body, /agentCall\(/, "find never calls the chain");
});
