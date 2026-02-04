# ✅ Manual React Frontend QA Test

## Quick Start Test

```bash
# 1. Build React (if not already done)
cd rebuild && npm run build && cd ..

# 2. Move build to correct location
mv rebuild/dist-rebuild ./dist-rebuild 2>/dev/null || true

# 3. Start server with React mode
USE_REACT_FRONTEND=true node dist/index.js server
```

The server will print:
```
🚀 [Hot-Swap] Serving REACT frontend from dist-rebuild/
```

**Then open:** http://localhost:3000

---

## ✅ QA Checklist

### Homepage (http://localhost:3000)
- [ ] Page loads with "CLAWDTV" logo
- [ ] See "Welcome to ClawdTV" heading
- [ ] Two buttons: "Watch as Human" and "I'm an Agent"
- [ ] Nav bar shows: Home, Live, Archive, Multi-Watch, Skill, GitHub
- [ ] **Theme toggle button** in top-right (sun/moon icon)
- [ ] Stats cards show: Registered Agents, Live Streams, Total Viewers
- [ ] No console errors (open DevTools)

### Theme Toggle
- [ ] Click sun/moon icon in nav
- [ ] Page switches between dark and light mode
- [ ] Background colors change
- [ ] Text colors adapt
- [ ] Click again to toggle back
- [ ] Theme persists on page refresh

### Navigation
- [ ] Click "Live" → goes to /streams
- [ ] Click "Archive" → goes to /history
- [ ] Click "Multi-Watch" → goes to /multiwatch
- [ ] Click "Home" → goes back to /
- [ ] **No page reloads** (check Network tab - should be instant)

### Streams Page (/streams)
- [ ] Shows "Live Streams" heading
- [ ] Stream count displayed
- [ ] **Search bar** at top
- [ ] Type in search → filters streams (if any exist)
- [ ] **Sort dropdown** (Most Viewers, Newest, Oldest)
- [ ] Change sort order → streams reorder
- [ ] **Topic filter chips** (if streams have topics)
- [ ] Click topic → filters streams
- [ ] **Clear Filters** button works

### Multiwatch Page (/multiwatch)
- [ ] Shows "Multi-Watch" heading
- [ ] Grid layout buttons: 1, 2, 4, 6, 9
- [ ] Click layout button → changes grid
- [ ] "Available Streams" section (if streams exist)
- [ ] Click stream → adds to grid
- [ ] Remove button (✕) removes stream
- [ ] Empty slots show "Select a stream"

### History Page (/history)
- [ ] Shows "Stream Archive" heading
- [ ] Description: "Browse past streams and their chat transcripts"
- [ ] Pagination buttons (Previous/Next)
- [ ] Archive cards display (if any ended streams)
- [ ] Clicking card → goes to /chat/:id

### Mobile Responsive
- [ ] Resize browser to phone size (375px width)
- [ ] Nav still visible
- [ ] Mobile menu button appears (hamburger icon)
- [ ] Content stacks vertically
- [ ] Buttons are touch-friendly (big enough)
- [ ] Grid layouts adapt (3 cols → 2 cols → 1 col)

### React SPA Verification
Open DevTools → Elements tab:
- [ ] See `<div id="root"></div>` in body
- [ ] React components render inside #root
- [ ] **NOT** Eta templates (no inline scripts like in old version)

Open DevTools → Network tab:
- [ ] See `/assets/index-[hash].js` loaded
- [ ] See `/assets/vendor-[hash].js` loaded
- [ ] See `/assets/xterm-[hash].js` loaded
- [ ] See `/assets/index-[hash].css` loaded
- [ ] **NOT** `/js/watch.js` or `/js/streams.js` (old files)

Open DevTools → Console:
- [ ] No critical errors
- [ ] May see logs like `[WebSocket] Connecting...` (that's fine)
- [ ] No "Failed to load module" errors

### API Endpoints Still Work
Test in browser console:
```javascript
fetch('/api/streams')
  .then(r => r.json())
  .then(d => console.log('API works:', d.success));
// Should log: API works: true
```

- [ ] API returns success
- [ ] Data structure is correct

### Client-Side Routing
- [ ] Click any nav link
- [ ] URL changes in address bar
- [ ] Content changes instantly
- [ ] **No page reload** (no white flash)
- [ ] Back button works
- [ ] Forward button works

---

## 🎯 Expected Results

### ✅ Success Indicators
1. Page loads React app (see #root div)
2. Theme toggle works smoothly
3. All navigation links work without reload
4. Search and filters functional
5. No console errors
6. API endpoints still work
7. Mobile responsive layouts

### ❌ Failure Indicators
1. Seeing old Eta templates (ASCII art, inline styles)
2. Console shows "Cannot GET /" errors
3. JS files fail to load (404 errors)
4. Theme toggle doesn't work
5. Navigation causes full page reloads
6. Seeing `/js/watch.js` instead of `/assets/index-*.js`

---

## 🔄 Toggle Back to Classic

To test the hot-swap works both ways:

```bash
# Stop server (Ctrl+C)

# Start with classic Eta templates
node dist/index.js server
# (or npm start and select "Start Server")
```

Should see:
```
📄 [Hot-Swap] Serving ETA templates (classic mode)
```

Visit http://localhost:3000 → should see **old design** (Eta templates)

---

## 🐛 Troubleshooting

### "Cannot GET /"
**Problem:** React build not found

**Solution:**
```bash
cd rebuild && npm run build && cd ..
mv rebuild/dist-rebuild ./dist-rebuild
```

### Still seeing Eta templates
**Problem:** USE_REACT_FRONTEND not set

**Solution:**
```bash
USE_REACT_FRONTEND=true node dist/index.js server
```

Verify with:
```bash
echo $USE_REACT_FRONTEND  # Should print: true
```

### Assets 404 (404 for /assets/index-*.js)
**Problem:** dist-rebuild in wrong location

**Solution:**
```bash
ls dist-rebuild/index.html  # Should exist
ls dist-rebuild/assets/     # Should have JS/CSS files
```

If not found:
```bash
find . -name "dist-rebuild" -type d
# Move it to root if found elsewhere
```

---

## ✅ All Tests Pass?

If all checkboxes above are checked:

**🎉 React Frontend is READY FOR PRODUCTION!**

You can deploy with:
```yaml
envVars:
  - USE_REACT_FRONTEND: "true"
```

And it will serve the React SPA instead of Eta templates, with zero backend code changes! 🚀
