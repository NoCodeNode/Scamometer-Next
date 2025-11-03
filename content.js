// Built by Arnab Mandal — contact: hello@arnabmandal.com

// content.js — updated v1.4 (animations and strong warning overlay)
let overlayEl = null;
let progressEl = null;

// Create/update a top-fixed progress bar on the page
function ensureProgressBar() {
  if (progressEl) return progressEl;
  progressEl = document.createElement('div');
  progressEl.id = 'scamometer-progress';
  progressEl.style.position = 'fixed';
  progressEl.style.top = '0'; progressEl.style.left = '0';
  progressEl.style.width = '100%'; progressEl.style.height = '6px';
  progressEl.style.background = 'rgba(15,23,42,0.6)';
  progressEl.style.zIndex = '2147483646';
  const bar = document.createElement('div');
  bar.id = 'scamometer-progress-bar';
  bar.style.height = '100%';
  bar.style.width = '0%';
  bar.style.transition = 'width .3s ease';
  bar.style.background = '#06b6d4';
  const label = document.createElement('div');
  label.id = 'scamometer-progress-label';
  label.textContent = 'Starting…';
  label.style.position = 'fixed';
  label.style.top = '8px'; label.style.left = '8px';
  label.style.padding = '4px 6px';
  label.style.fontSize = '12px';
  label.style.borderRadius = '6px';
  label.style.background = 'rgba(2,6,23,0.85)';
  label.style.color = 'white';
  label.style.zIndex = '2147483647';
  label.style.pointerEvents = 'none';
  progressEl.appendChild(bar);
  document.documentElement.appendChild(progressEl);
  document.documentElement.appendChild(label);
  progressEl._label = label;
  return progressEl;
}

// Update the on-page progress bar
function updateProgress(percent, text) {
  ensureProgressBar();
  const bar = document.getElementById('scamometer-progress-bar');
  const label = document.getElementById('scamometer-progress-label');
  bar.style.width = Math.max(0, Math.min(100, percent)) + '%';
  if (text) label.textContent = text;
  if (percent >= 100) {
    // Fade out when done
    label.textContent = 'Complete';
    bar.style.width = '100%';
    setTimeout(() => {
      if (progressEl) {
        progressEl._label?.remove();
        progressEl.remove();
        progressEl = null;
      }
    }, 500);
  }
}

// Extract visible text for analysis
function extractSmartText() {
  try {
    const parts = [];
    const main = document.querySelector('main');
    const article = document.querySelector('article');
    const forms = Array.from(document.querySelectorAll('form'));
    const headings = Array.from(document.querySelectorAll('h1,h2,h3'));
    if (main) parts.push(main.innerText);
    if (article) parts.push(article.innerText);
    forms.forEach(f => {
      const txt = (f.innerText || '').trim();
      if (txt) parts.push(txt);
      const inputs = Array.from(f.querySelectorAll('input,button,label'));
      const labels = inputs.map(el => el.placeholder || el.ariaLabel || el.innerText || '').join(' ');
      if (labels) parts.push(labels);
    });
    if (headings.length) parts.push(headings.map(h => h.innerText).join('\n'));
    const combined = parts.join('\n').replace(/\s+\n/g, '\n').trim();
    if (combined.length < 200) return document.body.innerText.slice(0, 20000);
    return combined.slice(0, 20000);
  } catch {
    return document.body?.innerText?.slice(0, 20000) || '';
  }
}

