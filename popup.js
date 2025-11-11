// Built by Arnab Mandal — contact: hello@arnabmandal.com

let currentAnalysisData = null;
let extensionEnabled = true;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Load extension state
  const { enabled = true } = await chrome.storage.local.get({ enabled: true });
  extensionEnabled = enabled;
  updateToggleUI();
  
  if (extensionEnabled) {
    await refresh();
  } else {
    showDisabledState();
  }
  
  setupEventListeners();
});

function setupEventListeners() {
  // Toggle switch
  document.getElementById('toggleSwitch').onclick = toggleExtension;
  
  // Buttons
  document.getElementById('openOptions')?.addEventListener('click', () => chrome.runtime.openOptionsPage());
  document.getElementById('reanalyze')?.addEventListener('click', reanalyze);
  document.getElementById('copyReport')?.addEventListener('click', copyReport);
  document.getElementById('batchBtn')?.addEventListener('click', openBatchPage);
  document.getElementById('optionsBtn')?.addEventListener('click', () => chrome.runtime.openOptionsPage());
}

async function toggleExtension() {
  extensionEnabled = !extensionEnabled;
  await chrome.storage.local.set({ enabled: extensionEnabled });
  updateToggleUI();
  
  if (extensionEnabled) {
    showToast('Extension enabled');
    await refresh();
  } else {
    showToast('Extension disabled');
    showDisabledState();
  }
}

function updateToggleUI() {
  const toggle = document.getElementById('toggleSwitch');
  const status = document.getElementById('toggleStatus');
  
  if (extensionEnabled) {
    toggle.classList.add('active');
    status.textContent = 'ON';
    status.classList.add('active');
  } else {
    toggle.classList.remove('active');
    status.textContent = 'OFF';
    status.classList.remove('active');
  }
}

function showDisabledState() {
  document.getElementById('needKey').style.display = 'none';
  document.getElementById('loading').style.display = 'none';
  document.getElementById('results').style.display = 'none';
  document.getElementById('disabledState').style.display = 'block';
}

async function refresh() {
  const { apiKey } = await chrome.storage.local.get({ apiKey: null });
  
  // Check API key
  if (!apiKey) {
    document.getElementById('needKey').style.display = 'block';
    document.getElementById('loading').style.display = 'none';
    document.getElementById('results').style.display = 'none';
    document.getElementById('disabledState').style.display = 'none';
    return;
  }
  
  // Get active tab
  const tab = await getActiveTab();
  if (!tab || !tab.url || tab.url.startsWith('chrome://')) {
    showToast('Cannot analyze Chrome internal pages', true);
    return;
  }
  
  // Get analysis
  let data = await chrome.runtime.sendMessage({ type: 'GET_ANALYSIS_FOR_URL', url: tab.url });
  
  if (!data) {
    // Show loading
    document.getElementById('needKey').style.display = 'none';
    document.getElementById('loading').style.display = 'block';
    document.getElementById('results').style.display = 'none';
    document.getElementById('disabledState').style.display = 'none';
    
    // Run analysis
    await chrome.runtime.sendMessage({ type: 'RUN_ANALYSIS', tabId: tab.id, url: tab.url });
    
    // Wait and get result
    await new Promise(resolve => setTimeout(resolve, 2000));
    data = await chrome.runtime.sendMessage({ type: 'GET_ANALYSIS_FOR_URL', url: tab.url });
  }
  
  if (!data) {
    showToast('Analysis in progress, please wait...', true);
    return;
  }
  
  // Show results
  displayResults(data);
}

function displayResults(data) {
  document.getElementById('needKey').style.display = 'none';
  document.getElementById('loading').style.display = 'none';
  document.getElementById('results').style.display = 'flex';
  document.getElementById('disabledState').style.display = 'none';
  
  currentAnalysisData = data;
  
  const score = data.ai?.scamometer ?? 0;
  const verdict = data.ai?.verdict || '—';
  const reason = data.ai?.reason || '—';
  const positives = Array.isArray(data.ai?.positives) ? data.ai.positives : [];
  const negatives = Array.isArray(data.ai?.negatives) ? data.ai.negatives : [];
  
  // Update gauge
  setGauge(score);
  
  // Update verdict
  document.getElementById('verdict').textContent = verdict;
  document.getElementById('reason').textContent = reason;
  
  // Update pills
  const pill = document.getElementById('riskpill');
  const label = score >= 75 ? 'High risk' : (score >= 40 ? 'Medium risk' : 'Low risk');
  const pillClass = score >= 75 ? 'high' : (score >= 40 ? 'med' : 'low');
  pill.className = `pill ${pillClass}`;
  pill.textContent = label;
  
  // Update tags
  const posContainer = document.getElementById('positives');
  const negContainer = document.getElementById('negatives');
  
  if (positives.length > 0) {
    posContainer.innerHTML = positives.map(p => `<span class="tag pos">✓ ${escapeHtml(p)}</span>`).join('');
  } else {
    posContainer.innerHTML = '<span class="muted">None found</span>';
  }
  
  if (negatives.length > 0) {
    negContainer.innerHTML = negatives.map(n => `<span class="tag neg">✗ ${escapeHtml(n)}</span>`).join('');
  } else {
    negContainer.innerHTML = '<span class="muted">None found</span>';
  }
}

function setGauge(score) {
  const pct = Math.max(0, Math.min(100, Math.round(score || 0)));
  const angle = 180 * (pct / 100);
  const needle = document.getElementById('needle');
  needle.style.transition = 'transform 0.5s ease-in-out';
  needle.setAttribute('transform', `rotate(${angle - 90} 50 50)`);
  document.getElementById('scoreText').textContent = `${pct}/100`;
}

async function reanalyze() {
  const tab = await getActiveTab();
  if (!tab) return;
  
  showToast('Re-analyzing...');
  await chrome.runtime.sendMessage({ type: 'RUN_ANALYSIS', tabId: tab.id, url: tab.url });
  
  setTimeout(() => refresh(), 2000);
}

function copyReport() {
  if (!currentAnalysisData) return;
  
  const report = generateReport(currentAnalysisData);
  navigator.clipboard.writeText(report).then(() => {
    showToast('✓ Report copied to clipboard');
  }).catch(() => {
    showToast('✗ Failed to copy', true);
  });
}

function openBatchPage() {
  chrome.tabs.create({ url: chrome.runtime.getURL('batch.html') });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function generateReport(data) {
  const url = data.url || 'Unknown';
  const score = data.ai?.scamometer || 0;
  const verdict = data.ai?.verdict || 'Unknown';
  const reason = data.ai?.reason || 'No reason provided';
  const positives = data.ai?.positives || [];
  const negatives = data.ai?.negatives || [];
  const timestamp = data.when ? new Date(data.when).toLocaleString() : 'Unknown';
  
  return `🧪 SCAMOMETER SECURITY REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
URL: ${url}
Risk Score: ${Math.round(score)}/100
Verdict: ${verdict}
Analyzed: ${timestamp}

REASON:
${reason}

POSITIVE INDICATORS (${positives.length}):
${positives.map(p => `✓ ${p}`).join('\n') || 'None'}

RED FLAGS (${negatives.length}):
${negatives.map(n => `✗ ${n}`).join('\n') || 'None'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated by Scamometer - AI Phishing Detector
https://github.com/NoCodeNode/Scamometer-Next
`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])
  );
}

function showToast(message, isError = false) {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    padding: 10px 16px;
    background: ${isError ? '#dc2626' : '#16a34a'};
    color: white;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
  `;
  
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// Listen for messages
chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === 'analysis_complete') {
    refresh();
  }
});
