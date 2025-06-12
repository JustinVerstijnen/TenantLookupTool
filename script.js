function handleKeyPress(event) {
  if (event.key === 'Enter') {
    lookupFromCustomDomain();
  }
}

async function lookupFromCustomDomain() {
  const input = document.getElementById("input").value.trim();
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = "Even zoeken...";

  if (!input.includes(".")) {
    resultDiv.innerHTML = "Voer een geldig domein in.";
    return;
  }

  const configUrl = `https://login.microsoftonline.com/${input}/v2.0/.well-known/openid-configuration`;

  try {
    const res = await fetch(configUrl);
    if (!res.ok) throw new Error("Tenant niet gevonden.");
    const data = await res.json();

    const issuer = data.issuer;
    const tenantId = issuer.split("/")[3];
    const tenantName = data.authorization_endpoint.split("/")[3];

    let location = "Onbekend";
    if (issuer.includes("login.microsoftonline.com")) {
      location = "Global (Worldwide)";
    } else if (issuer.includes("login.microsoftonline.us")) {
      location = "US Government (GCC High)"; 
    } else if (issuer.includes("login.chinacloudapi.cn")) {
      location = "China (21Vianet)";
    } else if (issuer.includes("login.microsoftonline.de")) {
      location = "Germany (Microsoft Cloud Deutschland)";
    }

    resultDiv.innerHTML = `<h3>Tenant Informatie:</h3>
      <table>
        <tr><th>Custom Domein</th><td>${input}</td></tr>
        <tr><th>Tenant ID</th><td>${tenantId}</td></tr>
        <tr><th>Tenant Naam (mogelijk)</th><td>${tenantName}</td></tr>
        <tr><th>Locatie</th><td>${location}</td></tr>
        <tr><th>Issuer</th><td>${issuer}</td></tr>
      </table>`;
  } catch (err) {
    resultDiv.innerHTML = `Fout: ${err.message}`;
  }
}
