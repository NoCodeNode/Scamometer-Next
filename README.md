# 🧪 Scamometer — AI Phishing & Scam Detector

**Best-in-class browser extension for detecting phishing and scam websites using DNS, RDAP, and Gemini AI analysis.**

Scamometer is a powerful Chrome extension that analyzes websites in real-time to help you identify suspicious or deceptive pages. With a beautiful modern UI, comprehensive features, and advanced AI analysis, it's your first line of defense against online threats.

## ✨ Key Features

### 🎯 Core Protection
- **Real-time AI Analysis** - Powered by Google Gemini AI for accurate threat detection
- **DNS & RDAP Validation** - Multi-source DNS checks with intelligent caching
- **Smart Content Analysis** - Examines page content for phishing indicators
- **Risk Scoring (0-100)** - Clear, color-coded threat levels with detailed explanations
- **Visual Warning System** - Beautiful, non-intrusive overlay for high-risk sites

### 🎨 Modern UI/UX
- **Sleek Dark Theme** - Professional, eye-friendly interface
- **Animated Gauge** - Real-time visual risk indicator
- **Smooth Animations** - Polished transitions and hover effects
- **Collapsible Sections** - Clean, organized information display
- **Responsive Design** - Optimized for all screen sizes

### 🚀 Powerful Features
- **📊 History Dashboard** - Track all scanned sites with analytics
  - Filter by risk level (High, Medium, Low)
  - Search through history
  - Export data as JSON
  - View scan statistics
- **⭐ Whitelist/Blacklist** - Manage trusted and blocked sites
  - Quick add/remove functionality
  - Instant bypass for whitelisted domains
  - Automatic warnings for blacklisted sites
- **📤 Export & Share** - Multiple export formats
  - Copy reports to clipboard
  - Export as text files
  - Shareable security reports
- **⌨️ Keyboard Shortcuts** - Efficient navigation
  - `Alt+R` - Re-analyze current site
  - `Alt+H` - Open history
  - `Alt+O` - Open options
  - `Alt+C` - Copy report
- **🔒 Privacy-First** - All processing happens locally
  - No data collection
  - Bring Your Own API Key (BYOK)
  - Cached results for faster performance

### 🛠️ Advanced Settings
- **Multiple AI Models** - Choose between Gemini Flash and Pro
- **Storage Management** - View and manage cached data
- **Diagnostic Tools** - Test DNS and RDAP connections
- **Statistics Dashboard** - Track storage usage and scan counts

## 🧩 Installation

### Chrome Web Store (Coming Soon)
1. Visit the Chrome Web Store
2. Click "Add to Chrome"
3. Configure your API key in Options

### Developer Mode (Current)
1.  **Clone this repository:**
    ```bash
    git clone https://github.com/NoCodeNode/X.git
    cd X
    ```
2.  Open `chrome://extensions/` in Chrome
3.  Enable **Developer Mode** (toggle in top-right)
4.  Click **Load unpacked** and select this folder
5.  Get a free API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
6.  Open **Options** and add your API key

## 🧠 How It Works

```
1. Page Load → Scamometer activates
2. Content Extraction → Smart scraping of visible text
3. DNS/RDAP Checks → Multi-source domain validation
4. AI Analysis → Gemini evaluates all signals
5. Risk Assessment → Score + detailed reasoning
6. Visual Feedback → Badge, popup, and warning overlay
```

### Analysis Pipeline
- **URL Structure Analysis** - Checks for typosquatting, suspicious TLDs
- **Domain Intelligence** - Age, registration details, infrastructure
- **Content Scanning** - Phishing patterns, urgency tactics, fake forms
- **Technical Validation** - SSL status, DNS records, RDAP data
- **AI-Powered Decision** - Holistic threat assessment

## 📁 Project Structure

```
📦 Scamometer
├── 📄 manifest.json          # Extension configuration
├── 🎨 icons/                 # Extension icons (16-128px)
├── 🔧 background.js          # Service worker: DNS/RDAP/AI
├── 🎭 content.js            # Page scripts: overlay & progress
├── 🖼️ popup.html/js         # Main interface
├── ⚙️ options.html/js       # Settings page
├── 📊 history.html/js       # Scan history dashboard
└── 📖 README.md             # You are here
```

