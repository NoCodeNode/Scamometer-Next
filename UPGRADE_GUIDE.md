# Scamometer v3.0 - Batch Processing & Advanced Features

## 🚀 What's New in v3.0

This major update transforms Scamometer from a single-URL analysis tool into a production-grade batch processing system with advanced features for large-scale data analysis and external system integration.

---

## ✨ New Features

### 📦 Batch Processing
**Analyze hundreds of URLs automatically**

- **CSV Upload**: Drag-and-drop or browse to upload CSV files
- **Format**: One URL per row in the first column
- **Sequential Processing**: Processes URLs one at a time to manage resources
- **Background Tabs**: Opens each URL in an inactive tab for analysis
- **Progress Tracking**: Real-time progress bar with "Processing URL X of N" status
- **Pause/Resume**: Interrupt and resume batch processing at any time
- **Queue Persistence**: Survives browser restarts - never lose progress

**How to Use:**
1. Click the extension icon
2. Navigate to "Batch Processing" tab
3. Upload your CSV file
4. Click "Start Batch Analysis"
5. Watch the progress bar update in real-time
6. View results in the Report Dashboard when complete

---

### 📊 Report Dashboard
**Comprehensive analytics for batch results**

**Features:**
- **Summary Statistics**: Total URLs, Success count, Failed count, Average score
- **Searchable Table**: Filter results by URL in real-time
- **Sortable Columns**: Click headers to sort by URL, score, or status
- **Detail View**: Click any result to view full analysis
- **Color-Coded Scores**: Green (low risk), yellow (medium), red (high)
- **Status Tracking**: Completed, Failed, Pending states

**Export Options:**
- **Export to PDF**: Formatted text report with all results
- **Export to JSON**: Raw data for integration with other tools

---

### 📸 Screenshot Capture
**Automatically capture and save page screenshots**

- **Timestamp Overlay**: Each screenshot includes URL and timestamp banner
- **Format**: YYYY-MM-DD HH:MM:SS
- **SHA-256 Hash**: Unique filename based on content hash
- **Auto-Download**: Screenshots saved to default downloads folder
- **Filename**: `<sha256_hash>.png` for easy deduplication

**Example:**
```
Screenshot of https://example.com
Captured: 2025-11-11 14:30:45
Filename: a1b2c3d4e5f6789...xyz.png
```

---

### 🔗 Webhook Integration
**Connect Scamometer to your external systems**

#### Outgoing Webhooks
**Receive batch results automatically**

Configure in Options → Webhook Integration:
- **Webhook URL**: Your server endpoint
- **Enable/Disable**: Toggle notifications on/off
- **Authorization**: Optional header for authenticated endpoints
- **Test Webhook**: Verify configuration before use

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
      "screenshot": {
        "hash": "a1b2c3d4...",
        "filename": "a1b2c3d4....png"
      }
    }
  ]
}
```

#### Incoming API
**Trigger batch processing from external websites**

1. Whitelist trusted domains in Options → Webhook Integration
2. External websites can send messages:

```javascript
chrome.runtime.sendMessage(
  EXTENSION_ID,
  {
    type: 'START_BATCH',
    urls: ['https://url1.com', 'https://url2.com']
  },
  (response) => {
    console.log(response); // { success: true }
  }
);
```

**Supported Commands:**
- `START_BATCH`: Start batch processing
- `GET_STATUS`: Get current batch status
- `GET_RESULTS`: Retrieve batch results

---

### ⚠️ Enhanced Error Handling

#### API Key Recovery
- **Automatic Detection**: Detects 401/403 errors from Gemini API
- **Pause Processing**: Automatically pauses batch on API key failure
- **Modal Dialog**: Prompts for new API key with clear instructions
- **Seamless Resume**: Continues from interrupted URL after key update
- **No Data Loss**: Queue preserved during recovery

#### URL Error Logging
- **Failed URLs Tracked**: All errors logged with messages
- **Continue Processing**: One failure doesn't stop the batch
- **Dashboard Display**: Failed URLs marked with red badges
- **Error Details**: View error message for each failed URL
- **Export Included**: Failed URLs included in export reports

---

## 🎨 New UI/UX

### Tabbed Interface
The popup now features three tabs:

1. **Single URL**: Original analysis (maintained for quick checks)
2. **Batch Processing**: CSV upload and progress tracking
3. **Report Dashboard**: Analytics and export options

### Modern Design
- **500px Width**: More space for data display
- **Responsive Layout**: Adapts to content
- **Smooth Animations**: Tab transitions and progress updates
- **Color-Coded Status**: Visual feedback at a glance
- **Drag-and-Drop**: Intuitive file upload

---

## 📋 Updated Permissions

New permissions required for batch processing:
- `downloads`: Screenshot capture and export
- `activeTab`: Access to current tab for analysis

All data remains local - no cloud storage or telemetry.

---

## 🔧 Technical Details

### Architecture
- **Service Worker**: Orchestrates batch processing
- **Content Scripts**: Extract page content and inject overlays
- **Queue Management**: chrome.storage.local for persistence
- **Sequential Processing**: One URL at a time for resource efficiency

### Performance
- **Speed**: ~5-10 seconds per URL (depends on page load)
- **100 URLs**: Approximately 10-20 minutes
- **Memory**: ~50-100MB per tab (cleaned after each URL)
- **Screenshots**: ~200KB-2MB each (saved to disk)

### Storage
- **Queue**: Persisted in chrome.storage.local
- **Results**: Cached per URL for quick access
- **Screenshots**: Saved to downloads folder
- **Capacity**: 10MB total storage limit

---

## 📖 Documentation

### New Files
- **TECHNICAL_SPEC.md**: Comprehensive technical specification (22KB)
- **batch-utils.js**: Batch processing utilities
- **webhook.js**: Webhook integration module
- **popup-tabs.html/js**: New tabbed interface

### Updated Files
- **manifest.json**: New permissions and popup reference
- **background.js**: Batch processing orchestration
- **options.html/js**: Webhook configuration UI

---

## 🧪 Testing

### Manual Testing Required
- [ ] Upload CSV with 10-20 URLs
- [ ] Verify progress bar updates correctly
- [ ] Check screenshots in downloads folder
- [ ] Test pause/resume functionality
- [ ] Validate API key recovery flow
- [ ] Test webhook POST requests
- [ ] Verify export formats (PDF, JSON)
- [ ] Check memory usage with 50+ URLs

### Browser Compatibility
- Chrome/Chromium ✅
- Microsoft Edge ✅
- Brave Browser ✅
- Opera (Chromium-based) ✅

---

## 🚦 Getting Started

### Installation
1. Clone repository or download ZIP
2. Open `chrome://extensions/`
3. Enable Developer Mode
4. Click "Load unpacked"
5. Select extension directory

