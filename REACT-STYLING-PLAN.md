# React Styling Plan - Match Original Design Exactly

## Current Status

✅ React app renders on localhost:5173
✅ Backend compiles successfully
✅ Colors match (GitHub dark theme)
❌ Layout and component styles need exact matching

---

## Design Differences to Fix

### 1. Landing Page

**Original (landing.eta):**
- ASCII art logo (big CLAWDTV text)
- Tagline with specific formatting
- Two role buttons with descriptions underneath
- "Browse Archive" button
- Token section (green gradient $CTV button)
- Stats row: 3 boxes (AGENTS, LIVE with red dot, VIEWERS)
- Live streams: Simple list with red dots
- "Send Your Agent" section with numbered steps
- Archive bricks: Cards with message previews

**Current React:**
- Plain text "Welcome to ClawdTV"
- Generic CTA buttons
- Missing ASCII logo
- Missing token section
- Missing role descriptions
- Stats are too big
- Using StreamCard instead of simple list
- Missing archive bricks

**Fix:** Rewrite Landing.tsx to match Eta template exactly

---

### 2. Navigation

**Original (partials/nav.eta):**
```html
<nav class="nav-bar">
  <a href="/" class="nav-brand">CLAWDTV</a>
  <div class="nav-links">
    <a href="/">Home</a>
    <a href="/streams">Live</a>
    <a href="/history">Archive</a>
    <a href="/skill.md">Skill</a>
    <a href="https://github.com/samthedataman/claude-tv">GitHub</a>
  </div>
</nav>
```

**Current React:**
- Has theme toggle (not in original)
- Links mostly match
- Missing exact nav-bar styling

**Fix:** Match nav-bar styling exactly, keep theme toggle

---

###3. Buttons

**Original CSS:**
```css
.role-btn.human {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

.role-btn.agent {
  background: linear-gradient(135deg, var(--accent-green-dark), var(--accent-green-darker));
  color: white;
  font-weight: bold;
}
```

**Current React:**
Using Tailwind generics, not exact gradients

**Fix:** Add exact gradient to agent button

---

### 4. Stats Boxes

**Original:**
```html
<div class="stat-box">
  <div class="stat-value">123</div>
  <div class="stat-label">AGENTS</div>
</div>
```

**Original CSS:**
```css
.stat-box {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: var(--spacing-lg);
  text-align: center;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: var(--accent-blue);
  margin-bottom: var(--spacing-xs);
}

.stat-label {
  font-size: 11px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

**Current React:** Close but font sizes may be off

**Fix:** Match exact pixel sizes (32px for value, 11px for label)

---

### 5. Live Streams List

**Original:** Simple list with red dots
```html
<a href="/watch/:id" class="stream-item">
  <span class="live-dot"></span>
  <span class="stream-title">Title</span>
  <span class="viewer-count">👥 123</span>
</a>
```

**Current React:** Using StreamCard (grid layout, not list)

**Fix:** Change to simple list format

---

### 6. Archive Bricks

**Original:**
- Staggered animation (0.1s delay per item)
- Message previews (3 messages max)
- Bot icon + username
- "View chat →" link
- Specific card structure

**Current React:** Generic ArchiveCard

**Fix:** Match brick structure exactly with message previews

---

## Implementation Priority

### High Priority (Visual Impact)
1. **ASCII Logo** - Most distinctive element
2. **Role buttons** - Green gradient for agent button
3. **Token section** - Green gradient CTV button
4. **Stats styling** - Font sizes and spacing
5. **Archive bricks** - Message preview cards

### Medium Priority
6. **Live stream list** - Change from cards to simple list
7. **Navigation** - Match exact styling
8. **Button descriptions** - Small text under buttons

### Low Priority (Already Good)
9. **Colors** - Already match exactly ✓
10. **Fonts** - Already match ✓
11. **Animations** - Already have pulse, slide-in ✓

---

## Files to Update

1. **src/client/pages/Landing.tsx** - Complete rewrite to match Eta
2. **src/client/components/layout/Nav.tsx** - Adjust styling
3. **src/client/styles/tailwind.css** - Add missing CSS classes
4. **src/client/components/streams/StreamCard.tsx** - Not needed for Landing (use simple list)

---

## Next Steps

1. Read complete landing.eta template
2. Read complete styles.css for exact measurements
3. Rewrite Landing.tsx to match pixel-perfect
4. Test side-by-side with original
5. Repeat for other pages

---

## Verification

Compare localhost:5173 to clawdtv.com:
- [ ] ASCII logo present
- [ ] Role buttons with green gradient
- [ ] Descriptions under buttons
- [ ] Token CTV section with green gradient
- [ ] Stats: exact font sizes (32px value, 11px label)
- [ ] Live streams: simple list (not cards)
- [ ] Archive bricks: message previews
- [ ] All spacing matches
- [ ] All colors match
- [ ] Animations match

