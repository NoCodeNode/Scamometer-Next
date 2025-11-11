// Screenshot Handler - Chrome Extension Compatible
// Handles screenshot capture, watermarking, hash calculation, and downloads

export class ScreenshotHandler {
  constructor() {
    this.overlayInjected = false;
  }

  async captureScreenshot(tabId, url) {
    try {
      // Step 1: Inject overlay with URL and timestamp
      await this.injectOverlay(tabId, url);
      
      // Step 2: Wait for overlay to render
      await this.delay(500);
      
      // Step 3: Capture visible tab
      const dataUrl = await chrome.tabs.captureVisibleTab(null, {
        format: 'png',
        quality: 100
      });
      
      // Step 4: Remove overlay
      await this.removeOverlay(tabId);
      
      // Step 5: Calculate SHA-256 hash
      const hash = await this.calculateHash(dataUrl);
      
      // Step 6: Download image
      const filename = `${hash}.png`;
      await this.downloadImage(dataUrl, filename);
      
      return {
        hash: hash,
        filename: filename,
        capturedAt: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      throw error;
    }
  }

  async injectOverlay(tabId, url) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (url, timestamp) => {
        const overlay = document.createElement('div');
        overlay.id = 'scamometer-screenshot-overlay';
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 12px 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 14px;
          z-index: 2147483647;
          box-shadow: 0 2px 10px rgba(0,0,0,0.2);
          display: flex;
          justify-content: space-between;
          align-items: center;
        `;
        
        overlay.innerHTML = `
          <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <strong>URL:</strong> ${url}
          </div>
          <div style="margin-left: 20px; white-space: nowrap;">
            <strong>Captured:</strong> ${timestamp} UTC
          </div>
        `;
        
        document.body.style.marginTop = '48px';
        document.body.insertBefore(overlay, document.body.firstChild);
      },
      args: [url, timestamp]
    });
    
    this.overlayInjected = true;
  }

  async removeOverlay(tabId) {
    if (!this.overlayInjected) return;
    
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        const overlay = document.getElementById('scamometer-screenshot-overlay');
        if (overlay) overlay.remove();
        document.body.style.marginTop = '';
      }
    });
    
    this.overlayInjected = false;
  }

  async calculateHash(dataUrl) {
    // Create offscreen document for hash calculation
    try {
      await chrome.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: ['BLOBS'],
        justification: 'Calculate SHA-256 hash of screenshot data'
      });
    } catch (error) {
      // Offscreen document may already exist
      if (!error.message.includes('Only a single offscreen')) {
        throw error;
      }
    }
    
    // Send data to offscreen document
    const response = await chrome.runtime.sendMessage({
      type: 'CALCULATE_HASH',
      data: dataUrl
    });
    
    // Close offscreen document
    try {
      await chrome.offscreen.closeDocument();
    } catch (error) {
      // Ignore if already closed
    }
    
    return response.hash;
  }

  async downloadImage(dataUrl, filename) {
    // Trigger download
    await chrome.downloads.download({
      url: dataUrl,
      filename: filename,
      saveAs: false // Auto-save to downloads folder
    });
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}