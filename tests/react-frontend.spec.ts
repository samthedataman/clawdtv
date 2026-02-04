import { test, expect } from '@playwright/test';

// Set base URL for all tests
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('React Frontend QA Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Set viewport for consistent testing
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('Landing page loads and displays correctly', async ({ page }) => {
    await page.goto(BASE_URL);

    // Check page title
    await expect(page).toHaveTitle(/ClawdTV/);

    // Check logo and heading
    await expect(page.locator('text=CLAWDTV')).toBeVisible();
    await expect(page.locator('text=Welcome to')).toBeVisible();

    // Check CTA buttons
    await expect(page.locator('text=Watch as Human')).toBeVisible();
    await expect(page.locator('text=I\'m an Agent')).toBeVisible();

    // Check nav is present
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('text=Live')).toBeVisible();
    await expect(page.locator('text=Archive')).toBeVisible();
  });

  test('Navigation links work', async ({ page }) => {
    await page.goto(BASE_URL);

    // Test Streams link
    await page.click('text=Live');
    await expect(page).toHaveURL(/\/streams/);
    await expect(page.locator('h1:has-text("Live Streams")')).toBeVisible();

    // Test History link
    await page.click('text=Archive');
    await expect(page).toHaveURL(/\/history/);
    await expect(page.locator('h1:has-text("Stream Archive")')).toBeVisible();

    // Test Home link
    await page.click('text=Home');
    await expect(page).toHaveURL(BASE_URL + '/');

    // Test Multi-Watch link
    await page.click('text=Multi-Watch');
    await expect(page).toHaveURL(/\/multiwatch/);
    await expect(page.locator('h1:has-text("Multi-Watch")')).toBeVisible();
  });

  test('Theme toggle works', async ({ page }) => {
    await page.goto(BASE_URL);

    // HTML should have dark class initially
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveClass(/dark/);

    // Find and click theme toggle button
    const themeButton = page.locator('button[title*="Switch to"]');
    await expect(themeButton).toBeVisible();
    await themeButton.click();

    // Wait a bit for class to update
    await page.waitForTimeout(300);

    // Should remove dark class for light mode
    await expect(htmlElement).not.toHaveClass(/dark/);

    // Click again to go back to dark
    await themeButton.click();
    await page.waitForTimeout(300);
    await expect(htmlElement).toHaveClass(/dark/);
  });

  test('Streams page displays and search works', async ({ page }) => {
    await page.goto(BASE_URL + '/streams');

    // Check page loads
    await expect(page.locator('h1:has-text("Live Streams")')).toBeVisible();

    // Check search bar exists
    const searchInput = page.locator('input[placeholder*="Search"]');
    await expect(searchInput).toBeVisible();

    // Type in search (won't filter anything if no streams, but should work)
    await searchInput.fill('test stream');
    await expect(searchInput).toHaveValue('test stream');

    // Clear search button should appear
    const clearButton = page.locator('button:has(svg)').filter({ has: page.locator('path[d*="M6 18L18 6"]') });
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await expect(searchInput).toHaveValue('');
    }

    // Check sort dropdown exists
    await expect(page.locator('select')).toBeVisible();
  });

  test('Multiwatch page loads with controls', async ({ page }) => {
    await page.goto(BASE_URL + '/multiwatch');

    // Check page loads
    await expect(page.locator('h1:has-text("Multi-Watch")')).toBeVisible();

    // Check grid layout buttons (1, 2, 4, 6, 9)
    await expect(page.locator('button:has-text("1")')).toBeVisible();
    await expect(page.locator('button:has-text("2")')).toBeVisible();
    await expect(page.locator('button:has-text("4")')).toBeVisible();
    await expect(page.locator('button:has-text("6")')).toBeVisible();
    await expect(page.locator('button:has-text("9")')).toBeVisible();

    // Click on grid layout button
    await page.click('button:has-text("4")');
    // Should show 4 empty slots
    const emptySlots = page.locator('text=Select a stream');
    await expect(emptySlots).toHaveCount(4);
  });

  test('History page loads', async ({ page }) => {
    await page.goto(BASE_URL + '/history');

    // Check page loads
    await expect(page.locator('h1:has-text("Stream Archive")')).toBeVisible();

    // Check description
    await expect(page.locator('text=Browse past streams')).toBeVisible();

    // Pagination should exist (even if disabled)
    await expect(page.locator('button:has-text("Previous")')).toBeVisible();
    await expect(page.locator('button:has-text("Next")')).toBeVisible();
  });

  test('React app is actually loaded (not Eta templates)', async ({ page }) => {
    await page.goto(BASE_URL);

    // Check for React-specific elements
    const reactRoot = page.locator('#root');
    await expect(reactRoot).toBeVisible();

    // Check for Vite-built assets (should have hashed filenames)
    const scripts = await page.locator('script[src*="assets"]').count();
    expect(scripts).toBeGreaterThan(0);

    // Check for Tailwind CSS (should have index.css)
    const styles = await page.locator('link[href*="index"]').count();
    expect(styles).toBeGreaterThan(0);
  });

  test('Mobile responsive - nav and layout', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);

    // Nav should still be visible
    await expect(page.locator('nav')).toBeVisible();

    // Logo should be visible
    await expect(page.locator('text=CLAWDTV')).toBeVisible();

    // Mobile menu button should be visible on small screens
    // (SVG hamburger menu)
    const mobileMenuButton = page.locator('button.md\\:hidden');
    await expect(mobileMenuButton).toBeVisible();
  });

  test('API endpoints still work (not broken by React)', async ({ page }) => {
    // Test that API routes are not intercepted by React catch-all
    const response = await page.request.get(BASE_URL + '/api/streams');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toHaveProperty('success');
  });

  test('Client-side routing works (no page reload)', async ({ page }) => {
    await page.goto(BASE_URL);

    // Set up listener for navigation
    let pageReloaded = false;
    page.on('load', () => {
      pageReloaded = true;
    });

    // Navigate using React Router link
    await page.click('text=Live');
    await page.waitForURL(/\/streams/);

    // Should NOT have reloaded the page (React Router handles it)
    expect(pageReloaded).toBeFalsy();

    // Page should show streams content
    await expect(page.locator('h1:has-text("Live Streams")')).toBeVisible();
  });

  test('Console has no critical errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto(BASE_URL);
    await page.waitForTimeout(2000); // Wait for React to fully load

    // Filter out known acceptable errors (like network errors for non-existent streams)
    const criticalErrors = errors.filter(err =>
      !err.includes('Failed to fetch') &&
      !err.includes('404') &&
      !err.includes('Network error')
    );

    expect(criticalErrors.length).toBe(0);
  });
});
