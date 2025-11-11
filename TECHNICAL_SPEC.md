# Technical Specification: Scamometer Chrome Extension Upgrade
## Production-Grade Batch Processing & Advanced Features

**Version:** 3.0  
**Date:** November 11, 2025  
**Author:** Lead Software Architect  
**Repository:** NoCodeNode/Scamometer-Next

---

## 1. Architecture & Core Components

### 1.1 Manifest V3 Compliance

The extension adheres to Chrome Web Store policies and uses Manifest V3 with the following components:

**Required Permissions:**
- `tabs` - Access to tab information and manipulation
- `storage` - Local and sync storage for configuration and queue management
- `scripting` - Content script injection and execution
- `downloads` - Screenshot download capability
- `activeTab` - Access to currently active tab

**Core Components:**
- **Service Worker (`background.js`)**: Main orchestration engine for batch processing, API calls, and webhook notifications
- **Content Scripts (`content.js`)**: Page content extraction, screenshot overlay injection, and progress indicators
- **Action Popup (`popup-tabs.html/js`)**: Tabbed user interface for single URL analysis, batch processing, and reporting
- **Options Page (`options.html/js`)**: Configuration interface for API keys, webhooks, and domain whitelisting

### 1.2 Data Flow Architecture

#### Single URL Analysis Flow:
```
User Navigation → Tab Load Event → Background Service Worker
    ↓
Content Script Injection → Page Content Extraction
    ↓
DNS/RDAP Lookups (Cached) → Technical Report Generation
    ↓
Gemini API Analysis → Result Storage (chrome.storage.local)
    ↓
Badge Update + UI Notification → Optional Warning Overlay
```

#### Batch Processing Flow:
```
CSV Upload → URL Parsing → Queue Initialization (chrome.storage.local)
    ↓
Sequential Processing Loop:
    For each URL:
        1. Open in background tab (inactive)
        2. Wait for page load + content settlement
        3. Extract content via content script
        4. Capture screenshot with overlay
        5. Calculate SHA-256 hash
        6. Download screenshot as <hash>.png
        7. Run full analysis pipeline
        8. Store result in queue
        9. Close tab
        10. Update progress status
    ↓
Queue Completion → Webhook Notification (if configured)
    ↓
Dashboard Update → Results Available for Export
```

### 1.3 Storage Architecture

**chrome.storage.local Keys:**
- `analysis::<origin><pathname>` - Cached analysis results per URL
- `batch::queue` - Current batch processing queue state
- `batch::status` - Real-time batch processing status
- `apiKey` - Gemini API key
- `modelName` - Selected Gemini model
- `whitelist` - Array of whitelisted domains
- `blacklist` - Array of blacklisted domains
- `webhookUrl` - Webhook endpoint URL
- `webhookEnabled` - Webhook enabled state
- `webhookAuth` - Optional webhook authorization header
- `allowedDomains` - Array of domains allowed to trigger external API

---

## 2. UI/UX Design

### 2.1 Main Popup Interface (500px width, tabbed)

#### Tab 1: Single URL Analysis
**Purpose:** Existing single-page analysis functionality (maintained for backward compatibility)

**Components:**
- Header with extension icon and title
- API key prompt (if not configured)
- Loading state with animated progress bar
- Analysis results card:
  - Animated gauge visualization (0-100 score)
  - Risk verdict and reasoning
  - Positive indicators (green tags)
  - Red flags (red tags)
  - Collapsible technical details section
- Action toolbar:
  - Re-run analysis button
  - Copy report to clipboard
  - Export as text file
  - Options link

#### Tab 2: Batch Processing
**Purpose:** Bulk URL analysis interface

**Components:**
- CSV Upload Area:
  - Drag-and-drop zone (dashed border, hover effects)
  - File input (hidden, triggered by click)
  - Visual feedback for file selection
  - Validation: One URL per row, first column
- Start Batch Button:
  - Disabled until valid CSV loaded
  - Displays URL count
- Progress View (shown during processing):
  - Current status message
  - Progress bar (0-100%)
  - Real-time status: "Processing URL X of N"
  - Pause/Resume controls
  - Current percentage display
- Completion State:
  - Summary statistics
  - Link to dashboard
  - Option to start new batch

#### Tab 3: Report Dashboard
**Purpose:** Comprehensive batch results analytics

**Components:**
- Summary Statistics (4-card grid):
  - Total URLs Processed
  - Successful Analyses (green)
  - Failed URLs (red)
  - Average Risk Score (cyan)
