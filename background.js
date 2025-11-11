// Built by Arnab Mandal — contact: hello@arnabmandal.com

// background.js — updated v2.0 (best-in-class features)

// Import webhook functionality
import { sendWebhookNotification, registerWebhookListener } from './webhook.js';

// Show welcome page on first install
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }
  // Register webhook listener
  registerWebhookListener();
});
const SCAM_THRESHOLD = 70;
const DNS_TYPES = ['A','AAAA','CNAME','MX','NS','TXT','SOA','SRV','DNSKEY','DS','CAA'];
const REQUEST_TIMEOUT_MS = 12000;
const MODEL_DEFAULT = 'gemini-2.5-flash';
const DNS_CACHE_TTL = 24*60*60*1000;
const RDAP_CACHE_TTL = 24*60*60*1000;

// In-memory caches for DNS/RDAP results
const dnsCache = {};
const rdapCache = {};

// Generate storage key per URL
function storageKey(url) {
  const u = new URL(url);
  return `analysis::${u.origin}${u.pathname}`;
}

// Listen for page loads to auto-run analysis
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;
  
  // Check if extension is enabled
  const { enabled = true } = await chrome.storage.local.get({ enabled: true });
  if (!enabled) {
    await setBadge({ text: '', color: '#6b7280' });
    return;
  }
  
  try {
    await runAnalysis(tabId, tab.url, { reason: 'tab_complete' });
  } catch (e) {
    console.warn('Analysis failed:', e);
    await setBadge({ text: 'ERR', color: '#6b7280' });
    progress(tabId, 100, 'Failed');
  }
});

// Batch processing state
let batchProcessingActive = false;
let batchTabId = null;

// Listen for messages from popup or content
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === 'GET_ANALYSIS_FOR_URL') {
      const key = storageKey(msg.url);
      const data = await chrome.storage.local.get(key);
      sendResponse(data[key] || null);
    }
    if (msg?.type === 'RUN_ANALYSIS') {
      try {
        await runAnalysis(msg.tabId, msg.url, { reason: 'on_demand' });
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    }
    if (msg?.type === 'START_BATCH') {
      try {
        startBatchProcessing(msg.urls);
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    }
    if (msg?.type === 'PAUSE_BATCH') {
      try {
        await pauseBatchProcessing();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    }
    if (msg?.type === 'RESUME_BATCH') {
      try {
        resumeBatchProcessing();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    }
    if (msg?.type === 'CAPTURE_SCREENSHOT') {
      try {
        const screenshot = await captureScreenshotWithOverlay(msg.tabId, msg.url);
        sendResponse({ ok: true, screenshot });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    }
    if (msg?.type === 'GET_BATCH_STATUS') {
      const data = await chrome.storage.local.get('batch::status');
      sendResponse(data['batch::status'] || null);
    }
    if (msg?.type === 'GET_BATCH_RESULTS') {
      const data = await chrome.storage.local.get('batch::queue');
      const queue = data['batch::queue'];
      if (queue) {
        const results = {
          total: queue.urls.length,
          completed: queue.urls.filter(u => u.status === 'completed').length,
          failed: queue.urls.filter(u => u.status === 'failed').length,
          pending: queue.urls.filter(u => u.status === 'pending').length,
          results: queue.urls
        };
        sendResponse(results);
      } else {
        sendResponse(null);
      }
    }
  })();
  return true;  // keep channel open for async
});

// Update the browser action badge text and color
async function setBadge({ text, color }) {
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color });
}

// Badge shows a number (0-99) with color based on score
async function setBadgeForScore(score) {
  if (typeof score !== 'number' || isNaN(score)) 
    return setBadge({ text: '', color: '#6b7280' });
  const pct = Math.round(Math.min(99, Math.max(0, score)));
  const color = score >= 75 ? '#dc2626' : (score >= 40 ? '#eab308' : '#16a34a');
  return setBadge({ text: String(pct), color });
}

// Send progress updates to content script
function progress(tabId, percent, label) {
  chrome.tabs.sendMessage(tabId, { type: 'PROGRESS', percent, label }).catch(()=>{});
}

// Check if a host string is an IP address
function isIp(host) {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || /^[0-9a-f:]+$/i.test(host);
}

