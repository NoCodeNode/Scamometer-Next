// Batch Processing Page JavaScript
// Built by Arnab Mandal - hello@arnabmandal.com

let batchUrls = [];
let batchResults = [];
let pollInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkExistingBatch();
});

function setupEventListeners() {
  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('csvFile');
  
  // File upload
  uploadZone.onclick = () => fileInput.click();
  
  uploadZone.ondragover = (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  };
  
  uploadZone.ondragleave = () => {
    uploadZone.classList.remove('dragover');
  };
  
  uploadZone.ondrop = (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      handleFile(file);
    }
  };
  
  fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  };
  
  // Buttons
  document.getElementById('startBtn').onclick = startBatch;
  document.getElementById('clearBtn').onclick = clearUpload;
  document.getElementById('pauseBtn').onclick = pauseBatch;
  document.getElementById('resumeBtn').onclick = resumeBatch;
  document.getElementById('stopBtn').onclick = stopBatch;
  document.getElementById('exportHtmlBtn').onclick = exportHtmlReport;
  document.getElementById('exportJsonBtn').onclick = exportJsonReport;
  document.getElementById('newBatchBtn').onclick = newBatch;
  
  // API Key Modal
  document.getElementById('cancelApiKeyBtn').onclick = () => {
    document.getElementById('apiKeyModal').classList.remove('active');
  };
  document.getElementById('saveApiKeyBtn').onclick = saveNewApiKey;
  
  // Listen for messages from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'API_KEY_ERROR') {
      showApiKeyModal();
    } else if (msg.type === 'BATCH_COMPLETE') {
      handleBatchComplete();
    }
  });
}

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    batchUrls = parseCSV(content);
    
    if (batchUrls.length === 0) {
      showToast('No valid URLs found in CSV', true);
      return;
    }
    
    document.getElementById('fileInfo').style.display = 'block';
    document.getElementById('fileInfo').innerHTML = `
      ✅ Loaded <strong>${batchUrls.length}</strong> URLs from ${file.name}
    `;
    document.getElementById('startBtn').disabled = false;
    showToast(`Loaded ${batchUrls.length} URLs successfully`);
  };
  reader.readAsText(file);
}

function parseCSV(content) {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const urls = [];
  
  for (const line of lines) {
    let firstCol = line.split(',')[0].trim();
    if (firstCol.startsWith('"') && firstCol.endsWith('"')) {
      firstCol = firstCol.slice(1, -1);
    }
    
    try {
      const parsed = new URL(firstCol);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        urls.push(firstCol);
      }
    } catch (e) {
      // Skip invalid URLs
    }
  }
  
  return urls;
}

function clearUpload() {
  batchUrls = [];
  document.getElementById('csvFile').value = '';
  document.getElementById('fileInfo').style.display = 'none';
  document.getElementById('startBtn').disabled = true;
  showToast('Cleared');
}

async function startBatch() {
  if (batchUrls.length === 0) return;
  
  // Start batch processing
  await chrome.runtime.sendMessage({
    type: 'START_BATCH',
    urls: batchUrls
  });
  
  // Show progress section
  document.getElementById('uploadSection').style.display = 'none';
  document.getElementById('progressSection').classList.add('active');
  document.getElementById('resultsSection').style.display = 'none';
  
  // Start polling for updates
  startPolling();
  showToast('Batch processing started');
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  
  pollInterval = setInterval(async () => {
    const status = await chrome.runtime.sendMessage({ type: 'GET_BATCH_STATUS' });
    if (status) {
      updateProgress(status);
      
      if (status.status === 'completed') {
        clearInterval(pollInterval);
        pollInterval = null;
        await handleBatchComplete();
      }
    }
  }, 1000);
}

function updateProgress(status) {
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const progressStats = document.getElementById('progressStats');
  
  progressBar.style.width = status.percentage + '%';
  progressText.innerHTML = `<span class="spinner">⚡</span> Processing URL ${status.current + 1} of ${status.total}`;
  progressStats.textContent = `${status.current} / ${status.total} (${status.percentage}%)`;
  
  if (status.status === 'paused') {
    progressText.innerHTML = '⏸️ Paused';
    document.getElementById('pauseBtn').style.display = 'none';
    document.getElementById('resumeBtn').style.display = 'inline-block';
  }
}

async function pauseBatch() {
  await chrome.runtime.sendMessage({ type: 'PAUSE_BATCH' });
  document.getElementById('pauseBtn').style.display = 'none';
  document.getElementById('resumeBtn').style.display = 'inline-block';
  showToast('Batch paused');
}

async function resumeBatch() {
  await chrome.runtime.sendMessage({ type: 'RESUME_BATCH' });
  document.getElementById('pauseBtn').style.display = 'inline-block';
  document.getElementById('resumeBtn').style.display = 'none';
  startPolling();
  showToast('Batch resumed');
}

