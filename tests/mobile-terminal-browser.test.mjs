import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

import { chromium, devices } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const MOBILE_DEVICE = devices['iPhone 13'];

function getContentType(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    switch (extension) {
    case '.html':
        return 'text/html; charset=utf-8';
    case '.js':
    case '.mjs':
        return 'application/javascript; charset=utf-8';
    case '.css':
        return 'text/css; charset=utf-8';
    case '.json':
        return 'application/json; charset=utf-8';
    case '.jpg':
    case '.jpeg':
        return 'image/jpeg';
    case '.png':
        return 'image/png';
    case '.gif':
        return 'image/gif';
    case '.webp':
        return 'image/webp';
    default:
        return 'application/octet-stream';
    }
}

async function createStaticServer(rootDirectory) {
    const server = http.createServer(async (request, response) => {
        try {
            const requestUrl = new URL(request.url || '/', 'http://127.0.0.1');
            let filePath = decodeURIComponent(requestUrl.pathname);
            if (filePath === '/') {
                filePath = '/index.html';
            }

            const resolvedPath = path.resolve(rootDirectory, `.${filePath}`);
            if (!resolvedPath.startsWith(rootDirectory)) {
                response.writeHead(403);
                response.end('forbidden');
                return;
            }

            const file = await readFile(resolvedPath);
            response.writeHead(200, {
                'Content-Type': getContentType(resolvedPath),
                'Cache-Control': 'no-store'
            });
            response.end(file);
        } catch {
            response.writeHead(404);
            response.end('not found');
        }
    });

    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });

    const address = server.address();
    return {
        close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
        origin: `http://127.0.0.1:${address.port}`
    };
}

async function createMobilePage(t) {
    const browser = await chromium.launch({
        executablePath: CHROME_PATH,
        headless: true
    });
    t.after(async () => {
        await browser.close();
    });

    const page = await browser.newPage({
        ...MOBILE_DEVICE
    });
    t.after(async () => {
        await page.close();
    });

    return page;
}

async function stubVisitorApis(page, stats = { onSite: 4, uniqueVisitors: 23, visits: 456 }) {
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors', route => route.fulfill({
        body: JSON.stringify(stats),
        contentType: 'application/json',
        status: 200
    }));
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/track', route => route.fulfill({
        body: JSON.stringify(stats),
        contentType: 'application/json',
        status: 200
    }));
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/leave', route => route.fulfill({
        body: JSON.stringify({ ok: true }),
        contentType: 'application/json',
        status: 200
    }));
}

test('mobile tap focuses a text-input proxy and beforeinput can submit commands without a hardware keyboard', { timeout: 120000 }, async t => {
    const server = await createStaticServer(REPO_ROOT);
    t.after(async () => {
        await server.close();
    });

    const page = await createMobilePage(t);
    await stubVisitorApis(page);

    await page.goto(server.origin, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.executeCommand === 'function');
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
        window.__mobileHelpCalls = 0;
        window.help_command = () => {
            window.__mobileHelpCalls += 1;
            return ['mobile help ok'];
        };
    });

    await page.touchscreen.tap(140, 540);
    await page.waitForFunction(() => document.activeElement?.id === 'terminal-mobile-input');

    await page.evaluate(() => {
        const input = document.getElementById('terminal-mobile-input');
        input.value = 'help';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new InputEvent('beforeinput', {
            bubbles: true,
            cancelable: true,
            data: null,
            inputType: 'insertLineBreak'
        }));
    });

    await page.waitForFunction(() => window.__mobileHelpCalls === 1);
});

