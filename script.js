const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let busy = false;
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();
  document.getElementById('input').addEventListener('input', () => {
    document.getElementById('mxDomainGroup').hidden = !GUID.test(document.getElementById('input').value.trim());
  });
});
function handleKeyPress(event) {
  if (event.key === 'Enter') { event.preventDefault(); lookupFromCustomDomain(); }
}
function normalizeDomain(value) {
  const raw = value.trim().replace(/\.$/, '');
  if (!raw || /[\s/:@?#%\\]/.test(raw)) throw new Error('Enter a valid domain, for example example.com.');
  let domain;
  try { domain = new URL(`https://${raw}`).hostname.toLowerCase(); }
  catch { throw new Error('Enter a valid domain.'); }
  if (domain.length > 253 || !domain.includes('.') || /^\d+(\.\d+){3}$/.test(domain) ||
      !domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error('Enter a valid domain, for example example.com.');
  }
  return domain;
}
async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) throw new Error(`Service returned HTTP ${response.status}.`);
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Request timed out. Please try again.');
    throw error;
  } finally { clearTimeout(timer); }
}
async function getTenant(value) {
  const data = await fetchJson(`https://login.microsoftonline.com/${encodeURIComponent(value)}/v2.0/.well-known/openid-configuration`);
  let issuer;
  try { issuer = new URL(data.issuer); } catch { throw new Error('Tenant not found or invalid Microsoft response.'); }
  const tenantId = issuer.pathname.split('/')[1];
  if (!GUID.test(tenantId)) throw new Error('Microsoft did not return a valid Tenant ID.');
  const clouds = {'login.microsoftonline.com': 'Global (Worldwide)', 'login.microsoftonline.us': 'US Government', 'login.chinacloudapi.cn': 'China (21Vianet)', 'login.microsoftonline.de': 'Germany'};
  return { tenantId: tenantId.toLowerCase(), issuer: data.issuer, cloud: clouds[issuer.hostname] || issuer.hostname, region: data.tenant_region_scope || 'Not provided' };
}
async function getMx(domain) {
  const data = await fetchJson(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`);
  if (data.Status === 3) return { records: [], message: 'Domain does not exist (NXDOMAIN).' };
  if (data.Status !== 0 || data.TC) throw new Error(`DNS lookup failed (status ${data.Status}). Please try again.`);
  const records = (data.Answer || []).filter(record => record.type === 15).map(record => {
    const match = /^(\d+)\s+(\S+)$/.exec(record.data);
    if (!match) throw new Error('Invalid MX response from DNS service.');
    return { priority: Number(match[1]), host: match[2] === '.' ? '.' : match[2].replace(/\.$/, ''), ttl: record.TTL };
  }).sort((a, b) => a.priority - b.priority || a.host.localeCompare(b.host));
  return { records, message: records.length ? '' : 'No MX records published for this domain.' };
}
function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
function table(caption, headers, rows) {
  return `<div class="table-wrapper"><table><caption>${escapeHtml(caption)}</caption><thead><tr>${headers.map(h => `<th scope="col">${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderResult(value, tenant, tenantError, domain, mx, mxError) {
  const rows = [['Search', value]];
  if (tenant) rows.push(['Tenant ID', tenant.tenantId], ['Cloud', tenant.cloud], ['Tenant region', tenant.region], ['Issuer', tenant.issuer]);
  else rows.push(['Tenant lookup', tenantError]);
  rows.push(['MX domain', domain || 'Not specified']);
  let html = table('Tenant information', ['Field', 'Value'], rows);
  if (mx?.records.length) {
    html += table('MX records', ['Domain', 'Priority', 'Mail server', 'TTL (seconds)'], mx.records.map(r => [domain, r.priority, r.host === '.' ? '. (Null MX: domain does not accept email)' : r.host, r.ttl]));
  } else {
    html += table('MX records', ['Status', 'Details'], [[mxError ? 'Unavailable' : 'Information', mxError || mx?.message || 'Enter a domain in the optional MX field to retrieve its mail records. A Tenant ID has no DNS records.']]);
  }
  document.getElementById('resultsSection').innerHTML = html;
}
async function lookupFromCustomDomain() {
  if (busy) return;
  const results = document.getElementById('resultsSection');
  results.style.display = 'block'; results.innerHTML = '';
  const raw = document.getElementById('input').value.trim();
  const byId = GUID.test(raw);
  let value, domain;
  try {
    value = byId ? raw.toLowerCase() : normalizeDomain(raw);
    const optional = document.getElementById('mxDomain').value.trim();
    domain = byId ? (optional ? normalizeDomain(optional) : '') : value;
  } catch (error) {
    results.innerHTML = `<div class="infobox error" role="alert">${escapeHtml(error.message)}</div>`; return;
  }
  busy = true;
  document.getElementById('lookupBtn').disabled = true;
  document.getElementById('spinner').style.display = 'flex';
  results.setAttribute('aria-busy', 'true');
  try {
    let tenant, tenantError = '', mx, mxError = '';
    // Preserve DNS results even when the domain is not registered with Microsoft.
    if (!byId) {
      const responses = await Promise.allSettled([getTenant(value), getMx(domain)]);
      if (responses[0].status === 'fulfilled') tenant = responses[0].value;
      else tenantError = `Tenant unavailable: ${responses[0].reason.message}`;
      if (responses[1].status === 'fulfilled') mx = responses[1].value;
      else mxError = responses[1].reason.message;
    } else {
      try { tenant = await getTenant(value); }
      catch (error) { tenantError = `Tenant unavailable: ${error.message}`; }
      if (domain) {
        try {
          if (!tenant) throw new Error('Cannot verify the MX domain because the tenant lookup failed.');
          const domainTenant = await getTenant(domain);
          if (domainTenant.tenantId !== tenant.tenantId) throw new Error('This domain belongs to a different tenant. Enter a domain belonging to the searched Tenant ID.');
          mx = await getMx(domain);
        } catch (error) { mxError = error.message; }
      }
    }
    renderResult(value, tenant, tenantError, domain, mx, mxError);
  } finally {
    busy = false;
    document.getElementById('lookupBtn').disabled = false;
    document.getElementById('spinner').style.display = 'none';
    results.setAttribute('aria-busy', 'false');
  }
}