async function stopBatch() {
  if (confirm('Are you sure you want to stop the batch processing?')) {
    await chrome.runtime.sendMessage({ type: 'PAUSE_BATCH' });
    clearInterval(pollInterval);
    pollInterval = null;
    await handleBatchComplete();
    showToast('Batch stopped');
  }
}

async function handleBatchComplete() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  
  // Get results
  const results = await chrome.runtime.sendMessage({ type: 'GET_BATCH_RESULTS' });
  if (!results) return;
  
  batchResults = results.results || [];
  
  // Hide progress, show results
  document.getElementById('progressSection').classList.remove('active');
  document.getElementById('resultsSection').style.display = 'block';
  
  // Update stats
  const completed = batchResults.filter(r => r.status === 'completed' && r.result);
  const avgScore = completed.length > 0
    ? Math.round(completed.reduce((sum, r) => sum + (r.result.ai?.scamometer || 0), 0) / completed.length)
    : 0;
  
  document.getElementById('totalCount').textContent = results.total || 0;
  document.getElementById('successCount').textContent = results.completed || 0;
  document.getElementById('failedCount').textContent = results.failed || 0;
  document.getElementById('avgScore').textContent = avgScore;
  
  // Render table
  renderResultsTable();
  showToast('✅ Batch processing completed!');
}