- Search Bar:
  - Real-time filtering by URL text
  - Placeholder: "Search URLs..."
- Export Buttons:
  - Export to PDF (generates formatted text report)
  - Export to JSON (raw data export)
- Results Table:
  - Columns: URL, Score, Status, Actions
  - Sortable headers
  - Clickable rows
  - Score badges (color-coded: green/yellow/red)
  - View button per row
- Detail View (modal or inline):
  - Full analysis for selected URL
  - Screenshot link (if available)
  - All analysis data from single-URL view

### 2.2 Modal Dialogs

#### API Key Error Modal
**Trigger:** Gemini API returns 401/403 during batch processing

**Components:**
- Warning icon and title
- Error explanation
- Text input for new API key
- Cancel button (pauses batch)
- Save & Resume button (updates key, resumes batch)
- Backdrop blur effect

### 2.3 Design System

**Colors:**
- Background: `#0b1020`
- Card: `#0f172a`
- Border: `#1f2937`
- Text: `#e2e8f0`
- Muted: `#94a3b8`
- Green: `#16a34a` (low risk)
- Yellow: `#eab308` (medium risk)
- Red: `#dc2626` (high risk)
- Cyan: `#06b6d4` (primary action)

**Typography:**
- System font stack: `ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto`
- Base size: 13px
- Headers: 16px (h3), 18px (h2), 24px (h1)

**Interactions:**
- Hover effects: `translateY(-1px)`, border color to cyan
- Transitions: `0.2s ease` for most properties
- Focus states: cyan border
- Button states: hover, active, disabled

---

## 3. Functional Requirements (Feature Breakdown)

### 3.1 CSV Batch Processing

**Implementation:** `batch-utils.js` + `popup-tabs.js`

**Features:**
- File input accepts `.csv` files
- Parser extracts first column from each row
- Handles quoted CSV values
- URL validation before queueing
- Duplicate detection (optional)
- Queue stored in `chrome.storage.local` for persistence

**Error Handling:**
- Invalid URLs skipped with warning
- Empty files rejected
- Non-CSV files rejected
- Parse errors logged

**Technical Details:**
```javascript
function parseCSV(content) {
  // Split by newline, trim, filter empty
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);
  const urls = [];
  
  for (const line of lines) {
    // Extract first column
    let firstCol = line.split(',')[0].trim();
    // Remove quotes if present
    if (firstCol.startsWith('"') && firstCol.endsWith('"')) {
      firstCol = firstCol.slice(1, -1);
    }
    // Validate URL
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
```

### 3.2 Automated Background Tab Workflow

**Implementation:** `background.js::processNextBatchUrl()`

**Workflow:**
1. Retrieve next pending URL from queue
2. Create new tab with `active: false` parameter
3. Wait for `chrome.tabs.onUpdated` event with `status === 'complete'`
4. Additional 2-second delay for dynamic content
5. Inject content script and extract page content
6. Execute analysis pipeline (DNS, RDAP, Gemini)
7. Capture screenshot with overlay
8. Store result in queue
9. Close tab via `chrome.tabs.remove()`
10. Process next URL after 1-second delay

**Resource Management:**
- Sequential processing (one URL at a time)
- Tab cleanup after each URL
- Memory-efficient queue updates
- Timeout handling (30s per page load)

### 3.3 Screenshot Capture & Storage

**Implementation:** `background.js::captureScreenshotWithOverlay()`

**Process:**
1. Inject temporary overlay div at top of page:
   ```javascript
   overlay.style = {
     position: 'fixed',
     top: '0',
     left: '0',
     width: '100%',
     background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
     color: 'white',
     padding: '12px 16px',
     zIndex: '2147483647',
     fontFamily: 'monospace',
     fontSize: '13px'
   };
   overlay.innerHTML = `
     <div style="display:flex; justify-content:space-between;">
       <div>${fullUrl}</div>
       <div>${timestamp}</div>
     </div>
   `;
   ```
2. Wait 500ms for overlay to render
3. Capture screenshot: `chrome.tabs.captureVisibleTab(null, { format: 'png' })`
4. Remove overlay from page
5. Convert base64 data URL to ArrayBuffer
6. Calculate SHA-256 hash:
   ```javascript
   const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
   const hashArray = Array.from(new Uint8Array(hashBuffer));
   const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
   ```
