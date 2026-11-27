const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A handler instance reuses the application token across warm invocations.
export function createTenantHandler({ env = process.env, fetchImpl = fetch } = {}) {
  let token;
  let expiresAt = 0;
  let pendingToken;
  async function accessToken() {
    if (token && Date.now() < expiresAt) return token;
    if (pendingToken) return pendingToken;
    pendingToken = (async () => {
      const response = await fetchImpl(`https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/oauth2/v2.0/token`, {
        method: "POST",
        body: new URLSearchParams({ client_id: env.ENTRA_CLIENT_ID, client_secret: env.ENTRA_CLIENT_SECRET,
          scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error("Authentication failed");
      const data = await response.json();
      if (!data.access_token) throw new Error("Missing access token");
      token = data.access_token;
      expiresAt = Date.now() + Math.max(0, (Number(data.expires_in) || 300) - 60) * 1000;
      return token;
    })();
    try { return await pendingToken; } finally { pendingToken = undefined; }
  }


  return async function tenantLookup(request) {
    const reply = (status, jsonBody) => ({ status, jsonBody,
      headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    try {
      if (request.method !== "GET") return reply(405, { error: "Method not allowed." });
      const url = new URL(request.url);
        const id = url.searchParams.get("id") || "";
        if (!guid.test(id)) return reply(400, { error: "Please enter a valid Tenant ID." });
        if (!guid.test(env.ENTRA_TENANT_ID || "") || !guid.test(env.ENTRA_CLIENT_ID || "") || !env.ENTRA_CLIENT_SECRET) {
          return reply(503, { error: "Tenant ID lookup has not been configured by the site administrator yet." });
        }
        const bearer = await accessToken();
        const response = await fetchImpl(`https://graph.microsoft.com/v1.0/tenantRelationships/findTenantInformationByTenantId(tenantId='${id}')`, {
          headers: { Authorization: `Bearer ${bearer}` }, signal: AbortSignal.timeout(12000),
        });
        if (response.status === 401) { token = undefined; expiresAt = 0; }
        if (response.status === 404) return reply(404, { error: "Tenant not found." });
        if (response.status === 429) return reply(429, { error: "Too many lookups. Please try again later." });
        if (!response.ok) return reply(502, { error: "Microsoft could not complete the lookup. Please try again later or contact the site administrator." });
        const data = await response.json();
        if (typeof data.tenantId !== "string" || data.tenantId.toLowerCase() !== id.toLowerCase()) throw new Error("Unexpected tenant response");
        const string = value => typeof value === "string" ? value : "";
        return reply(200, { tenantId: data.tenantId, defaultDomainName: string(data.defaultDomainName),
          displayName: string(data.displayName), federationBrandName: string(data.federationBrandName) });

    } catch {
      return reply(502, { error: "The lookup service is temporarily unavailable. Please try again later." });
    }
  };
}