### Configuration
1. Click extension icon
2. Click "Options"
3. Enter your Gemini API key
4. (Optional) Configure webhook settings
5. (Optional) Whitelist domains for external API

### First Batch Job
1. Create CSV file with URLs in first column
2. Open extension popup
3. Go to "Batch Processing" tab
4. Upload your CSV
5. Click "Start Batch Analysis"
6. Monitor progress
7. View results in "Report Dashboard"

---

## 🔐 Security & Privacy

### Data Protection
- All processing happens locally
- No telemetry or tracking
- API keys encrypted by browser
- User controls their own API key (BYOK)

### Webhook Security
- Domain whitelisting for external API
- Optional authorization headers
- HTTPS recommended for webhook URLs
- No credentials in webhook payloads

### Input Validation
- URL format validation
- CSV sanitization
- HTML escaping in UI
- Domain whitelist validation

---

## 🎯 Use Cases

### Security Research
- Analyze lists of suspicious domains
- Track phishing campaigns
- Generate reports for incidents
- Archive screenshots for evidence

### IT Security Teams
- Batch check employee-reported URLs
- Integrate with ticketing systems via webhook
- Generate compliance reports
- Automate security assessments

### Bug Bounty Hunters
- Quick analysis of multiple targets
- Export data for reports
- Screenshot evidence collection
- API integration with tools

### Academic Research
- Large-scale phishing studies
- Dataset generation for ML models
- Statistical analysis of scam patterns
- Reproducible research with exports

---

## 🛠️ Advanced Usage

### Custom CSV Formats
```csv
https://example.com
https://test.site
"https://quoted-url.com"
https://another.site
```

### Webhook Server Example (Node.js)
```javascript
const express = require('express');
const app = express();

app.post('/webhook', express.json(), (req, res) => {
  console.log('Batch results received:', req.body.summary);
  // Process results...
  res.json({ success: true });
});

app.listen(3000);
```

### External Integration Example
```javascript
// From your web dashboard
const EXTENSION_ID = 'your-extension-id';

chrome.runtime.sendMessage(
  EXTENSION_ID,
  {
    type: 'START_BATCH',
    urls: fetchUrlsFromDatabase()
  },
  (response) => {
    if (response.success) {
      console.log('Batch started successfully');
    }
  }
);
```

---

## 📈 Roadmap

### Planned Enhancements
- Parallel processing (2-3 tabs simultaneously)
- Advanced PDF generation with charts
- Scheduled batch jobs
- Email notifications
- Google Sheets integration
- Machine learning for offline detection
- OCR for image-based scam detection

---

## 🆘 Support

### Getting Help
- **Issues**: [GitHub Issues](https://github.com/NoCodeNode/Scamometer-Next/issues)
- **Email**: hello@arnabmandal.com
- **Documentation**: README.md, TECHNICAL_SPEC.md, TESTING.md

### Common Issues

**Q: Batch processing is slow**
A: Processing speed depends on page load times and API response. Consider:
- Checking your internet connection
- Reducing batch size for testing
- Ensuring API key has sufficient quota

**Q: Screenshots not saving**
A: Check:
- Downloads permission granted
- Default download folder accessible
- Sufficient disk space

**Q: Webhook not receiving data**
A: Verify:
- Webhook URL is correct
- Authorization header if required
- Endpoint accepts POST requests
- Server is reachable from browser

---

## 📜 License

MIT License - See LICENSE file for details

---

## 👨‍💻 Author

**Arnab Mandal**
- 📧 Email: hello@arnabmandal.com
- 🌐 Website: [arnabmandal.com](https://arnabmandal.com)
- 💻 GitHub: [@NoCodeNode](https://github.com/NoCodeNode)

---

## 🙏 Acknowledgments

- Google Gemini AI for powerful language models
- Chrome Extensions API team
- Open source community
- Users providing feedback and feature requests

---

**Built with ❤️ for a safer internet**

⭐ Star this repo if you find it useful!

[Report Bug](https://github.com/NoCodeNode/Scamometer-Next/issues) · [Request Feature](https://github.com/NoCodeNode/Scamometer-Next/issues) · [View Technical Spec](TECHNICAL_SPEC.md)
