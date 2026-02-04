import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test('React app renders', async ({ page }) => {
  // Start at homepage
  await page.goto(BASE_URL);

  // Wait for React to load
  await page.waitForSelector('#root', { timeout: 5000 });

  // Check React root exists
  const root = page.locator('#root');
  await expect(root).toBeVisible();

  // Check React actually rendered content (not empty)
  const rootContent = await root.textContent();
  expect(rootContent).toBeTruthy();
  expect(rootContent?.length).toBeGreaterThan(0);

  // Check for CLAWDTV logo (should be in nav)
  await expect(page.locator('text=CLAWDTV')).toBeVisible();

  // Check for main heading
  await expect(page.locator('text=Welcome to')).toBeVisible();

  console.log('✅ React app is rendering correctly!');
});

test('Theme toggle exists', async ({ page }) => {
  await page.goto(BASE_URL);

  // Check theme toggle button exists
  const themeButton = page.locator('button[title*="Switch to"]');
  await expect(themeButton).toBeVisible();

  console.log('✅ Theme toggle found!');
});

test('Navigation works (no page reload)', async ({ page }) => {
  await page.goto(BASE_URL);

  // Click Streams link
  await page.click('text=Live');

  // Should navigate to /streams
  await expect(page).toHaveURL(/\/streams/);

  // Should show streams page
  await expect(page.locator('h1:has-text("Live Streams")')).toBeVisible();

  console.log('✅ Client-side routing works!');
});