## 🎯 Usage Guide

### First Time Setup
1. Install the extension
2. Click the Scamometer icon
3. Click "Options" to add your API key
4. Choose your preferred AI model
5. Start browsing - automatic protection enabled!

### Daily Use
- **Automatic Scanning** - Sites are analyzed as you browse
- **Badge Indicator** - Shows risk score on extension icon
- **Quick Check** - Click extension icon to see full report
- **History Review** - Click 📊 to view all scanned sites
- **Manual Re-scan** - Click "Re-run" to analyze again

### Managing Lists
1. Open Options (⚙️)
2. Navigate to Whitelist/Blacklist section
3. Add domains (e.g., `example.com`)
4. Remove by clicking the button next to each entry

### Exporting Data
- **From History**: Click "📥 Export" for JSON export of all scans
- **From Popup**: Click "📄 Export" for current site report
- **Quick Copy**: Click "📋 Copy" to copy report to clipboard

## 🔧 Configuration

### Available AI Models
| Model | Speed | Accuracy | Best For |
|-------|-------|----------|----------|
| `gemini-2.5-flash-preview-09-2025` | ⚡⚡⚡ | ⭐⭐⭐ | Recommended |
| `gemini-1.5-flash` | ⚡⚡⚡ | ⭐⭐ | Fastest |
| `gemini-1.5-pro` | ⚡⚡ | ⭐⭐⭐⭐ | Most thorough |

### Risk Score Interpretation
- **0-30** 🟢 Low Risk - Site appears legitimate
- **30-70** 🟡 Medium Risk - Some concerns, use caution
- **70-100** 🔴 High Risk - Likely scam/phishing

## 🧰 Requirements

- Chrome/Edge/Brave (Chromium-based browser)
- Google Gemini API key ([Free tier available](https://makersuite.google.com/app/apikey))
- Internet connection for API calls

## 🚀 Performance

- **Intelligent Caching** - DNS/RDAP results cached for 24 hours
- **Concurrent Requests** - Parallel DNS queries to multiple providers
- **Optimized Payloads** - Content truncated intelligently
- **Background Processing** - Non-blocking analysis
- **Minimal Memory** - Efficient data structures

## 🔐 Privacy & Security

- ✅ **No Telemetry** - Zero data collection
- ✅ **Local Storage** - All data stays on your device
- ✅ **BYOK** - You control your own API key
- ✅ **No Third-Party Tracking** - No analytics or trackers
- ✅ **Open Source** - Full transparency

## 🤝 Contributing

We welcome contributions! Areas for improvement:
- 🎨 UI/UX enhancements
- 🧠 Additional detection algorithms
- 🌐 Internationalization (i18n)
- 📚 Documentation improvements
- 🐛 Bug fixes and optimizations

## 📦 Future Roadmap

- [ ] OCR-based detection for image-based scams
- [ ] Browser screenshot analysis
- [ ] Community threat database
- [ ] Multi-language support
- [ ] Custom ML models for offline detection
- [ ] Integration with security feeds
- [ ] Enhanced certificate analysis
- [ ] Reputation scoring system

## 📜 License

MIT License - See [LICENSE](LICENSE) file for details

## 👨‍💻 Author

**Arnab Mandal**
- 📧 Email: hello@arnabmandal.com
- 🌐 Website: [arnabmandal.com](https://arnabmandal.com)

## 🙏 Acknowledgments

- Google Gemini AI for powerful language models
- DNS providers: Google DoH, Cloudflare
- RDAP.org for domain registration data
- Chrome Extensions API team

---

<div align="center">

**⭐ Star this repo if you find it useful!**

Built with ❤️ for a safer internet

[Report Bug](https://github.com/NoCodeNode/X/issues) · [Request Feature](https://github.com/NoCodeNode/X/issues) · [Documentation](https://github.com/NoCodeNode/X/wiki)

</div>