7. Download via `chrome.downloads.download()`:
   ```javascript
   await chrome.downloads.download({
     url: dataUrl,
     filename: `${hash}.png`,
     saveAs: false
   });
   ```

**Storage Location:** User's default downloads folder

**Filename Format:** `<sha256_hash>.png` (e.g., `a1b2c3d4e5f6...xyz.png`)

**Timestamp Format:** `YYYY-MM-DD HH:MM:SS` (e.g., `2025-11-11 14:30:45`)

### 3.4 Data Export

#### PDF Export (Text-Based Report)
**Implementation:** `popup-tabs.js::exportAsPDF()`

**Format:**
```
SCAMOMETER BATCH ANALYSIS REPORT
============================================================

Generated: 2025-11-11 14:30:45
Total URLs: 100
Successful: 95
Failed: 5

============================================================

RESULTS:
------------------------------------------------------------

1. https://example.com
   Status: completed
   Score: 15/100
   Verdict: ✓ Legitimate Site
   Reason: Well-established domain with proper SSL...

2. https://suspicious.site
   Status: completed
   Score: 85/100
   Verdict: ⚠️ High Risk
   Reason: Recently registered domain, suspicious content...

...

============================================================
Report generated by Scamometer
https://github.com/NoCodeNode/Scamometer-Next
```

**Download:** Triggers browser download with filename `scamometer-batch-report-<timestamp>.txt`

#### JSON Export
**Implementation:** `popup-tabs.js::exportAsJSON()`

**Structure:**
```json
{
  "total": 100,
  "completed": 95,
  "failed": 5,
  "pending": 0,
  "results": [
    {
      "url": "https://example.com",
      "status": "completed",
      "error": null,
      "result": {
        "when": 1699700000000,
        "url": "https://example.com",
        "ai": {
          "verdict": "✓ Legitimate Site",
          "scamometer": 15,
          "reason": "Well-established domain...",
          "positives": ["Valid SSL", "Old domain"],
          "negatives": []
        },
        "raw": { ... },
        "dnsResults": { ... },
        "rdap": { ... }
      }
    },
    ...
  ]
}
```

**Download:** Triggers browser download with filename `scamometer-batch-results-<timestamp>.json`

### 3.5 External Integration (Webhook)

**Implementation:** `webhook.js` + `background.js`

#### Outgoing Webhooks (POST to external server)
**Configuration:** Options page (Webhook Integration section)

**Fields:**
- Webhook URL (required)
- Enable/Disable toggle
- Authorization header (optional, e.g., `Bearer token123`)

**Payload Structure:**
```json
{
  "timestamp": 1699700000000,
  "completed": "2025-11-11T14:30:45.000Z",
  "summary": {
    "total": 100,
    "completed": 95,
    "failed": 5,
    "pending": 0
  },
  "results": [
    {
      "url": "https://example.com",
      "status": "completed",
      "score": 15,
      "verdict": "✓ Legitimate Site",
      "reason": "Well-established domain...",
      "error": null,
      "screenshot": {
        "hash": "a1b2c3d4...",
        "filename": "a1b2c3d4....png",
        "timestamp": "2025-11-11 14:30:45"
      }
    },
    ...
  ]
}
```

**Trigger:** Automatically sent when batch processing completes

**Error Handling:** Failures logged to console, do not block completion

#### Incoming API (External Message Listener)
**Implementation:** `webhook.js::registerWebhookListener()`

**Configuration:** Options page (External API Access section)

**Whitelisting:** Add trusted domain origins (e.g., `https://dashboard.company.com`)

**Message Format:**
```javascript
// External website sends:
chrome.runtime.sendMessage(
  EXTENSION_ID,
  {
    type: 'START_BATCH',
    urls: ['https://url1.com', 'https://url2.com', ...]
  },
  (response) => {
    console.log(response); // { success: true, message: 'Batch processing started' }
  }
);
```

**Supported Message Types:**
- `START_BATCH` - Initiate batch processing with URL array
- `GET_STATUS` - Retrieve current batch status
- `GET_RESULTS` - Retrieve batch results

**Security:** Only whitelisted origins can send messages

---

## 4. Error Handling

### 4.1 Gemini API Key Failure

**Detection:** HTTP 401 or 403 response from Gemini API

**Immediate Actions:**
1. Pause batch processing via `pauseBatchProcessing()`
2. Update queue status to `'paused'`
3. Send message to popup: `chrome.runtime.sendMessage({ type: 'API_KEY_ERROR' })`