// Generate candidate domains for RDAP (handles subdomains)
function rdapCandidates(host) {
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

// Main analysis flow
async function runAnalysis(tabId, url, { reason } = {}) {
  const { apiKey, modelName, whitelist = [], blacklist = [] } = await chrome.storage.local.get({ 
    apiKey: null, 
    modelName: MODEL_DEFAULT,
    whitelist: [],
    blacklist: []
  });
  
  if (!apiKey) {
    await setBadge({ text: 'KEY', color: '#6b7280' });
    progress(tabId, 100, 'API key missing');
    return;
  }
  
  let hostname;
  try { hostname = new URL(url).hostname; } catch { hostname = ''; }
  
  // Check whitelist/blacklist
  if (whitelist.includes(hostname)) {
    await setBadgeForScore(0);
    const key = storageKey(url);
    await chrome.storage.local.set({ 
      [key]: { 
        when: Date.now(), 
        url, 
        ai: {
          verdict: '✓ Whitelisted',
          scamometer: 0,
          reason: 'This domain is in your whitelist and is trusted.',
          positives: ['User whitelisted domain'],
          negatives: []
        },
        raw: { fullUrl: url },
        whitelisted: true
      } 
    });
    progress(tabId, 100, 'Whitelisted');
    return;
  }
  
  if (blacklist.includes(hostname)) {
    await setBadgeForScore(100);
    const key = storageKey(url);
    await chrome.storage.local.set({ 
      [key]: { 
        when: Date.now(), 
        url, 
        ai: {
          verdict: '⚠️ Blacklisted',
          scamometer: 100,
          reason: 'This domain is in your blacklist and should be avoided.',
          positives: [],
          negatives: ['User blacklisted domain']
        },
        raw: { fullUrl: url },
        blacklisted: true
      } 
    });
    await chrome.tabs.sendMessage(tabId, { type: 'OVERLAY', score: 100 }).catch(()=>{});
    progress(tabId, 100, 'Blacklisted');
    return;
  }

  // Show hourglass on badge during analysis
  await setBadge({ text: '⌛', color: '#06b6d4' });
  progress(tabId, 5, 'Scraping content…');

  const scraped = await chrome.tabs.sendMessage(tabId, { type: 'SCRAPE_REQUEST' }).catch(() => null);
  const contentText = scraped?.text || '';

  progress(tabId, 20, 'Fetching DNS/RDAP…');

  // DNS lookups with caching
  const dnsResults = {};
  for (let type of DNS_TYPES) {
    try {
      const data = await fetchDnsResilientCached(hostname, type);
      dnsResults[type] = normalizeDnsResult({ status: 'fulfilled', value: data }, type);
    } catch (err) {
      dnsResults[type] = normalizeDnsResult({ status: 'rejected', reason: err }, type);
    }
  }

  // RDAP lookup with caching
  let rdap;
  try {
    rdap = await fetchRdapSmartCached(hostname);
  } catch (err) {
    rdap = { ok: false, data: null, error: err.message };
  }

  progress(tabId, 55, 'Preparing report…');
  const technicalReport = { domain: hostname, dnsRawResults: dnsResults, rdapResolved: rdap };

  const payload = {
    fullUrl: url,
    pastedContent: truncateForCost(contentText, 15000),
    technicalReport
  };

  progress(tabId, 70, 'Calling Gemini…');
  const ai = await callGemini(apiKey, modelName || MODEL_DEFAULT, payload);

  // Store analysis in chrome.storage.local
  const key = storageKey(url);
  await chrome.storage.local.set({ [key]: { when: Date.now(), url, ai, raw: payload, dnsResults, rdap } });

  // Update badge with final score
  await setBadgeForScore(ai.scamometer);

  progress(tabId, 95, 'Applying overlay…');
  await chrome.tabs.sendMessage(tabId, { type: 'OVERLAY', score: ai.scamometer }).catch(()=>{});
  progress(tabId, 100, 'Done');

  // Notify popup (if open)
  try {
    chrome.runtime.sendMessage({ type: 'analysis_complete', tabId, score: ai.scamometer });
  } catch {}
}

// Helper: fetch with timeout
async function fetchWithTimeout(url, options = {}, timeout = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try { 
    return await fetch(url, { ...options, signal: controller.signal });
  } finally { 
    clearTimeout(id);
  }
}

// DNS query using Google and Cloudflare, with caching
async function fetchDnsResilientCached(domain, type) {
  const cacheKey = `${domain}:${type}`;
  const now = Date.now();
  if (dnsCache[cacheKey] && (now - dnsCache[cacheKey].when) < DNS_CACHE_TTL) {
    return dnsCache[cacheKey].value;
  }
  let result = null;
  try {
    const g = await fetchWithTimeout(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`);
    if (g.ok) result = await g.json();
    else throw new Error(`DNS google status ${g.status}`);
  } catch {
    const cf = await fetchWithTimeout(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`, {
      headers: { 'accept': 'application/dns-json' }
    });
    if (cf.ok) result = await cf.json();
    else throw new Error(`DNS cloudflare status ${cf.status}`);
  }
  dnsCache[cacheKey] = { value: result, when: now };
  return result;
}

// RDAP query (IP or domain) with caching
async function fetchRdapSmartCached(host) {
  const now = Date.now();
  if (rdapCache[host] && (now - rdapCache[host].when) < RDAP_CACHE_TTL) {
    return rdapCache[host].result;
  }
  let result = null;
  try {
    if (isIp(host)) {
      const r = await fetchWithTimeout(`https://rdap.org/ip/${encodeURIComponent(host)}`);
      if (!r.ok) throw new Error(`RDAP IP status ${r.status}`);
      const j = await r.json();
      result = { ok: true, data: j, target: host, endpoint: 'ip' };
    } else {
      const cands = rdapCandidates(host);
      let lastErr = null;
      for (const cand of cands) {
        try {
          const r = await fetchWithTimeout(`https://rdap.org/domain/${encodeURIComponent(cand)}`);
          if (!r.ok) { lastErr = new Error(`RDAP status ${r.status} for ${cand}`); continue; }
          const j = await r.json();
          if (j && (j.ldhName || j.handle || Array.isArray(j.events))) {
            result = { ok: true, data: j, target: cand, endpoint: 'domain' };
            break;
          }
          lastErr = new Error(`RDAP malformed for ${cand}`);
        } catch (e) {
          lastErr = e;
        }
      }
      if (!result) throw lastErr || new Error('RDAP fetch failed');
    }
  } catch (e) {
    result = { ok: false, data: null, error: e.message, target: host };
  }
  rdapCache[host] = { result, when: now };
  return result;
}

// Normalize DNS/RDAP outputs for reporting
function normalizeDnsResult(settled, type) {
  if (settled.status === 'rejected') {
    return { ok: false, records: [], error: settled.reason?.message || 'fetch failed', type };
  }
  const data = settled.value;
  if (!data || data.Status !== 0) {
    return { ok: false, records: [], error: `DNS Status: ${data?.Status}`, type };
  }
  const records = data.Answer || data.Authority || [];
  return { ok: true, records, error: null, type };
}
function normalizeRdapResult(settled) {
  if (settled.status === 'rejected') {
    return { ok: false, data: null, error: settled.reason?.message || 'fetch failed' };
  }
  return { ok: true, data: settled.value, error: null };
}

// Trim text to control payload size
function truncateForCost(str, maxLen) {
  if (!str) return "";
  return str.length <= maxLen ? str : (str.slice(0, maxLen) + "\\n[…truncated…]");
}

// Gemini API call with schema validation
const AI_SYSTEM_INSTRUCTION = `You are an expert cybersecurity analyst specializing in phishing and scam detection. 

Analyze the provided website data comprehensively:
1. Examine the URL structure for suspicious patterns (typosquatting, unusual TLDs, excessive subdomains)
2. Review DNS and RDAP data for domain age, registration info, and infrastructure anomalies
3. Analyze page content for common scam indicators: urgency tactics, too-good-to-be-true offers, poor grammar, suspicious forms, cryptocurrency schemes, fake login pages, impersonation attempts
4. Check for legitimate business indicators: proper SSL, established domain age, professional content, contact information, privacy policies
5. Consider the technical infrastructure quality and legitimacy

Return a risk score from 0-100 where:
- 0-30: Low risk (legitimate site with good indicators)
- 30-70: Medium risk (some concerns but not clearly malicious)
- 70-100: High risk (strong scam/phishing indicators)

Provide clear, actionable reasoning. List specific positive indicators and red flags found.`;
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING" },
    scamometer: { type: "NUMBER" },
    reason: { type: "STRING" },
    positives: { type: "ARRAY", items: { type: "STRING" } },
    negatives: { type: "ARRAY", items: { type: "STRING" } }
  },
  required: ["verdict","scamometer","reason","positives","negatives"]
};
async function callGemini(apiKey, model, analysis) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [{ role: "user", parts: [{ text: `Analyze this report: ${JSON.stringify(analysis)}` }] }],
    systemInstruction: { role: "system", parts: [{ text: AI_SYSTEM_INSTRUCTION }] },
    generationConfig: { responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA }
  };
  const res = await fetchWithTimeout(endpoint, { 
    method: "POST", headers: { "content-type": "application/json" }, 
    body: JSON.stringify(body) 
  }, 20000);
  
  // Check for API key errors
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) {
      // API key error - pause batch if active
      if (batchProcessingActive) {
        await pauseBatchProcessing();
        // Notify popup to show API key dialog
        try {
          chrome.runtime.sendMessage({ type: 'API_KEY_ERROR', status: res.status });
        } catch {}
      }
      throw new Error(`Gemini API authentication error: ${res.status}`);
    }
    throw new Error(`Gemini API error: ${res.status} ${t}`);
  }
  
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  try {
    return JSON.parse(text);
  } catch (e) {
    const m = text && text.match(/\\{[\\s\\S]*\\}$/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Invalid JSON from Gemini');
  }
}

