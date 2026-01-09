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
  // Simple client-side check; server-side validation isn't applicable here.
  // Allows subdomains and IDN/punycode.
  return /^[a-z0-9-._~%]+(\.[a-z0-9-._~%]+)+$/i.test(value);
}

async function lookupFromCustomDomain() {
  const inputEl = document.getElementById("input");
  const value = (inputEl?.value || "").trim();

  hideResults();
  showSpinner(true);

  if (!value || !isLikelyDomain(value)) {
    showSpinner(false);
    showResults(`
      <div class="infobox" style="background:#ffecec;border-color:#f2b8b8;">
        Please fill in a valid domain (for example: <b>example.com</b>).
      </div>
    `);
    return;
  }

  const configUrl = `https://login.microsoftonline.com/${encodeURIComponent(value)}/v2.0/.well-known/openid-configuration`;

  try {
    const res = await fetch(configUrl, { cache: "no-store" });
    if (!res.ok) {
      throw new Error("Tenant not found.");
    }

    const data = await res.json();

    const issuer = data?.issuer || "";
    const tenantId = issuer.split("/")[3] || "";
    // Not always present, but we keep the extraction (matches original behavior).
    const tenantName = (data?.authorization_endpoint || "").split("/")[3] || "";

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
            <tr><td><b>Custom domain</b></td><td>${escapeHtml(value)}</td></tr>
            <tr><td><b>Tenant ID</b></td><td>${escapeHtml(tenantId)}</td></tr>
            ${tenantName ? `<tr><td><b>Tenant name</b></td><td>${escapeHtml(tenantName)}</td></tr>` : ""}
            <tr><td><b>Location</b></td><td>${escapeHtml(location)}</td></tr>
            <tr><td><b>Issuer</b></td><td>${escapeHtml(issuer)}</td></tr>
          </tbody>
        </table>
      </div>
    `);

  } catch (err) {
    showSpinner(false);
    const msg = err && err.message ? err.message : "Unexpected error.";
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