**UI Response:**
1. Display modal dialog with:
   - Warning icon: ⚠️
   - Title: "API Key Required"
   - Message: "The Gemini API key failed. Please enter a new API key to continue batch processing."
   - Text input for new API key
   - Cancel button (keeps queue paused)
   - Save & Resume button
2. Modal backdrop with blur effect
3. Non-dismissible (must choose an action)

**Recovery Process:**
1. User enters new API key
2. Click "Save & Resume"
3. Validate key format (non-empty)
4. Store in `chrome.storage.local.set({ apiKey: newKey })`
5. Call `resumeBatchProcessing()`
6. Processing continues from interrupted URL
7. Display toast: "API key updated, resuming..."

**Technical Implementation:**
```javascript
async function callGemini(apiKey, model, analysis) {
  // ... API call logic
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      if (batchProcessingActive) {
        await pauseBatchProcessing();
        chrome.runtime.sendMessage({ type: 'API_KEY_ERROR', status: res.status });
      }
      throw new Error(`Gemini API authentication error: ${res.status}`);
    }
    // ... other errors
  }
  // ... response processing
}
```

### 4.2 URL Loading Errors

**Error Types:**
- HTTP 404, 500, etc.
- DNS resolution failures
- Timeout (30s)
- Connection refused
- SSL certificate errors

**Handling:**
1. Catch error in `processNextBatchUrl()`
2. Update URL status to `'failed'`
3. Store error message in queue: `nextUrl.error = error.message`
4. Continue with next URL (do not halt batch)
5. Close tab if still open
6. Log error to console

**Dashboard Display:**
- Failed URLs shown with red "Failed" badge
- Error message displayed in detail view
- Included in export reports
- Counted in summary statistics

**Technical Implementation:**
```javascript
try {
  const tab = await chrome.tabs.create({ url: nextUrl.url, active: false });
  await waitForTabLoad(tab.id);
  // ... processing logic
} catch (error) {
  console.error('Batch processing error:', error);
  nextUrl.status = 'failed';
  nextUrl.error = error.message;
  await chrome.storage.local.set({ 'batch::queue': queue });
  
  if (batchTabId) {
    try { await chrome.tabs.remove(batchTabId); } catch {}
    batchTabId = null;
  }
  
  setTimeout(() => processNextBatchUrl(), 1000);
}
```

### 4.3 Additional Error Scenarios

#### Queue Persistence
- Queue stored in `chrome.storage.local` survives browser restarts
- On extension reload, check for paused/incomplete queue
- Option to resume or clear

#### Memory Management
- Sequential processing prevents memory buildup
- Tab cleanup after each URL
- Content script injection cleanup
- Large CSV files handled via streaming (future enhancement)

#### Network Timeouts
- 30s timeout for page loads
- 20s timeout for Gemini API calls
- 12s timeout for DNS/RDAP queries
- Graceful degradation on timeout

#### Invalid Data
- CSV parse errors: skip invalid lines
- Malformed URLs: validation before queueing
- Invalid screenshot data: log and continue
- Missing analysis results: mark as failed

---

## 5. Implementation Status

### Completed Features ✅
1. ✅ Manifest V3 compliance with all required permissions
2. ✅ Batch processing queue management system
3. ✅ CSV parser with URL validation
4. ✅ Tabbed popup interface (Single URL, Batch, Dashboard)
5. ✅ Automated background tab workflow
6. ✅ Screenshot capture with timestamp overlay
7. ✅ SHA-256 hash calculation and file download
8. ✅ PDF export (text-based formatted report)
9. ✅ JSON export (structured batch results)
10. ✅ Gemini API key error detection and recovery modal
11. ✅ Pause/Resume batch processing
12. ✅ URL loading error handling and logging
13. ✅ Webhook outgoing notifications
14. ✅ Webhook incoming API with domain whitelisting
15. ✅ Report dashboard with statistics and search
16. ✅ Collapsible technical details in single URL view

### Code Quality ✅
- Modular architecture with separate concerns
- Comprehensive error handling
- Input validation throughout
- Secure storage practices
- Memory-efficient processing
- Production-ready code with comments

### Testing Requirements 🔄
- Manual testing of batch processing with various CSV sizes
- Screenshot capture validation
- API key error recovery testing
- Webhook endpoint integration testing
- Memory usage monitoring during large batches
- Browser compatibility testing (Chrome, Edge, Brave)