// ============================================================================
// BATCH PROCESSING FUNCTIONS
// ============================================================================

/**
 * Start batch processing of URLs
 * @param {Array<string>} urls - URLs to process
 */
async function startBatchProcessing(urls) {
  if (batchProcessingActive) {
    throw new Error('Batch processing already active');
  }
  
  // Initialize queue
  const queue = {
    urls: urls.map((url, index) => ({
      url,
      index,
      status: 'pending',
      result: null,
      error: null,
      screenshot: null
    })),
    currentIndex: 0,
    status: 'processing',
    createdAt: Date.now(),
    completedAt: null
  };
  
  await chrome.storage.local.set({ 'batch::queue': queue });
  await updateBatchStatus('initialized', 0, urls.length);
  
  batchProcessingActive = true;
  processNextBatchUrl();
}

/**
 * Process next URL in batch queue
 */
async function processNextBatchUrl() {
  if (!batchProcessingActive) return;
  
  const data = await chrome.storage.local.get('batch::queue');
  const queue = data['batch::queue'];
  
  if (!queue) {
    batchProcessingActive = false;
    return;
  }
  
  // Find next pending URL
  const nextUrl = queue.urls.find(u => u.status === 'pending');
  
  if (!nextUrl) {
    // All done
    queue.status = 'completed';
    queue.completedAt = Date.now();
    await chrome.storage.local.set({ 'batch::queue': queue });
    await updateBatchStatus('completed', queue.urls.length, queue.urls.length);
    batchProcessingActive = false;
    
    // Send webhook notification
    try {
      const results = {
        total: queue.urls.length,
        completed: queue.urls.filter(u => u.status === 'completed').length,
        failed: queue.urls.filter(u => u.status === 'failed').length,
        pending: queue.urls.filter(u => u.status === 'pending').length,
        results: queue.urls
      };
      await sendWebhookNotification(results);
    } catch (e) {
      console.error('Webhook notification failed:', e);
    }
    
    // Notify popup
    try {
      chrome.runtime.sendMessage({ type: 'BATCH_COMPLETE' });
    } catch {}
    return;
  }
  
  // Mark as processing
  nextUrl.status = 'processing';
  await chrome.storage.local.set({ 'batch::queue': queue });
  await updateBatchStatus('processing', nextUrl.index, queue.urls.length);
  
  try {
    // Open URL in background tab
    const tab = await chrome.tabs.create({ url: nextUrl.url, active: false });
    batchTabId = tab.id;
    
    // Wait for page to load
    await waitForTabLoad(tab.id);
    
    // Additional wait for content script to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Run analysis
    await runAnalysis(tab.id, nextUrl.url, { reason: 'batch' });
    
    // Capture screenshot
    const screenshot = await captureScreenshotWithOverlay(tab.id, nextUrl.url);
    
    // Get result
    const key = storageKey(nextUrl.url);
    const resultData = await chrome.storage.local.get(key);
    const result = resultData[key];
    
    // Update queue
    nextUrl.status = 'completed';
    nextUrl.result = result;
    nextUrl.screenshot = screenshot;
    await chrome.storage.local.set({ 'batch::queue': queue });
    
    // Close tab
    await chrome.tabs.remove(tab.id);
    batchTabId = null;
    
    // Process next after a short delay
    setTimeout(() => processNextBatchUrl(), 1000);
    
  } catch (error) {
    console.error('Batch processing error:', error);
    nextUrl.status = 'failed';
    nextUrl.error = error.message;
    await chrome.storage.local.set({ 'batch::queue': queue });
    
    // Close tab if open
    if (batchTabId) {
      try {
        await chrome.tabs.remove(batchTabId);
      } catch {}
      batchTabId = null;
    }
    
    // Continue with next URL
    setTimeout(() => processNextBatchUrl(), 1000);
  }
}

