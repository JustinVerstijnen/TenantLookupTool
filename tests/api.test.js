import { test } from "node:test";
import assert from "node:assert/strict";
import { createTenantHandler } from "../api/src/tenant-handler.js";

const id = "6babcaad-604b-40ac-a9d7-9fd97c0b779f";
const env = { ENTRA_TENANT_ID: id, ENTRA_CLIENT_ID: id, ENTRA_CLIENT_SECRET: "test-secret" };
const info = { tenantId: id, defaultDomainName: "contoso.com", displayName: "Contoso" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const request = (value = id, method = "GET") => ({ method, url: `https://example.com/api/tenant?id=${encodeURIComponent(value)}` });

test("function returns domain and organization and reuses server-side token", async () => {
  const calls = [];
  const handler = createTenantHandler({ env, fetchImpl: async (url, options) => {
    calls.push(url);
    if (url.endsWith("/token")) {
      assert.equal(options.body.get("client_secret"), env.ENTRA_CLIENT_SECRET);
      assert.equal(options.body.get("scope"), "https://graph.microsoft.com/.default");
      return json({ access_token: "test-token", expires_in: 3600 });
    }
    assert.equal(options.headers.Authorization, "Bearer test-token");
    assert.ok(url.includes(`tenantId='${id}'`));
    return json({ ...info, extra: "not public" });
  }});
  const result = await handler(request());
  assert.equal(result.status, 200);
  assert.deepEqual(result.jsonBody, { ...info, federationBrandName: "" });
  assert.equal(result.headers["Cache-Control"], "no-store");
  await handler(request());
  assert.equal(calls.length, 3);
});

test("validation and missing configuration never call Microsoft", async () => {
  const handler = createTenantHandler({ env: {}, fetchImpl: () => assert.fail("Unexpected request") });
  for (const value of ["", "invalid", "' OR 1=1", id.slice(0, -1)]) {
    assert.equal((await handler(request(value))).status, 400);
  }
  assert.equal((await handler(request())).status, 503);
  assert.equal((await handler(request(id, "POST"))).status, 405);
});

for (const status of [400, 401, 403, 404, 429, 500]) {
  test(`Graph ${status} is handled without leaking upstream details`, async () => {
    const handler = createTenantHandler({ env, fetchImpl: async url => url.endsWith("/token")
      ? json({ access_token: "secret" }) : json({ error: "upstream-sensitive-detail" }, status) });
    const result = await handler(request());
    assert.equal(result.status, [404, 429].includes(status) ? status : 502);
    assert.ok(!JSON.stringify(result).includes("upstream-sensitive-detail"));
  });
}

test("expired/rejected token is refreshed on the next request", async () => {
  let tokens = 0;
  let queries = 0;
  const handler = createTenantHandler({ env, fetchImpl: async url => {
    if (url.endsWith("/token")) { tokens++; return json({ access_token: "token", expires_in: 3600 }); }
    return ++queries === 1 ? json({}, 401) : json(info);
  }});
  assert.equal((await handler(request())).status, 502);
  assert.equal((await handler(request())).status, 200);
  assert.equal(tokens, 2);
});

test("simultaneous requests share token acquisition", async () => {
  let tokens = 0;
  const handler = createTenantHandler({ env, fetchImpl: async url => {
    if (url.endsWith("/token")) { tokens++; return json({ access_token: "token", expires_in: 3600 }); }
    return json(info);
  }});
  const results = await Promise.all([handler(request()), handler(request()), handler(request())]);
  assert.ok(results.every(result => result.status === 200));
  assert.equal(tokens, 1);
});

test("network and malformed Graph responses fail safely", async () => {
  for (const mode of ["network", "json", "mismatch", "token"]) {
    const handler = createTenantHandler({ env, fetchImpl: async url => {
      if (mode === "network") throw new Error("contains secret");
      if (url.endsWith("/token")) return json(mode === "token" ? {} : { access_token: "token" });
      if (mode === "json") return new Response("invalid JSON");
      return json({ ...info, tenantId: "wrong" });
    }});
    const result = await handler(request());
    assert.equal(result.status, 502);
    assert.ok(!JSON.stringify(result).includes("contains secret"));
  }
});
