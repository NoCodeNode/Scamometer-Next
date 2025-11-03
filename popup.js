// Built by Arnab Mandal — contact: hello@arnabmandal.com

let currentAnalysisData = null;

// Toast notification function
function showToast(message, isError = false) {
  const existing = document.getElementById('toast-notification');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.id = 'toast-notification';
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.bottom = '16px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%) translateY(60px)';
  toast.style.padding = '10px 16px';
  toast.style.background = isError ? '#dc2626' : '#16a34a';
  toast.style.color = 'white';
  toast.style.borderRadius = '8px';
  toast.style.fontSize = '13px';
  toast.style.fontWeight = '600';
  toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
  toast.style.zIndex = '10000';
  toast.style.transition = 'transform 0.3s ease';
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(0)';
  }, 10);
  
  // Animate out and remove
  setTimeout(() => {
    toast.style.transform = 'translateX(-50%) translateY(60px)';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// Get the active tab
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// Calculate and rotate gauge needle, update label
function setGauge(score) {
  const pct = Math.max(0, Math.min(100, Math.round(score || 0)));
  const angle = 180 * (pct / 100); // 0..180 degrees span
  const needle = document.getElementById('hand');
  needle.style.transition = 'transform 0.5s ease-in-out';
  needle.setAttribute('transform', `rotate(${angle - 90} 50 50)`);
  document.getElementById('scoreText').textContent = `${pct} / 100`;
  const pill = document.getElementById('riskpill');
  const label = pct >= 75 ? 'High risk' : (pct >= 40 ? 'Medium risk' : 'Low risk');
  pill.className = `pill ${asClass(pct)}`;
  pill.textContent = label;
}
function asClass(pct) {
  if (pct >= 75) return 'high';
  if (pct >= 40) return 'med';
  return 'low';
}

// Escape HTML for tag content
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])
  );
}
function chips(list, cls) {
  return (list || []).map(v => `<span class="tag ${cls}">${escapeHtml(v)}</span>`).join('');
}

// Refresh UI with latest data (or run analysis if needed)
async function refresh() {
  const { apiKey } = await chrome.storage.local.get({ apiKey: null });
  const needKey = document.getElementById('needKey');
  const content = document.getElementById('content');
  const kickoff = document.getElementById('kickoff');
  const kickbar = document.getElementById('kickbar');
  const kickpct = document.getElementById('kickpct');

  // Show API key prompt if missing
  needKey.style.display = apiKey ? 'none' : 'block';
  if (!apiKey) {
    content.style.display = 'none';
    kickoff.style.display = 'none';
    return;
  }

  const tab = await getActiveTab();
  let data = await chrome.runtime.sendMessage({ type: 'GET_ANALYSIS_FOR_URL', url: tab.url });

  if (!data) {
    // No cached result: show animated progress bar
    kickoff.style.display = 'block';
    content.style.display = 'none';
    let pct = 5;
    const timer = setInterval(() => {
      pct = Math.min(98, pct + 2);
      kickbar.style.width = pct + '%';
      kickpct.textContent = pct + '%';
    }, 180);
    // Run analysis
    await chrome.runtime.sendMessage({ type: 'RUN_ANALYSIS', tabId: tab.id, url: tab.url });
    clearInterval(timer);
    // Complete to 100%
    kickbar.style.width = '100%'; kickpct.textContent = '100%';
    data = await chrome.runtime.sendMessage({ type: 'GET_ANALYSIS_FOR_URL', url: tab.url });
    if (!data) {
      // Still no data: instruct user to wait
      needKey.style.display = 'none';
      kickoff.innerHTML = '<div class="muted">Analysis queued. Please reopen after it completes.</div>';
      return;
    }
  }

  // Display results
  kickoff.style.display = 'none';
  content.style.display = 'flex';
  
  // Store current data for other functions
  currentAnalysisData = data;

  document.getElementById('verdict').textContent = data.ai?.verdict || '—';
  document.getElementById('reason').textContent = data.ai?.reason || '—';
  setGauge(data.ai?.scamometer ?? 0);

  const pos = Array.isArray(data.ai?.positives) ? data.ai.positives : [];
  const neg = Array.isArray(data.ai?.negatives) ? data.ai.negatives : [];
  document.getElementById('positives').innerHTML = chips(pos, 'pos');
  document.getElementById('negatives').innerHTML = chips(neg, 'neg');

  const raw = {
    fullUrl: data.raw?.fullUrl,
    pastedContent: data.raw?.pastedContent,
    technicalReport: data.raw?.technicalReport
  };
  document.getElementById('raw').textContent = JSON.stringify(raw, null, 2);

  const when = data.when ? new Date(data.when) : null;
  document.getElementById('timestamp').textContent = when
    ? `Analyzed: ${when.toLocaleString()}`
    : '—';

  // Button handlers
  document.getElementById('reanalyze').onclick = async () => {
    await chrome.runtime.sendMessage({ type: 'RUN_ANALYSIS', tabId: tab.id, url: tab.url });
    window.close();
  };
  document.getElementById('openOptions').onclick = () => chrome.runtime.openOptionsPage();
  document.getElementById('openOptions2').onclick = () => chrome.runtime.openOptionsPage();
  
  setupEnhancedHandlers(tab);
}