function renderResultsTable() {
  const tbody = document.getElementById('resultsBody');
  
  if (batchResults.length === 0) {
    tbody.innerHTML = '';
    document.getElementById('emptyResults').style.display = 'block';
    return;
  }
  
  document.getElementById('emptyResults').style.display = 'none';
  
  tbody.innerHTML = batchResults.map((result, index) => {
    const score = result.result?.ai?.scamometer || 0;
    const scoreClass = score >= 75 ? 'high' : (score >= 40 ? 'medium' : 'low');
    const hostname = result.url ? new URL(result.url).hostname : 'Unknown';
    
    let statusBadge = '';
    if (result.status === 'completed') {
      statusBadge = `<span class="status-badge completed">✓ Completed</span>`;
    } else if (result.status === 'failed') {
      statusBadge = `<span class="status-badge failed">✗ Failed</span>`;
    } else {
      statusBadge = `<span class="status-badge processing">⏳ ${result.status}</span>`;
    }
    
    return `
      <tr>
        <td>${index + 1}</td>
        <td title="${escapeHtml(result.url)}">${escapeHtml(hostname)}</td>
        <td><span class="score-badge ${scoreClass}">${Math.round(score)}/100</span></td>
        <td>${statusBadge}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-small" onclick="viewResult(${index})">👁️ View</button>
            <button class="btn-small" onclick="downloadIndividualReport(${index})">💾 Download</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.viewResult = function(index) {
  const result = batchResults[index];
  if (!result || !result.result) {
    showToast('No result data available', true);
    return;
  }
  
  // Open in new tab with full details
  const detailHtml = generateDetailReport(result);
  const blob = new Blob([detailHtml], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
};

window.downloadIndividualReport = function(index) {
  const result = batchResults[index];
  if (!result) return;
  
  const html = generateDetailReport(result);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const hostname = result.url ? new URL(result.url).hostname : 'unknown';
  a.download = `scamometer-report-${hostname}-${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Individual report downloaded');
};

function exportHtmlReport() {
  const html = generateInteractiveReport();
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scamometer-batch-report-${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Interactive HTML report downloaded');
}

function exportJsonReport() {
  const json = JSON.stringify({
    generated: new Date().toISOString(),
    total: batchResults.length,
    completed: batchResults.filter(r => r.status === 'completed').length,
    failed: batchResults.filter(r => r.status === 'failed').length,
    results: batchResults
  }, null, 2);
  
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scamometer-batch-report-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('JSON report downloaded');
}

function generateInteractiveReport() {
  const completed = batchResults.filter(r => r.status === 'completed' && r.result);
  const failed = batchResults.filter(r => r.status === 'failed');
  const avgScore = completed.length > 0
    ? Math.round(completed.reduce((sum, r) => sum + (r.result.ai?.scamometer || 0), 0) / completed.length)
    : 0;
  
  const highRisk = completed.filter(r => r.result.ai?.scamometer >= 75).length;
  const mediumRisk = completed.filter(r => r.result.ai?.scamometer >= 40 && r.result.ai?.scamometer < 75).length;
  const lowRisk = completed.filter(r => r.result.ai?.scamometer < 40).length;
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Scamometer Batch Analysis Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 24px;
      min-height: 100vh;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 24px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }
    .header h1 {
      font-size: 36px;
      margin-bottom: 8px;
    }
    .header p {
      opacity: 0.9;
      font-size: 16px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      padding: 40px;
      background: #f8f9fa;
    }
    .stat-card {
      background: white;
      padding: 24px;
      border-radius: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      text-align: center;
    }
    .stat-value {
      font-size: 48px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .stat-value.total { color: #667eea; }
    .stat-value.success { color: #10b981; }
    .stat-value.failed { color: #ef4444; }
    .stat-value.avg { color: #f59e0b; }
    .stat-label {
      color: #6b7280;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .chart-container {
      padding: 40px;
    }
    .chart-title {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 24px;
      color: #1f2937;
    }
    .bar-chart {
      display: flex;
      align-items: flex-end;
      justify-content: space-around;
      height: 300px;
      background: #f8f9fa;
      border-radius: 16px;
      padding: 24px;
    }
    .bar {
      flex: 1;
      max-width: 150px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .bar-fill {
      width: 100%;
      background: linear-gradient(180deg, var(--color), var(--color-dark));
      border-radius: 8px 8px 0 0;
      position: relative;
      transition: height 0.3s ease;
    }
    .bar-label {
      font-weight: 600;
      color: #6b7280;
      font-size: 14px;
    }
    .bar-value {
      font-size: 24px;
      font-weight: 700;
    }
    .results-section {
      padding: 40px;
    }
    .result-card {
      background: #f8f9fa;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 16px;
      border-left: 4px solid var(--border-color);
    }
    .result-card.low { --border-color: #10b981; }
    .result-card.medium { --border-color: #f59e0b; }
    .result-card.high { --border-color: #ef4444; }
    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .result-url {
      font-weight: 600;
      color: #1f2937;
      font-size: 16px;
    }
    .result-score {
      font-size: 24px;
      font-weight: 700;
    }
    .result-score.low { color: #10b981; }
    .result-score.medium { color: #f59e0b; }
    .result-score.high { color: #ef4444; }
    .result-details {
      color: #6b7280;
      line-height: 1.6;
    }
    .footer {
      background: #1f2937;
      color: white;
      padding: 24px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🧪 Scamometer Batch Analysis Report</h1>
      <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="stats">
      <div class="stat-card">
        <div class="stat-value total">${batchResults.length}</div>
        <div class="stat-label">Total URLs</div>
      </div>
      <div class="stat-card">
        <div class="stat-value success">${completed.length}</div>
        <div class="stat-label">Successful</div>
      </div>
      <div class="stat-card">
        <div class="stat-value failed">${failed.length}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value avg">${avgScore}</div>
        <div class="stat-label">Avg Risk Score</div>
      </div>
    </div>
    
    <div class="chart-container">
      <div class="chart-title">Risk Distribution</div>
      <div class="bar-chart">
        <div class="bar">
          <div class="bar-value" style="color: #10b981;">${lowRisk}</div>
          <div class="bar-fill" style="--color: #10b981; --color-dark: #059669; height: ${lowRisk > 0 ? (lowRisk / Math.max(lowRisk, mediumRisk, highRisk) * 100) : 0}%;"></div>
          <div class="bar-label">Low Risk</div>
        </div>
        <div class="bar">
          <div class="bar-value" style="color: #f59e0b;">${mediumRisk}</div>
          <div class="bar-fill" style="--color: #f59e0b; --color-dark: #d97706; height: ${mediumRisk > 0 ? (mediumRisk / Math.max(lowRisk, mediumRisk, highRisk) * 100) : 0}%;"></div>
          <div class="bar-label">Medium Risk</div>
        </div>
        <div class="bar">
          <div class="bar-value" style="color: #ef4444;">${highRisk}</div>
          <div class="bar-fill" style="--color: #ef4444; --color-dark: #dc2626; height: ${highRisk > 0 ? (highRisk / Math.max(lowRisk, mediumRisk, highRisk) * 100) : 0}%;"></div>
          <div class="bar-label">High Risk</div>
        </div>
      </div>
    </div>
    
    <div class="results-section">
      <div class="chart-title">Detailed Results</div>
      ${batchResults.map(result => {
        const score = result.result?.ai?.scamometer || 0;
        const scoreClass = score >= 75 ? 'high' : (score >= 40 ? 'medium' : 'low');
        return `
          <div class="result-card ${scoreClass}">
            <div class="result-header">
              <div class="result-url">${escapeHtml(result.url)}</div>
              <div class="result-score ${scoreClass}">${Math.round(score)}/100</div>
            </div>
            <div class="result-details">
              <strong>Verdict:</strong> ${escapeHtml(result.result?.ai?.verdict || 'N/A')}<br>
              <strong>Reason:</strong> ${escapeHtml(result.result?.ai?.reason || 'N/A')}<br>
              ${result.status === 'failed' ? `<strong>Error:</strong> ${escapeHtml(result.error || 'Unknown error')}` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
    
    <div class="footer">
      <p>Generated by Scamometer - AI Phishing & Scam Detector</p>
      <p>https://github.com/NoCodeNode/Scamometer-Next</p>
    </div>
  </div>
</body>
</html>`;
}

function generateDetailReport(result) {
  const score = result.result?.ai?.scamometer || 0;
  const scoreClass = score >= 75 ? 'high' : (score >= 40 ? 'medium' : 'low');
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Scamometer Report - ${escapeHtml(result.url)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0b1020;
      color: #e2e8f0;
      padding: 24px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 40px;
      border-radius: 16px;
      margin-bottom: 24px;
      text-align: center;
    }
    .score-display {
      font-size: 72px;
      font-weight: 700;
      margin: 24px 0;
    }
    .score-display.low { color: #10b981; }
    .score-display.medium { color: #f59e0b; }
    .score-display.high { color: #ef4444; }
    .card {
      background: #0f172a;
      border: 1px solid #1f2937;
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .card h2 {
      color: #06b6d4;
      margin-bottom: 16px;
    }
    .url-display {
      word-break: break-all;
      background: #0b1020;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;
    }
    .tag {
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 13px;
    }
    .tag.pos {
      background: rgba(16, 185, 129, 0.2);
      color: #10b981;
      border: 1px solid #10b981;
    }
    .tag.neg {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
      border: 1px solid #ef4444;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🧪 Scamometer Security Report</h1>
      <div class="score-display ${scoreClass}">${Math.round(score)}/100</div>
      <div>${escapeHtml(result.result?.ai?.verdict || 'Unknown')}</div>
    </div>
    
    <div class="card">
      <h2>URL</h2>
      <div class="url-display">${escapeHtml(result.url)}</div>
    </div>
    
    <div class="card">
      <h2>Analysis</h2>
      <p>${escapeHtml(result.result?.ai?.reason || 'No analysis available')}</p>
    </div>
    
    <div class="card">
      <h2>Positive Indicators</h2>
      <div class="tags">
        ${(result.result?.ai?.positives || []).map(p => `<span class="tag pos">✓ ${escapeHtml(p)}</span>`).join('')}
        ${(result.result?.ai?.positives || []).length === 0 ? '<span style="color: #94a3b8;">None found</span>' : ''}
      </div>
    </div>
    
    <div class="card">
      <h2>Red Flags</h2>
      <div class="tags">
        ${(result.result?.ai?.negatives || []).map(n => `<span class="tag neg">✗ ${escapeHtml(n)}</span>`).join('')}
        ${(result.result?.ai?.negatives || []).length === 0 ? '<span style="color: #94a3b8;">None found</span>' : ''}
      </div>
    </div>
    
    <div style="text-align: center; color: #94a3b8; margin-top: 40px;">
      <p>Generated by Scamometer on ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>`;
}

function newBatch() {
  batchUrls = [];
  batchResults = [];
  document.getElementById('uploadSection').style.display = 'block';
  document.getElementById('progressSection').classList.remove('active');
  document.getElementById('resultsSection').style.display = 'none';
  document.getElementById('csvFile').value = '';
  document.getElementById('fileInfo').style.display = 'none';
  document.getElementById('startBtn').disabled = true;
}

async function checkExistingBatch() {
  const status = await chrome.runtime.sendMessage({ type: 'GET_BATCH_STATUS' });
  if (status && status.status !== 'completed') {
    // Resume existing batch
    document.getElementById('uploadSection').style.display = 'none';
    document.getElementById('progressSection').classList.add('active');
    startPolling();
  } else {
    const results = await chrome.runtime.sendMessage({ type: 'GET_BATCH_RESULTS' });
    if (results && results.results && results.results.length > 0) {
      // Show existing results
      batchResults = results.results;
      await handleBatchComplete();
    }
  }
}

function showApiKeyModal() {
  document.getElementById('apiKeyModal').classList.add('active');
}

async function saveNewApiKey() {
  const newKey = document.getElementById('newApiKey').value.trim();
  if (!newKey) {
    showToast('Please enter an API key', true);
    return;
  }
  
  await chrome.storage.local.set({ apiKey: newKey });
  document.getElementById('apiKeyModal').classList.remove('active');
  document.getElementById('newApiKey').value = '';
  
  // Resume batch
  await chrome.runtime.sendMessage({ type: 'RESUME_BATCH' });
  startPolling();
  showToast('API key updated, resuming batch processing');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m =>
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
    bottom: 24px;
    right: 24px;
    padding: 16px 24px;
    background: ${isError ? '#ef4444' : '#10b981'};
    color: white;
    border-radius: 12px;
    font-weight: 600;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
