import { chromium } from 'playwright';

const WATCH_URL = 'http://localhost:3000/watch/c356582e-4617-43bd-a9d6-8e77d81a438d';

(async () => {
  console.log('🎭 Starting Playwright test...\n');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture console logs
  const logs = [];
  page.on('console', msg => {
    const text = msg.text();
    logs.push(text);
    console.log(`[Browser Console] ${text}`);
  });

  // Capture errors
  page.on('pageerror', error => {
    console.error(`[Page Error] ${error.message}`);
    console.error(error.stack);
  });

  try {
    console.log(`\n📺 Visiting: ${WATCH_URL}\n`);

    // Visit watch page
    await page.goto(WATCH_URL, { waitUntil: 'networkidle', timeout: 10000 });

    // Wait a bit for WebSocket
    await page.waitForTimeout(3000);

    // Take screenshot
    await page.screenshot({ path: '/tmp/watch-page.png', fullPage: true });
    console.log('\n📸 Screenshot saved to: /tmp/watch-page.png');

    // Check page content
    const bodyText = await page.textContent('body');
    console.log(`\n📄 Page contains ${bodyText.length} characters`);

    // Check if terminal exists
    const terminalExists = await page.locator('#terminal-container, .terminal').count();
    console.log(`🖥️  Terminal elements found: ${terminalExists}`);

    // Check for error messages
    const errorElements = await page.locator('.error, [class*="error"]').count();
    console.log(`❌ Error elements: ${errorElements}`);

    // Get current URL (might have redirected)
    const currentUrl = page.url();
    console.log(`🔗 Current URL: ${currentUrl}`);

    // Check React root
    const reactRoot = await page.locator('#root').count();
    console.log(`⚛️  React root found: ${reactRoot}`);

    // Get all text content
    if (bodyText.includes('Stream not found') || bodyText.includes('Invalid')) {
      console.log('\n⚠️  Page shows error message');
    } else if (bodyText.length < 100) {
      console.log('\n⚠️  Page is mostly empty');
    } else {
      console.log('\n✅ Page has content');
    }

    // Check for infinite loop indicators
    const infiniteLoopIndicators = logs.filter(l =>
      l.includes('Cleaning up') || l.includes('Unsubscribed')
    );

    if (infiniteLoopIndicators.length > 5) {
      console.log(`\n🔄 Detected cleanup loop: ${infiniteLoopIndicators.length} cleanup logs`);
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('TEST SUMMARY:');
    console.log('='.repeat(50));
    console.log(`Total console logs: ${logs.length}`);
    console.log(`WebSocket logs: ${logs.filter(l => l.includes('[WebSocket]')).length}`);
    console.log(`useStream logs: ${logs.filter(l => l.includes('[useStream]')).length}`);
    console.log(`Error logs: ${logs.filter(l => l.includes('error') || l.includes('Error')).length}`);
    console.log('');
    console.log('Screenshot: /tmp/watch-page.png');
    console.log('Backend logs: /tmp/backend.log');
    console.log('Agent logs: /tmp/agent.log');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    await page.screenshot({ path: '/tmp/watch-page-error.png' });
    console.log('Error screenshot: /tmp/watch-page-error.png');
  } finally {
    await browser.close();
    console.log('\n✅ Test complete');
    process.exit(0);
  }
})();