// Initial load
refresh();

// Enhanced UI handlers
function setupEnhancedHandlers(tab) {
  // History button
  document.getElementById('historyBtn').onclick = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('history.html') });
  };
  
  // Whitelist/Blacklist button - opens options page to list management
  document.getElementById('whitelistBtn').onclick = async () => {
    chrome.runtime.openOptionsPage();
  };
  
  // Share button
  document.getElementById('shareBtn').onclick = () => {
    if (!currentAnalysisData) return;
    const report = generateShareableReport(currentAnalysisData);
    navigator.clipboard.writeText(report).then(() => {
      showToast('✓ Report copied to clipboard!');
    }).catch(() => {
      showToast('✗ Failed to copy', true);
    });
  };
  
  // Copy report button
  document.getElementById('copyReportBtn').onclick = () => {
    if (!currentAnalysisData) return;
    const report = generateShareableReport(currentAnalysisData);
    navigator.clipboard.writeText(report).then(() => {
      const btn = document.getElementById('copyReportBtn');
      const original = btn.textContent;
      btn.textContent = '✓ Copied!';
      setTimeout(() => btn.textContent = original, 2000);
    }).catch(() => {
      showToast('✗ Failed to copy', true);
    });
  };
  
  // Export PDF (actually exports as text)
  document.getElementById('exportPdfBtn').onclick = () => {
    if (!currentAnalysisData) return;
    const report = generateShareableReport(currentAnalysisData);
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const hostname = new URL(currentAnalysisData.url).hostname;
    a.download = `scamometer-report-${hostname}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  
  // Collapsible technical details
  const rawToggle = document.getElementById('rawToggle');
  const rawContent = document.getElementById('rawContent');
  const chevron = rawToggle.querySelector('.chevron');
  
  rawToggle.onclick = () => {
    rawContent.classList.toggle('open');
    chevron.classList.toggle('open');
  };
}

function generateShareableReport(data) {
  let url = data.url;
  try {
    // Validate URL can be parsed
    new URL(url);
  } catch (e) {
    url = 'Invalid URL';
  }
  
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
https://github.com/NoCodeNode/X
`;
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Alt+R to reanalyze
  if (e.altKey && e.key === 'r') {
    e.preventDefault();
    document.getElementById('reanalyze')?.click();
  }
  // Alt+H for history
  if (e.altKey && e.key === 'h') {
    e.preventDefault();
    document.getElementById('historyBtn')?.click();
  }
  // Alt+O for options
  if (e.altKey && e.key === 'o') {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  }
  // Alt+C to copy
  if (e.altKey && e.key === 'c') {
    e.preventDefault();
    document.getElementById('copyReportBtn')?.click();
  }
});

// When background signals completion, refresh UI
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'analysis_complete') {
    refresh();
  }
});
