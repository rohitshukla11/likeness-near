// node --test: the app's public URL and the same-origin rule (nothing may assume localhost in production).
import assert from "node:assert/strict";
import { test } from "node:test";
import { appUrl, sameOriginOk } from "../lib/origin.ts";

test("the app URL: configured, else Render's, else localhost", () => {
  assert.equal(appUrl({ NEXT_PUBLIC_APP_URL: "https://likeness.example/" }), "https://likeness.example");
  assert.equal(appUrl({ RENDER_EXTERNAL_URL: "https://likeness-near.onrender.com" }), "https://likeness-near.onrender.com");
  assert.equal(appUrl({}), "http://localhost:3000");
});

test("same origin: Origin host = Host, or the configured public URL; nothing else", () => {
  const env = { NEXT_PUBLIC_APP_URL: "https://likeness-near.onrender.com" };
  assert.equal(sameOriginOk("http://localhost:3000", "localhost:3000", {}), true);
  assert.equal(sameOriginOk("https://likeness-near.onrender.com", "10.0.0.7:10000", env), true, "behind a proxy with an internal Host");
  assert.equal(sameOriginOk("https://evil.example", "likeness-near.onrender.com", env), false);
  assert.equal(sameOriginOk(null, "localhost:3000", {}), false, "no Origin, refused");
  assert.equal(sameOriginOk("not a url", "localhost:3000", {}), false);
});
