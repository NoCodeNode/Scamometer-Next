# Testing Guide for Scamometer v2.0

## Pre-Installation Testing

### 1. File Integrity Check
- [x] All HTML files present (popup, options, history, welcome)
- [x] All JS files present (popup, options, history, background, content)
- [x] manifest.json valid and complete
- [x] Icon assets present (16, 32, 48, 128px)
- [x] Documentation files (README, CHANGELOG, LICENSE)

### 2. Syntax Validation
- [x] manifest.json valid JSON
- [x] All JavaScript files syntax-checked
- [x] HTML structure validated

## Installation Testing

### Load Extension
1. Open `chrome://extensions/`
2. Enable Developer Mode
3. Click "Load unpacked"
4. Select extension directory
5. Verify icon appears in toolbar
6. **Expected**: Extension loads without errors

### First Run Experience
1. Install extension
2. **Expected**: Welcome page opens automatically
3. Verify welcome page displays correctly
4. Click "Set Up API Key" button
5. **Expected**: Options page opens

## Core Functionality Testing

### API Configuration
1. Open Options page
2. Enter test API key
3. Select AI model
4. Click Save
5. **Expected**: Success message appears
6. Reload page
7. **Expected**: API key persists

### Popup Interface
1. Click extension icon
2. **Expected**: Popup opens (400px width)
3. If no API key: Shows setup prompt
4. If API key exists: Shows analysis or loading state
5. Verify all UI elements render correctly:
   - Header with action buttons
   - Gauge visualization
   - Risk score and verdict
   - Positives/Negatives tags
   - Technical details (collapsible)
   - Action buttons (re-run, options, copy, export)

### Website Analysis
1. Navigate to any HTTPS website
2. Wait for automatic analysis
3. **Expected**: Badge shows progress (⌛)
4. **Expected**: Progress bar appears at top of page
5. **Expected**: Badge updates with risk score (0-99)
6. Open popup to view full report
7. Verify all analysis data present

### History Dashboard
1. Click History button (📊) in popup
2. **Expected**: History page opens in new tab
3. Verify statistics display correctly
4. Check history items show:
   - Risk score badge
   - Domain name
   - Time stamp
   - Action buttons
5. Test filters (All, High, Medium, Low)
6. Test search functionality
7. Test export functionality

### Whitelist/Blacklist
1. Open Options page
2. Add domain to whitelist
3. **Expected**: Domain appears in list
4. Navigate to whitelisted domain
5. **Expected**: Instant "Whitelisted" result (score 0)
6. Add domain to blacklist
7. Navigate to blacklisted domain
8. **Expected**: Instant warning overlay (score 100)

### Export Features
1. Run analysis on a site
2. Click "Copy" button
3. **Expected**: Report copied to clipboard
4. Click "Export" button
5. **Expected**: Text file downloads
6. Verify report contains all expected data

### Keyboard Shortcuts
Test all shortcuts:
- `Alt+R`: Re-analyze (in popup)
- `Alt+H`: Open history (in popup)
- `Alt+O`: Open options (in popup)
- `Alt+C`: Copy report (in popup)

### Warning Overlay
1. Visit a site that gets high risk score (70+)
2. **Expected**: Warning overlay appears
3. Verify modal displays correctly
4. Test "Dismiss" button
5. **Expected**: Overlay fades out but badge remains
6. Test "Leave This Site" button
7. **Expected**: Redirects to about:blank

## Edge Cases & Error Handling

### No API Key
1. Remove API key from options
2. Navigate to any site
3. **Expected**: Badge shows "KEY"
4. Open popup
5. **Expected**: Shows "Add API key" message

### Network Errors
1. Disconnect internet
2. Try to analyze a site
3. **Expected**: Graceful error handling
4. Badge shows "ERR"

### Invalid Domains
1. Try to whitelist invalid domain (e.g., "not a domain")
2. **Expected**: Validation error shown
3. Try to whitelist IP address
4. **Expected**: Works or shows appropriate message

### Special URLs
Test with:
- `chrome://` pages (should skip)
- `about:blank` (should skip)
- Local file URLs (should skip)
- Data URLs (should skip)

### Performance
1. Open 10+ tabs rapidly
2. **Expected**: Extension handles load without crashes
3. Check memory usage in Task Manager
4. **Expected**: Reasonable memory footprint

## UI/UX Testing

### Visual Design
- [x] Consistent color scheme (dark theme)
- [x] Proper contrast ratios
- [x] Smooth animations
- [x] Responsive hover states
- [x] No layout shifts

### Responsive Behavior
1. Resize browser window
2. **Expected**: Extension UI remains functional
3. Test on different screen resolutions

### Accessibility
1. Tab through all interactive elements
2. **Expected**: Proper focus states visible
3. Test with screen reader (optional)
4. Verify ARIA labels present

## Browser Compatibility

### Chrome/Chromium
- [x] Manifest V3 compatible
- [x] Service worker functions correctly
- [x] All APIs work as expected

### Edge (Chromium)
- Test same features as Chrome
- Verify icon displays correctly

### Brave
- Test with Brave Shields enabled
- Verify extension works properly

## Data Persistence

### Storage Tests
1. Add items to whitelist/blacklist
2. Close browser completely
3. Reopen browser
4. **Expected**: Lists persist

### Cache Management
1. Visit several sites
2. Open History
3. Check cache count increases
4. Click "Clear Cache"
5. **Expected**: Cache count resets
6. **Expected**: Whitelist/Blacklist unchanged

## Security Testing

### Input Validation
- Test XSS attempts in domain inputs
- Verify HTML escaping in display
- Test SQL injection patterns (should be irrelevant)

### Permission Scope
- Verify only requested permissions used
- Check no unexpected API calls
- Confirm no data leakage

## Regression Testing

After any code changes:
1. Rerun core functionality tests
2. Verify no breaking changes
3. Check console for errors
4. Test with fresh install

## Known Limitations

Document any expected limitations:
- Requires active internet for AI analysis
- API key required for functionality
- May not catch all sophisticated scams
- Performance dependent on API response time

## Bug Report Template

When reporting bugs, include:
```
**Environment:**
- Browser: [Chrome/Edge/Brave]
- Version: [Extension version]
- OS: [Windows/Mac/Linux]

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Behavior:**

**Actual Behavior:**

**Screenshots:**
[If applicable]

**Console Errors:**
[If any]
```

## Test Sign-Off

- [ ] All core functionality tests passed
- [ ] No critical bugs found
- [ ] UI renders correctly
- [ ] Performance acceptable
- [ ] Security checks passed
- [ ] Documentation accurate

**Tested By:** _________________
**Date:** _________________
**Version:** v2.0.0
