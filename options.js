// Built by Arnab Mandal — contact: hello@arnabmandal.com
const MODEL_DEFAULT = 'gemini-2.5-flash';

async function load() {
  const { apiKey, modelName, whitelist = [], blacklist = [] } = await chrome.storage.local.get({ 
    apiKey: '', 
    modelName: MODEL_DEFAULT,
    whitelist: [],
    blacklist: []
  });
  document.getElementById('apiKey').value = apiKey || '';
  document.getElementById('model').value = modelName || MODEL_DEFAULT;
  
  renderLists(whitelist, blacklist);
  updateStats();
}

function renderLists(whitelist, blacklist) {
  const whitelistEl = document.getElementById('whitelistItems');
  const blacklistEl = document.getElementById('blacklistItems');
  
  whitelistEl.innerHTML = whitelist.map(domain => `
    <div class="list-item">
      <span class="list-item-text">${escapeHtml(domain)}</span>
      <button onclick="removeFromWhitelist('${escapeHtml(domain)}')">Remove</button>
    </div>
  `).join('') || '<div class="muted" style="margin-top:8px;">No whitelisted sites</div>';
  
  blacklistEl.innerHTML = blacklist.map(domain => `
    <div class="list-item">
      <span class="list-item-text">${escapeHtml(domain)}</span>
      <button onclick="removeFromBlacklist('${escapeHtml(domain)}')">Remove</button>
    </div>
  `).join('') || '<div class="muted" style="margin-top:8px;">No blacklisted sites</div>';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function updateStats() {
  const data = await chrome.storage.local.get(null);
  const whitelist = data.whitelist || [];
  const blacklist = data.blacklist || [];
  
  let cacheCount = 0;
  let totalSize = 0;
  
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('analysis::')) cacheCount++;
    totalSize += JSON.stringify(value).length;
  }
  
  document.getElementById('cacheCount').textContent = cacheCount;
  document.getElementById('whitelistCount').textContent = whitelist.length;
  document.getElementById('blacklistCount').textContent = blacklist.length;
  document.getElementById('storageUsed').textContent = formatBytes(totalSize);
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Save settings
document.getElementById('save').addEventListener('click', async () => {
  const apiKey = document.getElementById('apiKey').value.trim();
  const modelName = document.getElementById('model').value;
  await chrome.storage.local.set({ apiKey, modelName });
  const s = document.getElementById('status');
  s.textContent = '✓ Saved successfully'; 
  s.style.color = '#16a34a';
  setTimeout(() => { s.textContent = ''; }, 2000);
});

// Show inline message near input
function showMessage(inputId, message, isError = false) {
  const input = document.getElementById(inputId);
  const existing = input.parentNode.querySelector('.inline-message');
  if (existing) existing.remove();
  
  const msg = document.createElement('div');
  msg.className = 'inline-message';
  msg.textContent = message;
  msg.style.marginTop = '4px';
  msg.style.fontSize = '12px';
  msg.style.color = isError ? 'var(--red)' : 'var(--green)';
  input.parentNode.appendChild(msg);
  
  setTimeout(() => msg.remove(), 3000);
}

// Validate domain format
function isValidDomain(domain) {
  // Basic domain validation
  const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
  return domainRegex.test(domain);
}

// Whitelist management
document.getElementById('addWhitelist').addEventListener('click', async () => {
  const input = document.getElementById('whitelistInput');
  const domain = input.value.trim().toLowerCase();
  if (!domain) return;
  
  if (!isValidDomain(domain)) {
    showMessage('whitelistInput', 'Please enter a valid domain (e.g., example.com)', true);
    return;
  }
  
  const { whitelist = [] } = await chrome.storage.local.get({ whitelist: [] });
  if (whitelist.includes(domain)) {
    showMessage('whitelistInput', 'Domain already in whitelist', true);
    return;
  }
  
  whitelist.push(domain);
  await chrome.storage.local.set({ whitelist });
  input.value = '';
  load();
});

window.removeFromWhitelist = async function(domain) {
  const { whitelist = [] } = await chrome.storage.local.get({ whitelist: [] });
  const updated = whitelist.filter(d => d !== domain);
  await chrome.storage.local.set({ whitelist: updated });
  load();
};

// Blacklist management
document.getElementById('addBlacklist').addEventListener('click', async () => {
  const input = document.getElementById('blacklistInput');
  const domain = input.value.trim().toLowerCase();
  if (!domain) return;
  
  if (!isValidDomain(domain)) {
    showMessage('blacklistInput', 'Please enter a valid domain (e.g., example.com)', true);
    return;
  }
  
  const { blacklist = [] } = await chrome.storage.local.get({ blacklist: [] });
  if (blacklist.includes(domain)) {
    showMessage('blacklistInput', 'Domain already in blacklist', true);
    return;
  }
  
  blacklist.push(domain);
  await chrome.storage.local.set({ blacklist });
  input.value = '';
  load();
});

