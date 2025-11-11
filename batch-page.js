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
  
  // Close button
  document.getElementById('closeBtn')?.addEventListener('click', () => {
    window.close();
  });
  
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
    document.getElementById('fileInfo').textContent = `✅ Loaded ${batchUrls.length} URLs from ${file.name}`;
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
  // Save to same folder as screenshots
  a.download = `scamometer_reports/report_${Date.now()}.html`;
  
  // Use chrome.downloads API for proper folder placement
  chrome.downloads.download({
    url: url,
    filename: `scamometer_reports/scamometer_report_${Date.now()}.html`,
    saveAs: false
  }).then(() => {
    showToast('✅ Interactive HTML report downloaded to scamometer_reports folder!');
    URL.revokeObjectURL(url);
  }).catch(err => {
    // Fallback to regular download
    a.click();
    URL.revokeObjectURL(url);
    showToast('Interactive HTML report downloaded');
  });
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
  
  const escapeHtml = (s) => String(s || '').replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  
  // Generate table rows with expandable details
  const tableRows = batchResults.map((result, index) => {
    const score = result.result?.ai?.scamometer || 0;
    const verdict = result.result?.ai?.verdict || (result.status === 'failed' ? 'Failed' : 'N/A');
    const positives = result.result?.ai?.positives || [];
    const negatives = result.result?.ai?.negatives || [];
    const timestamp = result.screenshot?.timestamp || new Date().toISOString();
    const dateFormatted = new Date(timestamp).toLocaleString();
    const sha256 = result.screenshot?.hash || 'N/A';
    const screenshotFile = result.screenshot?.filename || null;
    
    const scoreClass = score >= 75 ? 'high' : (score >= 40 ? 'medium' : 'low');
    const scoreColor = score >= 75 ? '#ef4444' : (score >= 40 ? '#f59e0b' : '#10b981');
    
    return `
      <tr class="result-row ${scoreClass}" onclick="toggleDetails(${index})">
        <td class="url-cell">${escapeHtml(result.url)}</td>
        <td class="date-cell">${escapeHtml(dateFormatted)}</td>
        <td class="screenshot-cell" onclick="event.stopPropagation();">
          ${screenshotFile ? `
            <button class="view-btn" onclick="toggleScreenshot(${index})">👁️ View</button>
            <div id="screenshot-${index}" class="screenshot-modal" style="display:none;">
              <img src="./${screenshotFile}" alt="Screenshot" style="max-width:100%; height:auto; border-radius:8px;">
            </div>
          ` : '<span class="na">No screenshot</span>'}
        </td>
        <td class="hash-cell"><code>${escapeHtml(sha256.substring(0, 12))}...</code></td>
        <td class="score-cell">
          <span class="score-badge ${scoreClass}">${Math.round(score)}</span>
        </td>
        <td class="verdict-cell">${escapeHtml(verdict)}</td>
        <td class="indicators-cell">
          ${positives.length > 0 ? `<span class="pos-count">✓ ${positives.length}</span>` : '<span class="na">0</span>'}
        </td>
        <td class="indicators-cell">
          ${negatives.length > 0 ? `<span class="neg-count">✗ ${negatives.length}</span>` : '<span class="na">0</span>'}
        </td>
      </tr>
      <tr id="details-${index}" class="details-row" style="display:none;">
        <td colspan="8" class="details-cell">
          <div class="details-content">
            <div class="details-section">
              <h4 style="color:#10b981; margin-bottom:12px;">✅ Positive Indicators (${positives.length})</h4>
              ${positives.length > 0 ? `
                <ul style="list-style:none; padding:0; display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:8px;">
                  ${positives.map(p => `<li style="padding:8px 12px; background:#d1fae5; color:#065f46; border-radius:6px; font-size:13px;">✓ ${escapeHtml(p)}</li>`).join('')}
                </ul>
              ` : '<p style="color:#9ca3af; font-style:italic;">No positive indicators found</p>'}
            </div>
            <div class="details-section" style="margin-top:20px;">
              <h4 style="color:#ef4444; margin-bottom:12px;">🚩 Red Flags (${negatives.length})</h4>
              ${negatives.length > 0 ? `
                <ul style="list-style:none; padding:0; display:grid; grid-template-columns:repeat(auto-fill, minmax(250px, 1fr)); gap:8px;">
                  ${negatives.map(n => `<li style="padding:8px 12px; background:#fee2e2; color:#991b1b; border-radius:6px; font-size:13px;">✗ ${escapeHtml(n)}</li>`).join('')}
                </ul>
              ` : '<p style="color:#9ca3af; font-style:italic;">No red flags found</p>'}
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scamometer Batch Analysis Report - ${new Date().toLocaleDateString()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    
    .container {
      max-width: 1600px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
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
    
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      padding: 30px;
      background: #f8f9fa;
      border-bottom: 2px solid #e5e7eb;
    }
    
    .card {
      background: white;
      padding: 24px;
      border-radius: 12px;
      text-align: center;
      border: 2px solid #e5e7eb;
    }
    
    .card-value {
      font-size: 36px;
      font-weight: 800;
      margin-bottom: 8px;
    }
    
    .card.total .card-value { color: #667eea; }
    .card.success .card-value { color: #10b981; }
    .card.failed .card-value { color: #ef4444; }
    .card.avg .card-value { color: #f59e0b; }
    
    .card-label {
      color: #6b7280;
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .export-bar {
      background: white;
      padding: 20px 30px;
      border-bottom: 2px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    
    .export-btn {
      padding: 10px 20px;
      border-radius: 8px;
      border: none;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .export-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    
    .table-container {
      padding: 30px;
      overflow-x: auto;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border-radius: 8px;
      overflow: hidden;
    }
    
    thead {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    
    th {
      padding: 16px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    tbody tr {
      border-bottom: 1px solid #e5e7eb;
      transition: all 0.2s;
    }
    
    tbody tr:hover {
      background: #f8f9fa;
    }
    
    tbody tr.result-row {
      cursor: pointer;
    }
    
    tbody tr.details-row {
      cursor: default;
    }
    
    .details-cell {
      background: #f8f9fa !important;
      padding: 24px !important;
    }
    
    .details-content {
      background: white;
      border-radius: 8px;
      padding: 20px;
      border: 2px solid #e5e7eb;
    }
    
    .details-section h4 {
      font-size: 16px;
      font-weight: 700;
    }
    
    td {
      padding: 16px 12px;
      font-size: 14px;
      vertical-align: top;
    }
    
    .url-cell {
      max-width: 300px;
      word-break: break-all;
      font-weight: 500;
      color: #1f2937;
    }
    
    .date-cell {
      white-space: nowrap;
      color: #6b7280;
      font-size: 13px;
    }
    
    .hash-cell code {
      background: #f3f4f6;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      color: #374151;
      font-family: 'Courier New', monospace;
    }
    
    .score-badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 20px;
      font-weight: 700;
      font-size: 16px;
    }
    
    .score-badge.low { background: #d1fae5; color: #065f46; }
    .score-badge.medium { background: #fef3c7; color: #92400e; }
    .score-badge.high { background: #fee2e2; color: #991b1b; }
    
    .verdict-cell {
      font-weight: 600;
      color: #374151;
    }
    
    .result-row.low { border-left: 4px solid #10b981; }
    .result-row.medium { border-left: 4px solid #f59e0b; }
    .result-row.high { border-left: 4px solid #ef4444; }
    
    .view-btn {
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid #667eea;
      background: white;
      color: #667eea;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 12px;
    }
    
    .view-btn:hover {
      background: #667eea;
      color: white;
    }
    
    .screenshot-modal {
      margin-top: 12px;
      padding: 12px;
      background: #f8f9fa;
      border-radius: 8px;
      border: 2px solid #e5e7eb;
    }
    
    .pos-count {
      color: #10b981;
      font-weight: 600;
      background: #d1fae5;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 13px;
    }
    
    .neg-count {
      color: #ef4444;
      font-weight: 600;
      background: #fee2e2;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 13px;
    }
    
    .na {
      color: #9ca3af;
      font-style: italic;
    }
    
    .footer {
      text-align: center;
      padding: 30px;
      background: #f8f9fa;
      color: #6b7280;
      border-top: 2px solid #e5e7eb;
    }
    
    .footer h3 {
      color: #374151;
      margin-bottom: 8px;
    }
    
    @media (max-width: 1200px) {
      table {
        font-size: 13px;
      }
      th, td {
        padding: 12px 8px;
      }
    }
    
    @media print {
      body {
        background: white;
        padding: 0;
      }
      .export-bar, .view-btn {
        display: none;
      }
      .screenshot-modal {
        display: block !important;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-content">
        <h1>🧪 Scamometer Batch Analysis Report</h1>
        <p>Generated on ${new Date().toLocaleString()}</p>
      </div>
    </div>
    
    <div class="summary-cards">
      <div class="card total">
        <div class="card-value">${batchResults.length}</div>
        <div class="card-label">Total URLs</div>
      </div>
      <div class="card success">
        <div class="card-value">${completed.length}</div>
        <div class="card-label">Completed</div>
      </div>
      <div class="card failed">
        <div class="card-value">${failed.length}</div>
        <div class="card-label">Failed</div>
      </div>
      <div class="card avg">
        <div class="card-value">${avgScore}</div>
        <div class="card-label">Avg Risk Score</div>
      </div>
    </div>
    
    <div class="export-bar">
      <div style="flex:1;">
        <input type="text" id="searchBox" placeholder="🔍 Search by URL..." style="padding:10px 16px; border:1px solid #d1d5db; border-radius:8px; width:100%; max-width:400px; font-size:14px;" onkeyup="filterTable()">
      </div>
      <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
        <button class="filter-btn" data-filter="all" onclick="setFilter('all')" style="padding:8px 16px; border-radius:6px; border:2px solid #667eea; background:#667eea; color:white; cursor:pointer; font-weight:600;">All</button>
        <button class="filter-btn" data-filter="low" onclick="setFilter('low')" style="padding:8px 16px; border-radius:6px; border:1px solid #10b981; background:white; color:#10b981; cursor:pointer; font-weight:600;">Low Risk</button>
        <button class="filter-btn" data-filter="medium" onclick="setFilter('medium')" style="padding:8px 16px; border-radius:6px; border:1px solid #f59e0b; background:white; color:#f59e0b; cursor:pointer; font-weight:600;">Medium Risk</button>
        <button class="filter-btn" data-filter="high" onclick="setFilter('high')" style="padding:8px 16px; border-radius:6px; border:1px solid #ef4444; background:white; color:#ef4444; cursor:pointer; font-weight:600;">High Risk</button>
        <button class="export-btn" onclick="exportAsJSON()">📥 Export as JSON</button>
      </div>
    </div>
    
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>URL</th>
            <th>Date/Time</th>
            <th>Screenshot</th>
            <th>SHA-256</th>
            <th>Score</th>
            <th>Verdict</th>
            <th>Positives</th>
            <th>Negatives</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
    
    <div class="footer">
      <h3>🧪 Scamometer</h3>
      <p>AI-Powered Phishing & Scam Detector</p>
      <p style="margin-top:8px; font-size:12px;">
        Built by Arnab Mandal | 
        <a href="https://github.com/NoCodeNode/Scamometer-Next" style="color:#667eea;">GitHub</a>
      </p>
    </div>
  </div>
  
  <script>
    let currentFilter = 'all';
    let allRows = [];
    
    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
      allRows = Array.from(document.querySelectorAll('tbody tr.result-row'));
    });
    
    function toggleDetails(index) {
      const detailsRow = document.getElementById('details-' + index);
      if (detailsRow) {
        if (detailsRow.style.display === 'none' || detailsRow.style.display === '') {
          // Close all other details
          document.querySelectorAll('.details-row').forEach(row => row.style.display = 'none');
          detailsRow.style.display = 'table-row';
        } else {
          detailsRow.style.display = 'none';
        }
      }
    }
    
    function toggleScreenshot(index) {
      const modal = document.getElementById('screenshot-' + index);
      if (modal) {
        if (modal.style.display === 'none' || modal.style.display === '') {
          // Hide all other screenshots
          document.querySelectorAll('.screenshot-modal').forEach(m => m.style.display = 'none');
          modal.style.display = 'block';
        } else {
          modal.style.display = 'none';
        }
      }
    }
    
    function setFilter(filter) {
      currentFilter = filter;
      
      // Update button styles
      document.querySelectorAll('.filter-btn').forEach(btn => {
        if (btn.dataset.filter === filter) {
          btn.style.background = '#667eea';
          btn.style.color = 'white';
          btn.style.borderColor = '#667eea';
        } else {
          btn.style.background = 'white';
          const color = btn.dataset.filter === 'low' ? '#10b981' : btn.dataset.filter === 'medium' ? '#f59e0b' : btn.dataset.filter === 'high' ? '#ef4444' : '#667eea';
          btn.style.color = color;
          btn.style.borderColor = color;
        }
      });
      
      filterTable();
    }
    
    function filterTable() {
      const searchTerm = document.getElementById('searchBox').value.toLowerCase();
      
      allRows.forEach((row, idx) => {
        const url = row.querySelector('.url-cell').textContent.toLowerCase();
        const scoreClass = row.classList.contains('low') ? 'low' : row.classList.contains('medium') ? 'medium' : 'high';
        
        // Check search
        const matchesSearch = !searchTerm || url.includes(searchTerm);
        
        // Check filter
        const matchesFilter = currentFilter === 'all' || scoreClass === currentFilter;
        
        // Show or hide
        if (matchesSearch && matchesFilter) {
          row.style.display = 'table-row';
        } else {
          row.style.display = 'none';
          // Also hide details row
          const detailsRow = document.getElementById('details-' + idx);
          if (detailsRow) detailsRow.style.display = 'none';
        }
      });
    }
    
    function exportAsJSON() {
      const data = ${JSON.stringify({
        generated: new Date().toISOString(),
        total: batchResults.length,
        completed: completed.length,
        failed: failed.length,
        avgScore: avgScore,
        results: batchResults
      })};
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'scamometer-report-' + Date.now() + '.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  </script>
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