// Apply a red overlay/modal if score is high
function applyOverlay(score) {
  const shouldWarn = typeof score === 'number' && score >= 70;
  if (!shouldWarn) return removeOverlay();
  if (overlayEl) return;

  // Semi-transparent overlay (less intrusive)
  overlayEl = document.createElement('div');
  overlayEl.id = 'scamometer-overlay';
  overlayEl.style.position = 'fixed';
  overlayEl.style.inset = '0';
  overlayEl.style.background = 'rgba(0, 0, 0, 0.5)';
  overlayEl.style.backdropFilter = 'blur(3px)';
  overlayEl.style.zIndex = '2147483646';
  overlayEl.style.pointerEvents = 'auto';
  overlayEl.style.opacity = '0';
  overlayEl.style.transition = 'opacity .4s ease';
  overlayEl.style.display = 'flex';
  overlayEl.style.alignItems = 'center';
  overlayEl.style.justifyContent = 'center';
  document.documentElement.appendChild(overlayEl);
  
  // Enhanced warning modal
  const modal = document.createElement('div');
  modal.id = 'scamometer-modal';
  modal.style.position = 'relative';
  modal.style.background = 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)';
  modal.style.color = 'white';
  modal.style.padding = '32px';
  modal.style.maxWidth = '500px';
  modal.style.zIndex = '2147483647';
  modal.style.borderRadius = '16px';
  modal.style.boxShadow = '0 20px 60px rgba(0,0,0,0.5)';
  modal.style.textAlign = 'center';
  modal.style.transform = 'scale(0.8)';
  modal.style.transition = 'transform .4s ease';
  modal.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  
  modal.innerHTML = `
    <div style="font-size:64px; margin-bottom:16px; animation: shake 0.5s;">⚠️</div>
    <h2 style="margin:0 0 12px; font-size:24px; font-weight:700;">High Risk Detected</h2>
    <p style="margin:0 0 24px; font-size:16px; opacity:0.95; line-height:1.5;">
      Scamometer has flagged this website as potentially dangerous. 
      This site may be attempting to scam or phish information from you.
    </p>
    <div style="display:flex; gap:12px; justify-content:center;">
      <button id="scam-dismiss" style="
        padding:12px 24px; border-radius:10px; border:2px solid white; 
        background:transparent; color:white; cursor:pointer; font-size:14px; font-weight:600;
        transition: all 0.2s;
      ">I Understand (Dismiss)</button>
      <button id="scam-leave" style="
        padding:12px 24px; border-radius:10px; border:none; 
        background:white; color:#dc2626; cursor:pointer; font-size:14px; font-weight:600;
        transition: all 0.2s;
      ">Leave This Site</button>
    </div>
  `;
  
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: rotate(0deg); }
      25% { transform: rotate(-5deg); }
      75% { transform: rotate(5deg); }
    }
    #scam-dismiss:hover { background: rgba(255,255,255,0.1); transform: scale(1.05); }
    #scam-leave:hover { background: #f9fafb; transform: scale(1.05); }
  `;
  document.head.appendChild(style);
  
  overlayEl.appendChild(modal);
  overlayEl._modal = modal;
  overlayEl._style = style;
  
  // Fade in
  setTimeout(() => {
    overlayEl.style.opacity = '1';
    modal.style.transform = 'scale(1)';
  }, 10);
  
  // Persistent corner badge
  const badge = document.createElement('div');
  badge.textContent = '⚠️ High Risk';
  badge.style.position = 'fixed';
  badge.style.top = '12px'; 
  badge.style.right = '12px';
  badge.style.zIndex = '2147483648';
  badge.style.background = '#dc2626';
  badge.style.color = 'white';
  badge.style.fontSize = '12px';
  badge.style.fontWeight = '600';
  badge.style.padding = '8px 12px';
  badge.style.borderRadius = '8px';
  badge.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
  badge.style.pointerEvents = 'auto';
  badge.style.cursor = 'pointer';
  badge.title = 'Click to view warning';
  badge.style.transition = 'all 0.2s';
  badge.addEventListener('click', () => {
    if (overlayEl.style.display === 'none') {
      overlayEl.style.display = 'flex';
      setTimeout(() => overlayEl.style.opacity = '1', 10);
    }
  });
  badge.addEventListener('mouseenter', () => {
    badge.style.transform = 'scale(1.1)';
  });
  badge.addEventListener('mouseleave', () => {
    badge.style.transform = 'scale(1)';
  });
  document.documentElement.appendChild(badge);
  overlayEl._badge = badge;

  // Button handlers
  modal.querySelector('#scam-dismiss').addEventListener('click', () => {
    overlayEl.style.opacity = '0';
    setTimeout(() => {
      overlayEl.style.display = 'none';
    }, 400);
  });
  
  modal.querySelector('#scam-leave').addEventListener('click', () => {
    window.location.href = 'about:blank';
  });
}

// Remove overlay/modal
function removeOverlay() {
  if (overlayEl) {
    overlayEl._badge?.remove();
    overlayEl._modal?.remove();
    overlayEl._style?.remove();
    overlayEl.remove();
    overlayEl = null;
  }
}

// Handle messages (scrape request, overlay, progress)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'SCRAPE_REQUEST') {
    const text = extractSmartText();
    sendResponse({ text });
    return true;
  }
  if (msg?.type === 'OVERLAY') {
    applyOverlay(msg.score);
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === 'PROGRESS') {
    updateProgress(msg.percent ?? 0, msg.label || '');
    sendResponse({ ok: true });
    return true;
  }
});