---

## 6. Security Considerations

### Data Protection
- All processing happens locally in the browser
- API keys stored in `chrome.storage.local` (encrypted by browser)
- No telemetry or third-party tracking
- User controls their own API key (BYOK)

### Input Validation
- URL format validation before processing
- CSV content sanitization
- HTML escaping in UI displays
- Domain whitelist validation
- Webhook URL validation

### Permission Scope
- Minimal permissions requested
- No `<all_urls>` permission (content script injected on-demand)
- Downloads permission only for screenshot functionality
- No access to browsing history or cookies

### External Integration Security
- Webhook domain whitelisting
- Optional authorization headers
- No credentials stored in webhook payload
- External API messages from whitelisted origins only

---

## 7. Performance Characteristics

### Batch Processing Speed
- Sequential processing: ~5-10 seconds per URL (depends on page load time + API latency)
- 100 URLs ≈ 10-20 minutes
- Configurable delays between requests (default: 1s)

### Memory Usage
- Background tab approach: ~50-100MB per tab (cleared after each URL)
- Queue storage: ~1KB per URL
- Screenshot storage: ~200KB-2MB per image (saved to disk, not kept in memory)

### Storage Limits
- `chrome.storage.local`: 10MB total (10,000 URLs with minimal data)
- Screenshots: Limited only by disk space
- Analysis cache: Automatic cleanup possible (future enhancement)

### API Rate Limits
- Gemini API: Varies by plan (default 60 requests/minute)
- DNS/RDAP: Cached for 24 hours, reduces external calls

---

## 8. Future Enhancements

### Potential Improvements
1. Parallel processing (2-3 tabs simultaneously)
2. Advanced PDF generation with charts (using libraries like jsPDF)
3. Scheduled batch jobs
4. Email notifications on completion
5. Integration with Google Sheets for CSV import/export
6. Machine learning model for offline detection
7. Browser screenshot analysis (OCR for image-based scams)
8. Custom webhook retry logic with exponential backoff
9. Batch job history and management
10. Export to multiple formats (Excel, XML)

### API Enhancements
1. RESTful API endpoints (via companion server)
2. WebSocket support for real-time updates
3. Batch job queuing from external systems
4. Webhook authentication standards (OAuth, JWT)

---

## 9. Documentation

### User Documentation
- README.md: Feature overview and installation
- TESTING.md: Comprehensive testing guide
- Options page: In-app help text and tooltips

### Developer Documentation
- Code comments throughout
- Function documentation with JSDoc
- Architecture diagrams (this document)
- API integration examples

### Support Resources
- GitHub Issues for bug reports
- Email support: hello@arnabmandal.com
- Community discussions

---

## 10. Deployment Checklist

### Pre-Release
- [ ] Complete manual testing of all features
- [ ] Validate screenshot capture across different page types
- [ ] Test API key error recovery flow
- [ ] Verify webhook integration with test server
- [ ] Check memory usage with large batches (100+ URLs)
- [ ] Browser compatibility testing (Chrome, Edge, Brave)
- [ ] Code review and security audit
- [ ] Update version number in manifest.json
- [ ] Create release notes
- [ ] Update README with new features

### Chrome Web Store Submission
- [ ] Extension packaged (.zip)
- [ ] Store listing prepared (description, screenshots)
- [ ] Privacy policy updated
- [ ] Promotional images (1280x800, 440x280)
- [ ] Category and tags selected
- [ ] Pricing tier confirmed (free)
- [ ] Review and submit

---

## Conclusion

This technical specification provides a comprehensive blueprint for upgrading the Scamometer Chrome extension with production-grade batch processing capabilities. The implementation maintains the existing single-URL analysis functionality while adding powerful new features for large-scale data analysis and external system integration.

**Key Achievements:**
- ✅ Manifest V3 compliant
- ✅ Robust batch processing with queue management
- ✅ Professional tabbed UI with modern design
- ✅ Comprehensive error handling and recovery
- ✅ Advanced export capabilities (PDF, JSON)
- ✅ Webhook integration for external systems
- ✅ Security-first architecture
- ✅ Production-ready code quality

The extension now serves as a powerful tool for security researchers, IT teams, and organizations needing to analyze large numbers of URLs for phishing and scam indicators.

---

**Document Version:** 1.0  
**Last Updated:** November 11, 2025  
**Status:** Implementation Complete, Testing In Progress