test('mobile visitor widget redraws live stats instead of staying at zeros after the API returns non-zero values', { timeout: 120000 }, async t => {
    const server = await createStaticServer(REPO_ROOT);
    t.after(async () => {
        await server.close();
    });

    const page = await createMobilePage(t);
    await page.addInitScript(() => {
        window.__widgetDigitDraws = [];
        const proto = CanvasRenderingContext2D.prototype;
        const originalFillText = proto.fillText;
        proto.fillText = function(text, x, y, maxWidth) {
            const matrix = typeof this.getTransform === 'function' ? this.getTransform() : { e: 0, f: 0 };
            if (/^\d$/.test(String(text || ''))) {
                window.__widgetDigitDraws.push({
                    text,
                    x: x + matrix.e,
                    y: y + matrix.f
                });
            }
            return originalFillText.call(this, text, x, y, maxWidth);
        };
    });
    await stubVisitorApis(page, {
        onSite: 4,
        uniqueVisitors: 23,
        visits: 456
    });

    await page.goto(server.origin, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.getCurrentVisitorStats === 'function');
    await page.waitForTimeout(3500);

    const rendered = await page.evaluate(() => {
        const digits = Array.isArray(window.__widgetDigitDraws)
            ? window.__widgetDigitDraws.slice(-21)
            : [];
        const rows = new Map();
        digits
            .sort((a, b) => a.y - b.y || a.x - b.x)
            .forEach(draw => {
                const key = Math.round(draw.y / 5) * 5;
                rows.set(key, (rows.get(key) || '') + draw.text);
            });

        return {
            rows: [...rows.values()],
            stats: window.getCurrentVisitorStats()
        };
    });

    assert.deepEqual(rendered.stats, {
        onSite: 4,
        uniqueVisitors: 23,
        visits: 456
    });
    assert.deepEqual(rendered.rows, ['0000456', '0000023', '0000004']);
});

test('mobile scrollbar thumb drag scrolls the terminal content', { timeout: 120000 }, async t => {
    const server = await createStaticServer(REPO_ROOT);
    t.after(async () => {
        await server.close();
    });

    const page = await createMobilePage(t);
    await stubVisitorApis(page);

    await page.goto(server.origin, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.executeCommand === 'function');
    await page.waitForFunction(() => Boolean(window.__terminalCanvasTestHooks));
    await page.waitForTimeout(2500);
    await page.evaluate(async () => {
        for (let index = 0; index < 6; index += 1) {
            await window.executeCommand('help');
        }
    });

    const before = await page.evaluate(() => ({
        scrollbar: window.__terminalCanvasTestHooks.getScrollbarLayout(),
        state: window.__terminalCanvasTestHooks.getState()
    }));
    assert.ok(before.scrollbar, 'expected the mobile terminal to render a scrollbar');
    assert.ok(before.state.scrollTop > 0, 'expected the terminal to be scrollable before dragging the thumb');

    const startPoint = {
        x: before.scrollbar.hitX + before.scrollbar.hitWidth / 2,
        y: before.scrollbar.thumbY + before.scrollbar.thumbHeight / 2
    };
    const endPoint = {
        x: startPoint.x,
        y: before.scrollbar.trackY + 24
    };
    await page.dispatchEvent('#terminal-canvas', 'pointerdown', {
        bubbles: true,
        clientX: startPoint.x,
        clientY: startPoint.y,
        isPrimary: true,
        pointerId: 1,
        pointerType: 'touch'
    });
    await page.dispatchEvent('#terminal-canvas', 'pointermove', {
        bubbles: true,
        clientX: endPoint.x,
        clientY: endPoint.y,
        isPrimary: true,
        pointerId: 1,
        pointerType: 'touch'
    });
    await page.dispatchEvent('#terminal-canvas', 'pointerup', {
        bubbles: true,
        clientX: endPoint.x,
        clientY: endPoint.y,
        isPrimary: true,
        pointerId: 1,
        pointerType: 'touch'
    });
    await page.waitForTimeout(150);

    const after = await page.evaluate(() => window.__terminalCanvasTestHooks.getState());
    assert.ok(
        after.scrollTop < before.state.scrollTop - 50,
        `expected mobile scrollbar drag to reduce scrollTop, before=${before.state.scrollTop} after=${after.scrollTop}`
    );
});
