import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
const id = "6babcaad-604b-40ac-a9d7-9fd97c0b779f";
const info = { tenantId: id, defaultDomainName: "contoso.com", displayName: "Contoso <Ltd>" };
const metadata = { issuer: `https://login.microsoftonline.com/${id}/v2.0` };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

const script = await readFile(new URL("../assets/script.js", import.meta.url), "utf8");
function frontend(value, fetchImpl) {
  const elements = { input: { value }, spinner: { style: {} }, resultsSection: { style: {}, innerHTML: "" } };
  const context = vm.createContext({ document: { addEventListener() {}, getElementById: key => elements[key] },
    window: {}, fetch: fetchImpl, AbortSignal, TypeError });
  vm.runInContext(script, context);
  return { context, elements, lookup: () => context.lookupFromCustomDomain(), result: () => elements.resultsSection.innerHTML };
}

test("domain lookup retains Tenant ID and location and does not call backend", async () => {
  const ui = frontend("contoso.com", async url => {
    assert.ok(url.startsWith("https://login.microsoftonline.com/contoso.com/"));
    return json(metadata);
  });
  await ui.lookup();
  assert.match(ui.result(), /contoso.com/);
  assert.ok(ui.result().includes(id));
  assert.match(ui.result(), /Global \(Worldwide\)/);
  assert.equal(ui.elements.spinner.style.display, "none");
});

test("reverse lookup shows real name and domain, safely escaping names", async () => {
  const ui = frontend(` ${id.toUpperCase()} `, async url => json(url.startsWith("/api/") ? info : metadata));
  await ui.lookup();
  assert.match(ui.result(), /Default domain/);
  assert.match(ui.result(), /contoso.com/);
  assert.match(ui.result(), /Contoso &lt;Ltd&gt;/);
  assert.ok(!ui.result().includes("Contoso <Ltd>"));
});

test("reverse result remains usable when optional OpenID metadata fails", async () => {
  const ui = frontend(id, async url => {
    if (url.startsWith("/api/")) return json(info);
    throw new TypeError("offline");
  });
  await ui.lookup();
  assert.match(ui.result(), /contoso.com/);
  assert.match(ui.result(), /temporarily unavailable/);
});

test("empty, malformed GUID and malicious inputs do not trigger requests", async () => {
  for (const value of ["", "hello", id.slice(0, -1), "<script>.com", "foo..com", "https://contoso.com"]) {
    const ui = frontend(value, () => assert.fail("Unexpected request"));
    await ui.lookup();
    assert.match(ui.result(), /Please fill in/);
    assert.equal(ui.elements.spinner.style.display, "none");
  }
});

test("missing backend gives an actionable error", async () => {
  const ui = frontend(id, async () => new Response("<html>404</html>", { status: 404 }));
  await ui.lookup();
  assert.match(ui.result(), /site administrator/);
});

test("older requests cannot overwrite the newest result", async () => {
  let finish;
  const ui = frontend("old.example", () => new Promise(resolve => { finish = resolve; }));
  const old = ui.lookup();
  ui.elements.input.value = "invalid";
  await ui.lookup();
  finish(json(metadata));
  await old;
  assert.match(ui.result(), /Please fill in/);
  assert.ok(!ui.result().includes("Tenant found"));
});
