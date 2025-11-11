# Troubleshooting Guide - Scamometer v3.0 Batch Processing

## Common Issues and Solutions

### 1. "Cannot access contents of url" Error ✅ FIXED

**Symptom:**
```
Error: Cannot access contents of url "https://example.com/". 
Extension manifest must request permission to access this host.
```

**Cause:** Extension didn't have `<all_urls>` permission in manifest.

**Solution:** ✅ **Already Fixed in Latest Version**
- Updated `manifest.json` to include `<all_urls>` in `host_permissions`
- Version 3.0.0 includes this fix

**If you still see this error:**
1. Reload the extension: `chrome://extensions/` → Click reload button
2. Chrome will prompt for new permissions - click "Allow"
3. Try batch processing again

---

### 2. Permission Prompt When Installing

**Symptom:**
Chrome shows: "This extension wants to: Read and change all your data on all websites"

**Why This Happens:**
The `<all_urls>` permission is required for batch processing to access arbitrary URLs from your CSV file.

**Is This Safe?**
✅ Yes! The extension:
- Only accesses URLs you explicitly provide in CSV files
- Processes data locally (no external data collection)
- Opens source code for security review
- No telemetry or tracking

**What to Do:**
Click "Add Extension" or "Allow" to grant the permission.

---

### 3. Batch Processing Still Fails After Permission

**Symptoms:**
- URLs show as "failed" in dashboard
- Errors in console

**Possible Causes & Solutions:**

#### A. Extension Not Reloaded
**Solution:** 
1. Go to `chrome://extensions/`
2. Find Scamometer
3. Click the reload icon (circular arrow)
4. Try batch processing again

#### B. Invalid CSV Format
**Solution:**
- Ensure one URL per row
- URLs must be in first column
- URLs must start with `http://` or `https://`
- Example valid CSV:
  ```csv
  https://example.com
  https://google.com
  https://github.com
  ```

#### C. API Key Missing or Invalid
**Solution:**
1. Click extension icon
2. Go to Options
3. Enter valid Gemini API key
4. Click Save
5. Try batch processing again

#### D. Page Load Timeout
**Solution:**
- Some sites are very slow to load
- Extension waits 30 seconds per URL
- Failed URLs are logged but don't stop the batch
- Check "Failed" count in dashboard

---

### 4. Screenshots Not Appearing

**Symptoms:**
- Batch completes but no screenshots in downloads folder
- Screenshot field shows `null` in results

**Possible Causes:**

#### A. Downloads Permission Not Granted
**Solution:**
1. Check `chrome://extensions/` → Scamometer → Details
2. Verify "Downloads" permission is enabled
3. Reload extension if needed

#### B. Download Location Issues
**Solution:**
1. Check Chrome settings: `chrome://settings/downloads`
2. Ensure download location is accessible
3. Ensure sufficient disk space
4. Try changing download location

#### C. Screenshot Capture Fails (Non-Critical)
**Note:** Screenshot failure doesn't stop analysis
- Analysis continues without screenshot
- Screenshot field will be `null` in results
- Check browser console for specific error

---

### 5. Batch Processing Very Slow

**Expected Speed:**
- 5-10 seconds per URL (depends on page load + API)
- 10 URLs: ~1-2 minutes
- 100 URLs: ~10-20 minutes

**If Slower:**

#### A. Slow Page Loading
**Cause:** Some sites take long to load
**Solution:** Normal behavior, wait for completion

#### B. API Rate Limits
**Cause:** Gemini API has rate limits
**Solution:** 
- Sequential processing helps avoid limits
- Upgrade API plan if needed
- Consider smaller batches

#### C. Network Issues
**Solution:**
- Check internet connection
- Try batch processing again later
- Use smaller test batch first

---

### 6. "API Key Required" Modal Appears

**Symptom:**
Modal appears mid-batch: "The Gemini API key failed. Please enter a new API key..."

**Cause:**
Gemini API returned 401 or 403 error (authentication failure)

**Solutions:**