window.removeFromBlacklist = async function(domain) {
  const { blacklist = [] } = await chrome.storage.local.get({ blacklist: [] });
  const updated = blacklist.filter(d => d !== domain);
  await chrome.storage.local.set({ blacklist: updated });
  load();
};

// Clear cache
document.getElementById('clearCache').addEventListener('click', async () => {
  if (!confirm('Clear all cached scan results? This will not affect whitelists or blacklists.')) return;
  
  const data = await chrome.storage.local.get(null);
  const keysToRemove = [];
  
  for (const key of Object.keys(data)) {
    if (key.startsWith('analysis::')) keysToRemove.push(key);
  }
  
  await chrome.storage.local.remove(keysToRemove);
  alert(`Cleared ${keysToRemove.length} cached analyses`);
  updateStats();
});

// Clear all data
document.getElementById('clearAll').addEventListener('click', async () => {
  if (!confirm('⚠️ WARNING: This will delete ALL data including API key, whitelist, blacklist, and cache. Are you absolutely sure?')) return;
  
  await chrome.storage.local.clear();
  alert('All data cleared');
  location.reload();
});

function $(id) { return document.getElementById(id); }
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active:true, currentWindow:true });
  return tab;
}
function isIp(host) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || /^[0-9a-f:]+$/i.test(host);
}
function rdapCandidates(host){
  if (!host) return [];
  const labels = host.split('.').filter(Boolean);
  if (labels.length <= 1) return [host];
  const cands = [];
  for (let i = Math.max(0, labels.length - 2); i >= 0; i--) {
    const cand = labels.slice(i).join('.');
    if (!cands.includes(cand)) cands.push(cand);
  }
  return cands;
}
async function fetchWithTimeout(url, options = {}, timeout = 12000) {
  const controller = new AbortController(); 
  const id = setTimeout(() => controller.abort(), timeout);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(id); }
}

// DNS Test button
document.getElementById('testDns').addEventListener('click', async () => {
  $('outDns').textContent = 'Fetching…';
  try {
    const tab = await getActiveTab();
    const u = new URL(tab.url);
    const hostname = u.hostname;
    const g = await fetchWithTimeout(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`);
    const out = {};
    out.google = g.ok ? await g.json() : { error: 'HTTP '+g.status };
    const cf = await fetchWithTimeout(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`, {
      headers: { 'accept': 'application/dns-json' }
    });
    out.cloudflare = cf.ok ? await cf.json() : { error: 'HTTP '+cf.status };
    const sample = {
      statusGoogle: out.google.Status, statusCloudflare: out.cloudflare.Status,
      samples: {
        g: (out.google.Answer||[]).slice(0,2),
        cf: (out.cloudflare.Answer||[]).slice(0,2)
      }
    };
    $('outDns').textContent = JSON.stringify(sample, null, 2);
  } catch (e) {
    $('outDns').textContent = 'Error: ' + e.message;
  }
});

// RDAP Test button
document.getElementById('testRdap').addEventListener('click', async () => {
  $('outRdap').textContent = 'Fetching…';
  try {
    const tab = await getActiveTab();
    const u = new URL(tab.url);
    const host = u.hostname;
    if (isIp(host)) {
      const r = await fetchWithTimeout(`https://rdap.org/ip/${encodeURIComponent(host)}`);
      const txt = r.ok ? await r.json() : { error: 'HTTP '+r.status };
      $('outRdap').textContent = JSON.stringify({
        endpoint: 'ip', target: host, keys: Object.keys(txt||{}).slice(0,10)
      }, null, 2);
      return;
    }
    const cands = rdapCandidates(host);
    const out = { tried: cands };
    for (const cand of cands) {
      const r = await fetchWithTimeout(`https://rdap.org/domain/${encodeURIComponent(cand)}`);
      if (r.ok) {
        const j = await r.json();
        out.success = { endpoint:'domain', target:cand, hasLdh: !!j.ldhName, sampleEvents: (j.events||[]).slice(0,2) };
        $('outRdap').textContent = JSON.stringify(out, null, 2);
        return;
      } else {
        out[`HTTP_${cand}`] = r.status;
      }
    }
    $('outRdap').textContent = JSON.stringify(out, null, 2);
  } catch (e) {
    $('outRdap').textContent = 'Error: ' + e.message;
  }
});

// Enter key support for inputs
document.getElementById('whitelistInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('addWhitelist').click();
  }
});

document.getElementById('blacklistInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    document.getElementById('addBlacklist').click();
  }
});

load();

