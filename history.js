// History page functionality
let allHistory = [];
let filteredHistory = [];
let currentFilter = 'all';

// Load and display history
async function loadHistory() {
  const data = await chrome.storage.local.get(null);
  const entries = [];
  
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('analysis::') && value.ai) {
      entries.push({
        key,
        url: value.url,
        score: value.ai.scamometer,
        verdict: value.ai.verdict,
        when: value.when,
        data: value
      });
    }
  }
  
  // Sort by time (newest first)
  entries.sort((a, b) => (b.when || 0) - (a.when || 0));
  allHistory = entries;
  
  updateStats();
  applyFilter(currentFilter);
}

function updateStats() {
  const total = allHistory.length;
  const high = allHistory.filter(e => e.score >= 75).length;
  const medium = allHistory.filter(e => e.score >= 40 && e.score < 75).length;
  const low = allHistory.filter(e => e.score < 40).length;
  
  document.getElementById('totalScans').textContent = total;
  document.getElementById('highRisk').textContent = high;
  document.getElementById('mediumRisk').textContent = medium;
  document.getElementById('lowRisk').textContent = low;
}

function getScoreClass(score) {
  if (score >= 75) return 'high';
  if (score >= 40) return 'med';
  return 'low';
}

function getRiskLabel(score) {
  if (score >= 75) return 'High Risk';
  if (score >= 40) return 'Medium Risk';
  return 'Low Risk';
}

function formatTime(timestamp) {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  // Less than 1 minute
  if (diff < 60000) return 'Just now';
  // Less than 1 hour
  if (diff < 3600000) return Math.floor(diff / 60000) + ' min ago';
  // Less than 24 hours
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' hr ago';
  // Less than 7 days
  if (diff < 604800000) return Math.floor(diff / 86400000) + ' days ago';
  
  return date.toLocaleDateString();
}

function displayHistory(items) {
  const list = document.getElementById('historyList');
  const empty = document.getElementById('emptyState');
  
  if (items.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  
  empty.style.display = 'none';
  list.innerHTML = items.map(item => {
    const scoreClass = getScoreClass(item.score);
    const riskLabel = getRiskLabel(item.score);
    let hostname;
    try {
      hostname = new URL(item.url).hostname;
    } catch (e) {
      hostname = item.url; // Fallback to full URL if parsing fails
    }
    
    return `
      <div class="history-item" data-key="${escapeHtml(item.key)}">
        <div class="score-badge ${scoreClass}">${Math.round(item.score)}</div>
        <div class="site-info">
          <div class="site-url" title="${escapeHtml(item.url)}">${escapeHtml(hostname)}</div>
          <div class="site-time">${formatTime(item.when)} • ${riskLabel}</div>
        </div>
        <div class="action-icons">
          <button class="icon-btn" onclick="viewDetails('${escapeHtml(item.key)}')" title="View Details">👁️</button>
          <button class="icon-btn" onclick="deleteItem('${escapeHtml(item.key)}')" title="Delete">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function applyFilter(filter) {
  currentFilter = filter;
  
  // Update active button
  document.querySelectorAll('.filter-btn').forEach(btn => {
    if (btn.dataset.filter === filter) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Filter items
  let items = allHistory;
  if (filter === 'high') {
    items = allHistory.filter(e => e.score >= 75);
  } else if (filter === 'medium') {
    items = allHistory.filter(e => e.score >= 40 && e.score < 75);
  } else if (filter === 'low') {
    items = allHistory.filter(e => e.score < 40);
  }
  
  // Apply search
  const searchTerm = document.getElementById('searchBox').value.toLowerCase();
  if (searchTerm) {
    items = items.filter(e => 
      e.url.toLowerCase().includes(searchTerm) ||
      e.verdict.toLowerCase().includes(searchTerm)
    );
  }
  
  filteredHistory = items;
  displayHistory(items);
}

// View details in a new tab (opens popup for the URL)
window.viewDetails = async function(key) {
  const data = await chrome.storage.local.get(key);
  const item = data[key];
  if (!item) return;
  
  // Open the URL in a new tab
  chrome.tabs.create({ url: item.url });
}

// Delete a history item
window.deleteItem = async function(key) {
  if (!confirm('Delete this scan from history?')) return;
  
  await chrome.storage.local.remove(key);
  await loadHistory();
}

// Export history
document.getElementById('exportBtn').addEventListener('click', () => {
  const exportData = allHistory.map(item => ({
    url: item.url,
    score: item.score,
    verdict: item.verdict,
    timestamp: new Date(item.when).toISOString(),
    positives: item.data.ai?.positives || [],
    negatives: item.data.ai?.negatives || []
  }));
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scamometer-history-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// Clear all history
document.getElementById('clearBtn').addEventListener('click', async () => {
  if (!confirm('Are you sure you want to clear all scan history? This cannot be undone.')) return;
  
  const keys = allHistory.map(item => item.key);
  await chrome.storage.local.remove(keys);
  await loadHistory();
});

// Filter buttons
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    applyFilter(btn.dataset.filter);
  });
});

// Search
document.getElementById('searchBox').addEventListener('input', () => {
  applyFilter(currentFilter);
});

// Initial load
loadHistory();
