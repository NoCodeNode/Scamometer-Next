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
  
  // Embed screenshots as base64 data URLs in the HTML
  const resultsWithScreenshots = batchResults.map(r => ({
    ...r,
    screenshotData: r.screenshot?.dataUrl || null
  }));
  
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
      padding: 40px 20px;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 24px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
      animation: slideIn 0.5s ease;
    }
    
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 60px 40px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    
    .header::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
      animation: rotate 20s linear infinite;
    }
    
    @keyframes rotate {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    
    .header-content {
      position: relative;
      z-index: 1;
    }
    
    .header h1 {
      font-size: 48px;
      margin-bottom: 16px;
      text-shadow: 0 2px 20px rgba(0,0,0,0.2);
    }
    
    .header p {
      opacity: 0.95;
      font-size: 18px;
      font-weight: 500;
    }
    
    .export-bar {
      background: #f8f9fa;
      padding: 20px 40px;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    
    .export-btn {
      padding: 12px 24px;
      border-radius: 12px;
      border: none;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    
    .export-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
    }
    
    .stats-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 24px;
      padding: 40px;
      background: #f8f9fa;
    }
    
    .stat-card {
      background: white;
      padding: 32px;
      border-radius: 20px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      text-align: center;
      transition: all 0.3s;
      animation: fadeInUp 0.5s ease forwards;
      opacity: 0;
    }
    
    @keyframes fadeInUp {
      to { opacity: 1; transform: translateY(0); }
    }
    
    .stat-card:nth-child(1) { animation-delay: 0.1s; }
    .stat-card:nth-child(2) { animation-delay: 0.2s; }
    .stat-card:nth-child(3) { animation-delay: 0.3s; }
    .stat-card:nth-child(4) { animation-delay: 0.4s; }
    
    .stat-card:hover {
      transform: translateY(-8px);
      box-shadow: 0 12px 24px rgba(0,0,0,0.12);
    }
    
    .stat-value {
      font-size: 56px;
      font-weight: 800;
      margin-bottom: 12px;
      background: linear-gradient(135deg, var(--color-start), var(--color-end));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    
    .stat-card:nth-child(1) { --color-start: #667eea; --color-end: #764ba2; }
    .stat-card:nth-child(2) { --color-start: #10b981; --color-end: #059669; }
    .stat-card:nth-child(3) { --color-start: #ef4444; --color-end: #dc2626; }
    .stat-card:nth-child(4) { --color-start: #f59e0b; --color-end: #d97706; }
    
    .stat-label {
      color: #6b7280;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
      font-weight: 600;
    }
    
    .chart-section {
      padding: 40px;
      background: white;
    }
    
    .section-title {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 32px;
      color: #1f2937;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .bar-chart {
      display: flex;
      align-items: flex-end;
      justify-content: space-around;
      height: 350px;
      background: #f8f9fa;
      border-radius: 20px;
      padding: 32px;
      gap: 24px;
    }
    
    .bar-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    
    .bar-value {
      font-size: 32px;
      font-weight: 700;
      color: var(--bar-color);
    }
    
    .bar-column {
      width: 100%;
      max-width: 150px;
      background: linear-gradient(180deg, var(--bar-color), var(--bar-color-dark));
      border-radius: 12px 12px 0 0;
      position: relative;
      transition: height 1s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
    }
    
    .bar-wrapper:nth-child(1) { --bar-color: #10b981; --bar-color-dark: #059669; }
    .bar-wrapper:nth-child(2) { --bar-color: #f59e0b; --bar-color-dark: #d97706; }
    .bar-wrapper:nth-child(3) { --bar-color: #ef4444; --bar-color-dark: #dc2626; }
    
    .bar-label {
      font-weight: 700;
      color: #6b7280;
      font-size: 16px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .results-section {
      padding: 40px;
      background: white;
    }
    
    .result-card {
      background: #f8f9fa;
      border-radius: 20px;
      padding: 32px;
      margin-bottom: 24px;
      border-left: 6px solid var(--border-color);
      transition: all 0.3s;
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }
    
    .result-card:hover {
      transform: translateX(8px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.1);
    }
    
    .result-card.low { --border-color: #10b981; }
    .result-card.medium { --border-color: #f59e0b; }
    .result-card.high { --border-color: #ef4444; }
    
    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      gap: 20px;
    }
    
    .result-info {
      flex: 1;
      min-width: 0;
    }
    
    .result-url {
      font-weight: 700;
      color: #1f2937;
      font-size: 18px;
      margin-bottom: 8px;
      word-break: break-all;
    }
    
    .result-score {
      font-size: 48px;
      font-weight: 800;
      text-align: center;
      min-width: 120px;
    }
    
    .result-score.low { color: #10b981; }
    .result-score.medium { color: #f59e0b; }
    .result-score.high { color: #ef4444; }
    
    .result-details {
      color: #6b7280;
      line-height: 1.8;
      font-size: 15px;
    }
    
    .result-details strong {
      color: #374151;
      font-weight: 600;
    }
    
    .tags-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 16px;
    }
    
    .tag {
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
    }
    
    .tag.positive {
      background: rgba(16, 185, 129, 0.15);
      color: #059669;
      border: 1.5px solid #10b981;
    }
    
    .tag.negative {
      background: rgba(239, 68, 68, 0.15);
      color: #dc2626;
      border: 1.5px solid #ef4444;
    }
    
    .screenshot-preview {
      margin-top: 20px;
      display: none;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.15);
      animation: fadeIn 0.3s ease;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    
    .screenshot-preview.active {
      display: block;
    }
    
    .screenshot-preview img {
      width: 100%;
      height: auto;
      display: block;
    }
    
    .view-screenshot-btn {
      display: inline-block;
      padding: 10px 20px;
      margin-top: 12px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      border: none;
      font-size: 14px;
    }
    
    .view-screenshot-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }
    
    .footer {
      background: #1f2937;
      color: white;
      padding: 40px;
      text-align: center;
    }
    
    .footer h3 {
      font-size: 24px;
      margin-bottom: 16px;
    }
    
    .footer p {
      opacity: 0.8;
      margin-bottom: 8px;
    }
    
    @media print {
      body { background: white; padding: 0; }
      .export-bar { display: none; }
      .screenshot-preview { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-content">
        <h1>🧪 Scamometer Batch Analysis Report</h1>
        <p>Generated on ${new Date().toLocaleString()} • ${batchResults.length} URLs Analyzed</p>
      </div>
    </div>
    
    <div class="export-bar">
      <div style="font-weight: 600; color: #374151;">Interactive Report • Click cards to view screenshots</div>
      <button class="export-btn" onclick="exportToJSON()">📥 Export as JSON</button>
    </div>
    
    <div class="stats-container">
      <div class="stat-card">
        <div class="stat-value">${batchResults.length}</div>
        <div class="stat-label">Total URLs</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${completed.length}</div>
        <div class="stat-label">Successful</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${failed.length}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${avgScore}</div>
        <div class="stat-label">Avg Risk Score</div>
      </div>
    </div>
    
    <div class="chart-section">
      <div class="section-title">📊 Risk Distribution</div>
      <div class="bar-chart">
        <div class="bar-wrapper">
          <div class="bar-value">${lowRisk}</div>
          <div class="bar-column" style="height: ${lowRisk > 0 ? (lowRisk / Math.max(lowRisk, mediumRisk, highRisk, 1) * 100) : 0}%;"></div>
          <div class="bar-label">Low Risk</div>
        </div>
        <div class="bar-wrapper">
          <div class="bar-value">${mediumRisk}</div>
          <div class="bar-column" style="height: ${mediumRisk > 0 ? (mediumRisk / Math.max(lowRisk, mediumRisk, highRisk, 1) * 100) : 0}%;"></div>
          <div class="bar-label">Medium Risk</div>
        </div>
        <div class="bar-wrapper">
          <div class="bar-value">${highRisk}</div>
          <div class="bar-column" style="height: ${highRisk > 0 ? (highRisk / Math.max(lowRisk, mediumRisk, highRisk, 1) * 100) : 0}%;"></div>
          <div class="bar-label">High Risk</div>
        </div>
      </div>
    </div>
    
    <div class="results-section">
      <div class="section-title">📋 Detailed Analysis Results</div>
      ${resultsWithScreenshots.map((result, index) => {
        const score = result.result?.ai?.scamometer || 0;
        const scoreClass = score >= 75 ? 'high' : (score >= 40 ? 'medium' : 'low');
        const positives = result.result?.ai?.positives || [];
        const negatives = result.result?.ai?.negatives || [];
        
        return `
          <div class="result-card ${scoreClass}" id="result-${index}">
            <div class="result-header">
              <div class="result-info">
                <div class="result-url">${escapeHtml(result.url)}</div>
                ${result.status === 'completed' ? `
                  <div class="result-details">
                    <strong>Verdict:</strong> ${escapeHtml(result.result?.ai?.verdict || 'N/A')}<br>
                    <strong>Analysis:</strong> ${escapeHtml(result.result?.ai?.reason || 'N/A')}
                  </div>
                  ${positives.length > 0 || negatives.length > 0 ? `
                    <div class="tags-container">
                      ${positives.map(p => `<span class="tag positive">✓ ${escapeHtml(p)}</span>`).join('')}
                      ${negatives.map(n => `<span class="tag negative">✗ ${escapeHtml(n)}</span>`).join('')}
                    </div>
                  ` : ''}
                ` : `
                  <div class="result-details">
                    <strong>Status:</strong> ${escapeHtml(result.status)}<br>
                    ${result.error ? `<strong>Error:</strong> ${escapeHtml(result.error)}` : ''}
                  </div>
                `}
                ${result.screenshotData ? `
                  <button class="view-screenshot-btn" onclick="toggleScreenshot(${index})">
                    👁️ View Screenshot
                  </button>
                ` : ''}
              </div>
              <div class="result-score ${scoreClass}">${Math.round(score)}<span style="font-size: 24px;">/100</span></div>
            </div>
            ${result.screenshotData ? `
              <div class="screenshot-preview" id="screenshot-${index}">
                <img src="${result.screenshotData}" alt="Screenshot of ${escapeHtml(result.url)}">
              </div>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
    
    <div class="footer">
      <h3>🧪 Scamometer</h3>
      <p>AI-Powered Phishing & Scam Detector</p>
      <p>https://github.com/NoCodeNode/Scamometer-Next</p>
      <p style="margin-top: 20px; font-size: 14px;">Built by Arnab Mandal • hello@arnabmandal.com</p>
    </div>
  </div>
  
  <script>
    // Store data for JSON export
    const reportData = ${JSON.stringify({
      generated: new Date().toISOString(),
      total: batchResults.length,
      completed: completed.length,
      failed: failed.length,
      avgScore: avgScore,
      results: batchResults.map(r => ({
        url: r.url,
        status: r.status,
        score: r.result?.ai?.scamometer || 0,
        verdict: r.result?.ai?.verdict || null,
        reason: r.result?.ai?.reason || null,
        positives: r.result?.ai?.positives || [],
        negatives: r.result?.ai?.negatives || [],
        error: r.error || null,
        screenshot: r.screenshot ? {
          filename: r.screenshot.filename,
          timestamp: r.screenshot.timestamp,
          hash: r.screenshot.hash
        } : null
      }))
    })};
    
    function toggleScreenshot(index) {
      const preview = document.getElementById(\`screenshot-\${index}\`);
      const allPreviews = document.querySelectorAll('.screenshot-preview');
      
      // Close all other previews
      allPreviews.forEach((p, i) => {
        if (i !== index) p.classList.remove('active');
      });
      
      // Toggle current preview
      preview.classList.toggle('active');
      
      // Scroll into view
      if (preview.classList.contains('active')) {
        preview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
    
    function exportToJSON() {
      const dataStr = JSON.stringify(reportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = \`scamometer-report-\${Date.now()}.json\`;
      link.click();
      URL.revokeObjectURL(url);
    }
    
    // Add hover effect to result cards
    document.querySelectorAll('.result-card').forEach(card => {
      card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateX(8px) scale(1.01)';
      });
      card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateX(0) scale(1)';
      });
    });
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
