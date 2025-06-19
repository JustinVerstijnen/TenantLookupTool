
function handleKeyPress(event) {
  if (event.key === 'Enter') {
    lookupFromCustomDomain();
  }
}

async function lookupFromCustomDomain() {
  const input = document.getElementById("input").value.trim();
  const resultDiv = document.getElementById("result");

  resultDiv.className = ''; // Reset animatie
  resultDiv.innerHTML = "Searching...";

  if (!input.includes(".")) {
    resultDiv.innerHTML = "Please fill in a valid domain.";
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

    resultDiv.innerHTML = `<h3>Tenant Information:</h3>
      <table>
        <tr><th>Custom domain</th><td>${input}</td></tr>
        <tr><th>Tenant ID</th><td>${tenantId}</td></tr>
        <tr><th>Location</th><td>${location}</td></tr>
        <tr><th>Issuer</th><td>${issuer}</td></tr>
      </table>`;

    setTimeout(() => {
      resultDiv.className = 'fade-in';
    }, 50);
  } catch (err) {
    resultDiv.className = '';
    resultDiv.innerHTML = `Fout: ${err.message}`;
  }
}