/**
 * Pause batch processing
 */
async function pauseBatchProcessing() {
  batchProcessingActive = false;
  const data = await chrome.storage.local.get('batch::queue');
  const queue = data['batch::queue'];
  if (queue) {
    queue.status = 'paused';
    await chrome.storage.local.set({ 'batch::queue': queue });
    const completed = queue.urls.filter(u => u.status === 'completed' || u.status === 'failed').length;
    await updateBatchStatus('paused', completed, queue.urls.length);
  }
  
  // Close batch tab if open
  if (batchTabId) {
    try {
      await chrome.tabs.remove(batchTabId);
    } catch {}
    batchTabId = null;
  }
}

/**
 * Resume batch processing
 */
async function resumeBatchProcessing() {
  const data = await chrome.storage.local.get('batch::queue');
  const queue = data['batch::queue'];
  if (queue && queue.status === 'paused') {
    queue.status = 'processing';
    await chrome.storage.local.set({ 'batch::queue': queue });
    batchProcessingActive = true;
    processNextBatchUrl();
  }
}

/**
 * Wait for tab to finish loading
 * @param {number} tabId - Tab ID
 * @returns {Promise<void>}
 */
function waitForTabLoad(tabId) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      listener && chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error('Tab load timeout'));
    }, 30000);
    
    const listener = (updatedTabId, changeInfo, tab) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        // Wait a bit more for dynamic content
        setTimeout(() => resolve(), 2000);
      }
    };
    
    chrome.tabs.onUpdated.addListener(listener);
  });
}

