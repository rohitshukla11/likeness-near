/*
 * Likeness standalone verifier: calls the contract's verify(sha256) view on NEAR testnet through the public RPC, from
 * the browser, with nothing in between. The file is hashed here (SHA-256); only the hash is sent, to the RPC.
 * Trust comes from the chain: the receipt is the contract's own record, written when the creator's wallet signed
 * approve_render for that exact hash. A classic script so the page also works opened from disk.
 */
(function () {
  "use strict";
  var q = new URLSearchParams(location.search);
  var CONTRACT = q.get("contract") || "likeness-near-rohit.testnet";
  var RPC = q.get("rpc") || "https://rpc.testnet.near.org";
  var $ = function (id) { return document.getElementById(id); };
  $("contract").textContent = CONTRACT;
  $("rpc").textContent = RPC;

  // Synthetic demo creators (AI-generated faces, not real people): the same list as web/lib/synthetic.ts.
  var SYNTHETIC = { "likeness-synth-asha.testnet": "Asha", "likeness-synth-daniel.testnet": "Daniel", "likeness-synth-ana.testnet": "Ana Reyes" };
  var LOOK = {
    Licensed: ["ok", "Licensed", "The creator approved this exact file in their own wallet, was paid, and the licence is in force."],
    Expired: ["muted", "Expired", "Approved once, but the licence has ended."],
    Revoked: ["bad", "Revoked", "The creator revoked this licence."],
    Unknown: ["muted", "Unknown", "No approved receipt for this file: not made through Likeness, edited (any change alters the hash), or never approved."]
  };

  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; });
  }
  function near(yocto) {
    var y = BigInt(yocto), w = y / 1000000000000000000000000n, f = (y % 1000000000000000000000000n).toString().padStart(24, "0").slice(0, 4).replace(/0+$/, "");
    return w + (f ? "." + f : "") + " NEAR";
  }
  function day(ms) { return ms ? new Date(ms).toLocaleString() : "—"; }

  async function verify(sha) {
    var out = $("out");
    if (!/^[0-9a-f]{64}$/.test(sha)) { out.innerHTML = '<p class="bad">A sha256 is 64 hex characters.</p>'; return; }
    out.innerHTML = "<p>Asking the contract…</p>";
    try {
      var body = { jsonrpc: "2.0", id: "v", method: "query", params: { request_type: "call_function", finality: "final", account_id: CONTRACT, method_name: "verify", args_base64: btoa(JSON.stringify({ sha256: sha })) } };
      var r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      var j = await r.json();
      if (j.error || !j.result || j.result.error) throw new Error((j.error && (j.error.cause && j.error.cause.name || j.error.message)) || (j.result && j.result.error) || "RPC error");
      var v = JSON.parse(new TextDecoder().decode(new Uint8Array(j.result.result)));
      var look = LOOK[v.verdict] || LOOK.Unknown;
      var html = '<p class="verdict ' + look[0] + '">' + look[1] + (v.token_id ? ' <span class="small">licence token #' + esc(v.token_id) + "</span>" : "") + "</p><p>" + look[2] + "</p>";
      if (v.licence) {
        var l = v.licence, rc = v.receipt;
        if (SYNTHETIC[l.creator]) html += '<p class="small"><b>Synthetic demo creator:</b> ' + esc(SYNTHETIC[l.creator]) + " is an AI-generated face, not a real person.</p>";
        if (l.creator === l.brand) html += '<p class="small"><b>Self-licence (demo):</b> the creator and the brand are the same account.</p>';
        html += "<dl><dt>Creator</dt><dd>" + esc(l.creator) + "</dd><dt>Brand</dt><dd>" + esc(l.brand) + "</dd><dt>Use</dt><dd>" + esc(l.use) + "</dd>" +
          "<dt>Licence</dt><dd>#" + esc(l.id) + ", " + esc(l.status) + ", " + l.renders_used + "/" + l.render_cap + " renders, until " + day(l.expires_at_ms) + "</dd>";
        if (rc) html += "<dt>Paid</dt><dd>" + near(rc.amount) + " (" + esc(rc.status) + ", " + day(rc.decided_at_ms) + ")</dd><dt>Confirmed by</dt><dd>" + (rc.status === "Approved" ? "the creator, who approved this exact file" : "the creator decides (no AI confirms identity)") + "</dd>";
        html += "</dl>";
      }
      html += '<p class="small">sha256 <code>' + sha + "</code></p>";
      out.innerHTML = html;
    } catch (e) {
      out.innerHTML = '<p class="bad">The contract couldn\'t be read: ' + esc(e.message) + "</p>";
    }
  }

  $("file").addEventListener("change", async function (e) {
    var f = e.target.files && e.target.files[0];
    if (!f) return;
    var h = hex(await crypto.subtle.digest("SHA-256", await f.arrayBuffer()));
    $("sha").value = h;
    verify(h);
  });
  $("form").addEventListener("submit", function (e) {
    e.preventDefault();
    verify($("sha").value.trim().toLowerCase().replace(/^0x/, ""));
  });
  var pre = (q.get("sha256") || "").toLowerCase();
  if (pre) { $("sha").value = pre; verify(pre); }
})();
