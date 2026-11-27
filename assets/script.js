// Set footer year automatically
document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
});

function handleKeyPress(event) {
  if (event.key === "Enter") {
    lookupFromCustomDomain();
  }
}

function showSpinner(show) {
  const spinner = document.getElementById("spinner");
  if (!spinner) return;
  spinner.style.display = show ? "flex" : "none";
}

function showResults(html) {
  const results = document.getElementById("resultsSection");
  if (!results) return;
  results.style.display = "block";
  // Replace content first, then allow CSS animation on #resultsSection
  results.innerHTML = html;
}

function hideResults() {
  const results = document.getElementById("resultsSection");
  if (!results) return;
  results.style.display = "none";
  results.innerHTML = "";
}

function isLikelyDomain(value) {
  return value.length <= 253 && value.split(".").length > 1 &&
    value.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
}

function isTenantId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

let lookupSequence = 0;

async function fetchJson(url) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30000) });
  let data;
  try { data = await response.json(); }
  catch { throw new Error("The lookup service is not available. Please contact the site administrator."); }
  if (!response.ok) {
    throw new Error(typeof data.error === "string" && !url.startsWith("https://login.microsoftonline.com/")
      ? data.error : response.status === 400 || response.status === 404
        ? "Tenant not found." : "The lookup service is temporarily unavailable. Please try again later.");
  }
  return data;
}

async function lookupFromCustomDomain() {
  const sequence = ++lookupSequence;
  const inputEl = document.getElementById("input");
  const value = (inputEl?.value || "").trim();
  const reverseLookup = isTenantId(value);

  hideResults();
  showSpinner(true);

  if (!value || (!reverseLookup && !isLikelyDomain(value))) {
    showSpinner(false);
    showResults(`
      <div class="infobox" style="background:#ffecec;border-color:#f2b8b8;">
        Please fill in a valid domain (for example: <b>example.com</b>) or Tenant ID (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).
      </div>
    `);
    return;
  }

  const configUrl = `https://login.microsoftonline.com/${encodeURIComponent(value)}/v2.0/.well-known/openid-configuration`;

  try {
    let tenantInfo = null;
    let metadataUnavailable = false;
    let data;
    if (reverseLookup) {
      const base = (window.TENANT_LOOKUP_API_BASE || "").replace(/\/$/, "");
      tenantInfo = await fetchJson(`${base}/api/tenant?id=${encodeURIComponent(value)}`);
      if (typeof tenantInfo.tenantId !== "string" || tenantInfo.tenantId.toLowerCase() !== value.toLowerCase()) {
        throw new Error("The lookup service returned an unexpected tenant.");
      }
      try { data = await fetchJson(configUrl); }
      catch { data = {}; metadataUnavailable = true; }
    } else {
      data = await fetchJson(configUrl);
    }
    if (sequence !== lookupSequence) return;

    const issuer = data?.issuer || "";
    const tenantId = tenantInfo?.tenantId || issuer.split("/")[3] || "";
    if (!isTenantId(tenantId)) throw new Error("The lookup service returned an invalid Tenant ID.");
    const tenantName = tenantInfo?.displayName || tenantInfo?.federationBrandName || "";

    let location = "Unknown";
    if (issuer.includes("login.microsoftonline.com")) {
      location = "Global (Worldwide)";
    } else if (issuer.includes("login.microsoftonline.us")) {
      location = "US Government (GCC High)";
    } else if (issuer.includes("login.chinacloudapi.cn")) {
      location = "China (21Vianet)";
    } else if (issuer.includes("login.microsoftonline.de")) {
      location = "Germany (Microsoft Cloud Deutschland)";
    }

    showSpinner(false);

    showResults(`
      <div class="infobox">
        Tenant found.
        ${metadataUnavailable ? "Location and issuer are temporarily unavailable." : ""}
      </div>

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style="width: 220px;">Field</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><b>${reverseLookup ? "Default domain" : "Custom domain"}</b></td><td>${escapeHtml(reverseLookup ? tenantInfo.defaultDomainName || "Not available" : value)}</td></tr>
            <tr><td><b>Tenant ID</b></td><td>${escapeHtml(tenantId)}</td></tr>
            ${reverseLookup ? `<tr><td><b>Organization name</b></td><td>${escapeHtml(tenantName || "Not available")}</td></tr>` : ""}
            <tr><td><b>Location</b></td><td>${escapeHtml(location)}</td></tr>
            <tr><td><b>Issuer</b></td><td>${escapeHtml(issuer || "Not available")}</td></tr>
          </tbody>
        </table>
      </div>
    `);

  } catch (err) {
    if (sequence !== lookupSequence) return;
    showSpinner(false);
    const msg = err?.name === "TimeoutError" ? "The lookup timed out. Please try again." :
      err instanceof TypeError ? "Cannot reach the lookup service. Check your connection or contact the site administrator." :
      err && err.message ? err.message : "Unexpected error.";
    showResults(`
      <div class="infobox" style="background:#ffecec;border-color:#f2b8b8;">
        Error: ${escapeHtml(msg)}
      </div>
    `);
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
