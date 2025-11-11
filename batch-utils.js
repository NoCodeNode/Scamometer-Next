// Built by Arnab Mandal — contact: hello@arnabmandal.com
// Batch processing utilities for Scamometer

/**
 * Parse CSV file content and extract URLs
 * Assumes first column contains URLs, one per row
 * @param {string} csvContent - Raw CSV file content
 * @returns {Array<string>} - Array of URLs
 */
export function parseCSV(csvContent) {
  if (!csvContent || typeof csvContent !== 'string') {
    return [];
  }
  
  const lines = csvContent.split('\n').map(line => line.trim()).filter(line => line);
  const urls = [];
  
  for (const line of lines) {
    // Get first column (split by comma, handle quoted values)
    let firstColumn = line.split(',')[0].trim();
    
    // Remove quotes if present
    if (firstColumn.startsWith('"') && firstColumn.endsWith('"')) {
      firstColumn = firstColumn.slice(1, -1);
    }
    
    // Validate URL format
    if (isValidUrl(firstColumn)) {
      urls.push(firstColumn);
    }
  }
  
  return urls;
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} - True if valid URL
 */
function isValidUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (e) {
    return false;
  }
}

/**
 * Calculate SHA-256 hash of data
 * @param {ArrayBuffer} buffer - Data to hash
 * @returns {Promise<string>} - Hex string hash
 */
export async function calculateSHA256(buffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

/**
 * Convert base64 data URL to ArrayBuffer
 * @param {string} dataUrl - Data URL
 * @returns {ArrayBuffer} - Binary data
 */
export function dataUrlToBuffer(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

/**
 * Format timestamp as YYYY-MM-DD HH:MM:SS
 * @param {Date} date - Date object
 * @returns {string} - Formatted timestamp
 */
export function formatTimestamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Queue management for batch processing
 */
export class BatchQueue {
  constructor() {
    this.storageKey = 'batch::queue';
    this.statusKey = 'batch::status';
  }
  
  /**
   * Initialize a new batch job
   * @param {Array<string>} urls - URLs to process
   * @returns {Promise<string>} - Batch job ID
   */
  async initialize(urls) {
    const jobId = `batch_${Date.now()}`;
    const queue = {
      id: jobId,
      urls: urls.map((url, index) => ({
        url,
        index,
        status: 'pending',
        result: null,
        error: null
      })),
      currentIndex: 0,
      status: 'pending',
      createdAt: Date.now(),
      completedAt: null
    };
    
    await chrome.storage.local.set({ [this.storageKey]: queue });
    await this.updateStatus('initialized', 0, urls.length);
    return jobId;
  }
  
  /**
   * Get current queue state
   * @returns {Promise<Object|null>} - Queue object or null
   */
  async getQueue() {
    const data = await chrome.storage.local.get(this.storageKey);
    return data[this.storageKey] || null;
  }
  
  /**
   * Get next URL to process
   * @returns {Promise<Object|null>} - URL object or null if done
   */
  async getNext() {
    const queue = await this.getQueue();
    if (!queue) return null;
    
    const pending = queue.urls.filter(u => u.status === 'pending');
    if (pending.length === 0) return null;
    
    return pending[0];
  }
  
  /**
   * Mark URL as processing
   * @param {number} index - URL index
   */
  async markProcessing(index) {
    const queue = await this.getQueue();
    if (!queue) return;
    
    const urlObj = queue.urls.find(u => u.index === index);
    if (urlObj) {
      urlObj.status = 'processing';
      queue.currentIndex = index;
      await chrome.storage.local.set({ [this.storageKey]: queue });
      await this.updateStatus('processing', index, queue.urls.length);
    }
  }
  
  /**
   * Mark URL as completed
   * @param {number} index - URL index
   * @param {Object} result - Analysis result
   */
  async markCompleted(index, result) {
    const queue = await this.getQueue();
    if (!queue) return;
    
    const urlObj = queue.urls.find(u => u.index === index);
    if (urlObj) {
      urlObj.status = 'completed';
      urlObj.result = result;
      await chrome.storage.local.set({ [this.storageKey]: queue });
      
      // Check if all done
      const completed = queue.urls.filter(u => u.status === 'completed' || u.status === 'failed').length;
      await this.updateStatus('processing', completed, queue.urls.length);
      
      if (completed === queue.urls.length) {
        queue.status = 'completed';
        queue.completedAt = Date.now();
        await chrome.storage.local.set({ [this.storageKey]: queue });
        await this.updateStatus('completed', completed, queue.urls.length);
      }
    }
  }
  
  /**
   * Mark URL as failed
   * @param {number} index - URL index
   * @param {string} error - Error message
   */
  async markFailed(index, error) {
    const queue = await this.getQueue();
    if (!queue) return;
    
    const urlObj = queue.urls.find(u => u.index === index);
    if (urlObj) {
      urlObj.status = 'failed';
      urlObj.error = error;
      await chrome.storage.local.set({ [this.storageKey]: queue });
      
      // Check if all done
      const completed = queue.urls.filter(u => u.status === 'completed' || u.status === 'failed').length;
      await this.updateStatus('processing', completed, queue.urls.length);
      
      if (completed === queue.urls.length) {
        queue.status = 'completed';
        queue.completedAt = Date.now();
        await chrome.storage.local.set({ [this.storageKey]: queue });
        await this.updateStatus('completed', completed, queue.urls.length);
      }
    }
  }
  
  /**
   * Pause queue processing
   */
  async pause() {
    const queue = await this.getQueue();
    if (!queue) return;
    
    queue.status = 'paused';
    await chrome.storage.local.set({ [this.storageKey]: queue });
    await this.updateStatus('paused', queue.currentIndex, queue.urls.length);
  }
  
  /**
   * Resume queue processing
   */
  async resume() {
    const queue = await this.getQueue();
    if (!queue) return;
    
    queue.status = 'processing';
    await chrome.storage.local.set({ [this.storageKey]: queue });
    await this.updateStatus('processing', queue.currentIndex, queue.urls.length);
  }
  
  /**
   * Clear queue
   */
  async clear() {
    await chrome.storage.local.remove([this.storageKey, this.statusKey]);
  }
  
  /**
   * Update batch status for UI
   * @param {string} status - Status message
   * @param {number} current - Current index
   * @param {number} total - Total URLs
   */
  async updateStatus(status, current, total) {
    await chrome.storage.local.set({
      [this.statusKey]: {
        status,
        current,
        total,
        percentage: total > 0 ? Math.round((current / total) * 100) : 0,
        timestamp: Date.now()
      }
    });
  }
  
  /**
   * Get batch status
   * @returns {Promise<Object|null>} - Status object
   */
  async getStatus() {
    const data = await chrome.storage.local.get(this.statusKey);
    return data[this.statusKey] || null;
  }
  
  /**
   * Export results as JSON
   * @returns {Promise<Object>} - Results object
   */
  async exportResults() {
    const queue = await this.getQueue();
    if (!queue) return { error: 'No batch job found' };
    
    return {
      jobId: queue.id,
      createdAt: queue.createdAt,
      completedAt: queue.completedAt,
      status: queue.status,
      total: queue.urls.length,
      completed: queue.urls.filter(u => u.status === 'completed').length,
      failed: queue.urls.filter(u => u.status === 'failed').length,
      results: queue.urls.map(u => ({
        url: u.url,
        status: u.status,
        error: u.error,
        result: u.result
      }))
    };
  }
}