/**
 * Capture screenshot with timestamp overlay
 * @param {number} tabId - Tab ID
 * @param {string} url - Page URL
 * @returns {Promise<Object>} - Screenshot info
 */
async function captureScreenshotWithOverlay(tabId, url) {
  try {
    // Make sure tab is visible for screenshot
    await chrome.tabs.update(tabId, { active: true });
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Inject overlay with URL and timestamp
    const timestamp = formatTimestamp(new Date());
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (url, timestamp) => {
        const overlay = document.createElement('div');
        overlay.id = 'scamometer-screenshot-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.background = 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)';
        overlay.style.color = 'white';
        overlay.style.padding = '12px 16px';
        overlay.style.zIndex = '2147483647';
        overlay.style.fontFamily = 'monospace';
        overlay.style.fontSize = '13px';
        overlay.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        overlay.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${url}</div>
            <div style="margin-left:16px; white-space:nowrap;">${timestamp}</div>
          </div>
        `;
        document.body.appendChild(overlay);
      },
      args: [url, timestamp]
    });
    
    // Wait for overlay to render
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // Get the tab's window to ensure it's focused
    const tab = await chrome.tabs.get(tabId);
    await chrome.windows.update(tab.windowId, { focused: true });
    
    // Capture screenshot
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    
    // Remove overlay
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const overlay = document.getElementById('scamometer-screenshot-overlay');
        if (overlay) overlay.remove();
      }
    }).catch(() => {}); // Ignore errors if tab is closed
    
    // Calculate SHA-256 hash
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
      view[i] = binary.charCodeAt(i);
    }
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Download screenshot
    await chrome.downloads.download({
      url: dataUrl,
      filename: `scamometer-${hash}.png`,
      saveAs: false
    });
    
    return {
      hash,
      timestamp,
      filename: `scamometer-${hash}.png`
    };
  } catch (error) {
    console.error('Screenshot capture failed:', error);
    // Return null if screenshot fails, but don't fail the whole analysis
    return null;
  }
}

/**
 * Format timestamp as YYYY-MM-DD HH:MM:SS
 * @param {Date} date - Date object
 * @returns {string} - Formatted timestamp
 */
function formatTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Update batch status
 * @param {string} status - Status message
 * @param {number} current - Current index
 * @param {number} total - Total URLs
 */
async function updateBatchStatus(status, current, total) {
  await chrome.storage.local.set({
    'batch::status': {
      status,
      current,
      total,
      percentage: total > 0 ? Math.round((current / total) * 100) : 0,
      timestamp: Date.now()
    }
  });
}

