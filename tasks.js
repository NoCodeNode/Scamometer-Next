// Built by Arnab Mandal — contact: hello@arnabmandal.com

let currentTask = null;
let completedTasks = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadTasks();
  setupEventListeners();
  renderTasks();
  
  // Auto-refresh every 2 seconds if there's an active task
  setInterval(async () => {
    if (currentTask && currentTask.status === 'processing') {
      await loadTasks();
      renderTasks();
    }
  }, 2000);
});

function setupEventListeners() {
  document.getElementById('clearCompleted').addEventListener('click', clearCompleted);
  
  // Navigation buttons
  document.getElementById('navReports')?.addEventListener('click', () => location.href = 'reports.html');
  document.getElementById('navBatch')?.addEventListener('click', () => location.href = 'batch.html');
  document.getElementById('navAnalytics')?.addEventListener('click', () => location.href = 'analytics.html');
  document.getElementById('navSettings')?.addEventListener('click', () => chrome.runtime.openOptionsPage());
}

async function loadTasks() {
  const data = await chrome.storage.local.get(['batch::queue', 'batch::status', 'completedBatches']);
  
  // Load current/active task
  if (data['batch::queue']) {
    const queue = data['batch::queue'];
    const status = data['batch::status'];
    
    if (queue.status && queue.status !== 'idle') {
      currentTask = {
        id: queue.timestamp || Date.now(),
        status: queue.status,
        urls: queue.urls || [],
        currentIndex: queue.currentIndex || 0,
        total: (queue.urls || []).length,
        startTime: queue.timestamp || Date.now(),
        ...status
      };
    } else {
      currentTask = null;
    }
  }
  
  // Load completed tasks
  completedTasks = data.completedBatches || [];
}

function renderTasks() {
  renderActiveTask();
  renderCompletedTasks();
}

function renderActiveTask() {
  const container = document.getElementById('activeTasks');
  const empty = document.getElementById('emptyActive');
  
  if (!currentTask) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  
  empty.style.display = 'none';
  
  // Remove old event listeners by cloning container
  const newContainer = container.cloneNode(false);
  container.parentNode.replaceChild(newContainer, container);
  
  const completed = currentTask.urls.filter(u => u.status === 'completed').length;
  const failed = currentTask.urls.filter(u => u.status === 'failed').length;
  const percentage = currentTask.total > 0 ? Math.round((completed / currentTask.total) * 100) : 0;
  const elapsed = Math.round((Date.now() - currentTask.startTime) / 1000);
  
  const statusText = currentTask.status === 'processing' ? 'Processing' : currentTask.status === 'paused' ? 'Paused' : 'Completed';
  const statusClass = currentTask.status === 'processing' ? 'processing' : currentTask.status === 'paused' ? 'paused' : 'completed';
  
  newContainer.id = 'activeTasks';
  newContainer.innerHTML = `
    <div class="task-card">
      <div class="task-header">
        <div class="task-title">🔄 Batch Analysis</div>
        <div class="status-badge ${statusClass}">${statusText}</div>
      </div>
      
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: ${percentage}%"></div>
      </div>
      
      <div class="task-stats">
        <div><strong>${completed}</strong> / ${currentTask.total} URLs completed</div>
        <div><strong>${failed}</strong> failed</div>
        <div><strong>${percentage}%</strong> complete</div>
        <div>⏱️ ${formatDuration(elapsed)}</div>
      </div>
      
      <div style="font-size: 13px; color: var(--muted); margin-top: 8px;">
        ${currentTask.status === 'processing' ? `Currently processing: ${escapeHtml(currentTask.urls[currentTask.currentIndex]?.url || 'N/A')}` : ''}
      </div>
      
      <div class="task-actions">
        ${currentTask.status === 'processing' ? '<button class="btn-pause" data-action="pause">⏸️ Pause</button>' : ''}
        ${currentTask.status === 'paused' ? '<button class="primary btn-resume" data-action="resume">▶️ Resume</button>' : ''}
        <button class="btn-view" data-action="view">👁️ View Details</button>
        ${currentTask.status !== 'processing' ? '<button class="danger btn-cancel" data-action="cancel">❌ Cancel Task</button>' : ''}
      </div>
    </div>
  `;
  
  // Add event listeners to buttons
  newContainer.querySelectorAll('[data-action]').forEach(btn => {
    const action = btn.dataset.action;
    if (action === 'pause') btn.addEventListener('click', pauseTask);
    else if (action === 'resume') btn.addEventListener('click', resumeTask);
    else if (action === 'view') btn.addEventListener('click', viewBatchPage);
    else if (action === 'cancel') btn.addEventListener('click', cancelTask);
  });
}