#### A. API Key Expired/Invalid
**Fix:**
1. Get new API key from [Google AI Studio](https://aistudio.google.com/app/api-keys)
2. Enter in modal
3. Click "Save & Resume"
4. Batch continues from interrupted URL

#### B. API Quota Exceeded
**Fix:**
1. Wait for quota reset (usually daily)
2. Upgrade API plan
3. Or pause and resume later

#### C. Incorrect Key Format
**Fix:**
1. Ensure key starts with correct prefix
2. No extra spaces before/after
3. Copy key directly from Google AI Studio

---

### 7. Webhook Not Sending

**Symptoms:**
- Batch completes but webhook doesn't receive data
- No POST request in server logs

**Solutions:**

#### A. Webhook Not Enabled
**Fix:**
1. Go to Options → Webhook Integration
2. Check "Enable Webhook Notifications"
3. Click "Save Webhook Config"

#### B. Invalid Webhook URL
**Fix:**
1. Test webhook with "Test Webhook" button
2. Ensure URL is accessible from browser
3. Use HTTPS for security
4. Check server is running and accepting POST

#### C. Server Not Responding
**Fix:**
1. Check server logs for errors
2. Verify endpoint accepts POST requests
3. Check firewall/network settings
4. Ensure Content-Type: application/json is accepted

---

### 8. External API Not Working

**Symptoms:**
- External website can't trigger batch processing
- `chrome.runtime.sendMessage` returns error

**Solutions:**

#### A. Domain Not Whitelisted
**Fix:**
1. Go to Options → Webhook Integration → External API Access
2. Add your domain (e.g., `https://dashboard.mycompany.com`)
3. Click "Add Domain"
4. Try external trigger again

#### B. Wrong Extension ID
**Fix:**
1. Get extension ID from `chrome://extensions/`
2. Use correct ID in external code:
   ```javascript
   const EXTENSION_ID = 'your-actual-extension-id';
   chrome.runtime.sendMessage(EXTENSION_ID, ...);
   ```

#### C. Message Format Wrong
**Fix:**
Use exact format:
```javascript
chrome.runtime.sendMessage(
  EXTENSION_ID,
  {
    type: 'START_BATCH',
    urls: ['https://url1.com', 'https://url2.com']
  },
  (response) => {
    console.log(response);
  }
);
```

---

## Debug Mode

### Enable Detailed Logging

1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Filter by "Scamometer" or check background service worker console
4. Look for error messages

### Check Background Service Worker

1. Go to `chrome://extensions/`
2. Find Scamometer
3. Click "service worker" link
4. Console opens with background logs
5. Check for errors during batch processing

### Inspect Queue State

Open console and run:
```javascript
chrome.storage.local.get('batch::queue', (data) => {
  console.log(data);
});
```

Check queue status:
```javascript
chrome.storage.local.get('batch::status', (data) => {
  console.log(data);
});
```

---

## Still Having Issues?

### Getting Help

1. **Check GitHub Issues:** [github.com/NoCodeNode/Scamometer-Next/issues](https://github.com/NoCodeNode/Scamometer-Next/issues)
2. **Email Support:** hello@arnabmandal.com
3. **Documentation:** README.md, TECHNICAL_SPEC.md

### Reporting Bugs

Include:
- Chrome version: `chrome://version/`
- Extension version: Check `chrome://extensions/`
- Error message (exact text)
- Steps to reproduce
- Sample CSV (if applicable)
- Console errors
- Screenshot of issue

---

## Quick Fixes Summary

| Issue | Quick Fix |
|-------|-----------|
| Permission error | Reload extension + grant permissions |
| No screenshots | Check downloads permission |
| Slow processing | Normal, wait for completion |
| API key error | Enter new key in modal |
| Webhook not sending | Enable in options + test |
| External API fails | Whitelist domain in options |

---

## Testing Your Installation

### Basic Test

1. Create test CSV:
   ```csv
   https://google.com
   https://github.com
   https://wikipedia.org
   ```

2. Upload to Batch Processing tab
3. Click "Start Batch Analysis"
4. Should complete in ~30-60 seconds
5. Check Report Dashboard for results

### Expected Results
- ✅ 3 URLs processed
- ✅ 3 successful analyses
- ✅ 0 failed
- ✅ 3 screenshots in downloads
- ✅ Export buttons work

If all work: ✅ Installation is correct!

---

**Last Updated:** November 11, 2025  
**Version:** 3.0.0
