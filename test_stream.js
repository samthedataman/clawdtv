const { chromium } = require('playwright');
const https = require('https');

const API_KEY = 'ctv_a806359a20564f96d0a83c415a118b45e58c830821614530599ffaf56b6b8e22';
const WATCH_URL = 'https://claude-tv.onrender.com/watch/d70e00ab-fab8-4f4a-91ee-dcaf0f021656';

async function sendTerminalData(data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({ data });

        const options = {
            hostname: 'claude-tv.onrender.com',
            port: 443,
            path: '/api/agent/stream/data',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            res.on('end', () => {
                resolve(responseData);
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.write(postData);
        req.end();
    });
}

async function main() {
    console.log('🚀 Starting browser...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Navigate to the watch page
    console.log('📺 Opening watch page:', WATCH_URL);
    await page.goto(WATCH_URL, { waitUntil: 'networkidle' });

    // Wait a moment for the page to fully load
    await page.waitForTimeout(3000);

    // Check for "Connected to stream" message
    console.log('🔍 Waiting for connection...');
    let connected = false;
    for (let i = 0; i < 30; i++) {
        const content = await page.content();
        if (content.includes('Connected to stream')) {
            console.log('✅ Connected to stream!');
            connected = true;
            break;
        }
        await page.waitForTimeout(1000);
        console.log(`   Attempt ${i + 1}/30...`);
    }

    if (!connected) {
        console.log('⚠️  Warning: Did not see "Connected to stream" message, but continuing...');
    }

    // Send colorful terminal output
    console.log('📤 Sending terminal data...');

    const terminalOutput = [
        '\x1b[36m╔════════════════════════════════════════════════════════════════════════════════════════════════╗\x1b[0m\r\n',
        '\x1b[36m║                                    🚀 NeonCoder Live Stream 🚀                                 ║\x1b[0m\r\n',
        '\x1b[36m╚════════════════════════════════════════════════════════════════════════════════════════════════╝\x1b[0m\r\n',
        '\r\n',
        '\x1b[32m$ whoami\x1b[0m\r\n',
        'NeonCoder - Your friendly AI coding companion\r\n',
        '\r\n',
        '\x1b[32m$ echo "Hello, Claude.TV!"\x1b[0m\r\n',
        '\x1b[33mHello, Claude.TV!\x1b[0m\r\n',
        '\r\n',
        '\x1b[32m$ ls -la /workspace\x1b[0m\r\n',
        'total 42\r\n',
        'drwxr-xr-x  5 neon  staff   160 Feb  1 21:13 \x1b[36m.\x1b[0m\r\n',
        'drwxr-xr-x  3 neon  staff    96 Feb  1 21:13 \x1b[36m..\x1b[0m\r\n',
        '-rw-r--r--  1 neon  staff  1337 Feb  1 21:13 \x1b[32mawesome_app.py\x1b[0m\r\n',
        '-rw-r--r--  1 neon  staff   420 Feb  1 21:13 \x1b[32mconfig.json\x1b[0m\r\n',
        'drwxr-xr-x  3 neon  staff    96 Feb  1 21:13 \x1b[36msrc\x1b[0m\r\n',
        '\r\n',
        '\x1b[32m$ cat awesome_app.py\x1b[0m\r\n',
        '\x1b[33m#!/usr/bin/env python3\x1b[0m\r\n',
        '\x1b[36mimport\x1b[0m anthropic\r\n',
        '\x1b[36mimport\x1b[0m sys\r\n',
        '\r\n',
        '\x1b[36mdef\x1b[0m main():\r\n',
        '    \x1b[33m"""Building the future, one token at a time"""\x1b[0m\r\n',
        '    client = anthropic.Anthropic()\r\n',
        '    \x1b[36mprint\x1b[0m(\x1b[33m"🎨 Creating something amazing..."\x1b[0m)\r\n',
        '\r\n',
        '\x1b[32m$ python awesome_app.py\x1b[0m\r\n',
        '\x1b[33m🎨 Creating something amazing...\x1b[0m\r\n',
        '\x1b[32m✨ Success! AI magic in progress...\x1b[0m\r\n',
        '\r\n',
        '\x1b[36m════════════════════════════════════════════════════════════════════════════════════════════════\x1b[0m\r\n',
        '\x1b[32m✓ Stream test complete!\x1b[0m\r\n',
        '\x1b[33m✓ ANSI colors working!\x1b[0m\r\n',
        '\x1b[36m✓ Terminal output flowing!\x1b[0m\r\n',
        '\x1b[36m════════════════════════════════════════════════════════════════════════════════════════════════\x1b[0m\r\n',
    ];

    for (const line of terminalOutput) {
        await sendTerminalData(line);
        await page.waitForTimeout(150); // Small delay for streaming effect
    }

    console.log('✅ Terminal data sent!');

    // Wait a bit for the data to be displayed
    await page.waitForTimeout(3000);

    // Take a screenshot
    const screenshotPath = '/Users/samsavage/claudetv/stream_test_screenshot.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('📸 Screenshot saved to:', screenshotPath);

    // Check if terminal content is visible
    const terminalContent = await page.textContent('body');
    const hasNeonCoder = terminalContent.includes('NeonCoder');
    const hasHello = terminalContent.includes('Hello, Claude.TV');

    console.log('\n📊 Verification Results:');
    console.log('  - NeonCoder text found:', hasNeonCoder ? '✅' : '❌');
    console.log('  - Hello message found:', hasHello ? '✅' : '❌');

    await browser.close();
    console.log('🏁 Test complete!');
}

main().catch(console.error);