function renderCompletedTasks() {
  const container = document.getElementById('completedTasks');
  const empty = document.getElementById('emptyCompleted');
  
  if (completedTasks.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  
  empty.style.display = 'none';
  
  // Remove old event listeners by cloning
  const newContainer = container.cloneNode(false);
  container.parentNode.replaceChild(newContainer, container);
  newContainer.id = 'completedTasks';
  
  newContainer.innerHTML = completedTasks.map((task, index) => {
    const completed = task.completed || 0;
    const failed = task.failed || 0;
    const total = task.total || 0;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    const date = new Date(task.timestamp).toLocaleString();
    const duration = formatDuration(Math.round((task.endTime - task.startTime) / 1000));
    
    return `
      <div class="task-card">
        <div class="task-header">
          <div class="task-title">✅ Batch Analysis</div>
          <div class="status-badge completed">Completed</div>
        </div>
        
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: ${percentage}%"></div>
        </div>
        
        <div class="task-stats">
          <div><strong>${completed}</strong> successful</div>
          <div><strong>${failed}</strong> failed</div>
          <div><strong>${total}</strong> total</div>
          <div>⏱️ ${duration}</div>
        </div>
        
        <div style="font-size: 13px; color: var(--muted); margin-top: 8px;">
          Completed: ${date}
        </div>
        
        <div class="task-actions">
          <button data-action="view-reports" data-index="${index}">📊 View Reports</button>
          <button class="danger" data-action="delete" data-index="${index}">🗑️ Delete</button>
        </div>
      </div>
    `;
  }).join('');
  
  // Add event listeners
  newContainer.querySelectorAll('[data-action]').forEach(btn => {
    const action = btn.dataset.action;
    const index = parseInt(btn.dataset.index);
    if (action === 'view-reports') {
      btn.addEventListener('click', () => location.href = 'reports.html');
    } else if (action === 'delete') {
      btn.addEventListener('click', () => deleteCompleted(index));
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return `${minutes}m ${secs}s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

async function pauseTask() {
  await chrome.runtime.sendMessage({ type: 'PAUSE_BATCH' });
  await loadTasks();
  renderTasks();
}

async function resumeTask() {
  await chrome.runtime.sendMessage({ type: 'RESUME_BATCH' });
  await loadTasks();
  renderTasks();
}

async function cancelTask() {
  if (!confirm('Cancel the current batch processing? This will stop all processing.')) return;
  
  await chrome.runtime.sendMessage({ type: 'STOP_BATCH' });
  
  // Save to completed tasks
  if (currentTask) {
    const completedUrls = currentTask.urls.filter(u => u.status === 'completed').length;
    const failedUrls = currentTask.urls.filter(u => u.status === 'failed').length;
    
    const completedTask = {
      timestamp: currentTask.startTime,
      startTime: currentTask.startTime,
      endTime: Date.now(),
      total: currentTask.total,
      completed: completedUrls,
      failed: failedUrls,
      cancelled: true
    };
    
    completedTasks.unshift(completedTask);
    await chrome.storage.local.set({ completedBatches: completedTasks });
  }
  
  await loadTasks();
  renderTasks();
}

function viewBatchPage() {
  location.href = 'batch.html';
}

async function deleteCompleted(index) {
  if (!confirm('Delete this completed task?')) return;
  
  completedTasks.splice(index, 1);
  await chrome.storage.local.set({ completedBatches: completedTasks });
  renderCompletedTasks();
}

async function clearCompleted() {
  if (!confirm('Clear all completed tasks?')) return;
  
  completedTasks = [];
  await chrome.storage.local.set({ completedBatches: [] });
  renderCompletedTasks();
}

function viewBatchPage() {
  window.location.href = 'batch.html';
}

async function clearCompleted() {
  if (!confirm('Clear all completed tasks from history?')) return;
  
  completedTasks = [];
  await chrome.storage.local.set({ completedBatches: [] });
  renderTasks();
}

async function deleteCompleted(index) {
  if (!confirm('Delete this completed task?')) return;
  
  completedTasks.splice(index, 1);
  await chrome.storage.local.set({ completedBatches: completedTasks });
  renderTasks();
}
