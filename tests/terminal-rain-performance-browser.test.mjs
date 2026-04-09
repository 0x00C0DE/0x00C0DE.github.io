import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';

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
                'Cache-Control': 'no-store',
                'Content-Type': getContentType(resolvedPath)
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

async function stubTerminalApis(page) {
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors', route => route.fulfill({
        body: JSON.stringify({ onSite: 1, uniqueVisitors: 7, visits: 77 }),
        contentType: 'application/json',
        status: 200
    }));
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/track', route => route.fulfill({
        body: JSON.stringify({ onSite: 1, uniqueVisitors: 7, visits: 77 }),
        contentType: 'application/json',
        status: 200
    }));
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/leave', route => route.fulfill({
        body: JSON.stringify({ ok: true }),
        contentType: 'application/json',
        status: 200
    }));
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/terminal/su', route => route.fulfill({
        body: JSON.stringify({ ok: true }),
        contentType: 'application/json',
        status: 200
    }));
}

async function createVisualsPage(browser, origin, user) {
    const page = await browser.newPage({
        viewport: { height: 822, width: 1188 }
    });
    await page.addInitScript(() => {
        window.__canvasCreateCount = 0;
        const originalCreateElement = Document.prototype.createElement;
        if (!Document.prototype.__rainCanvasCounterInstalled) {
            Document.prototype.createElement = function(tagName, options) {
                const element = originalCreateElement.call(this, tagName, options);
                if (String(tagName || '').toLowerCase() === 'canvas') {
                    window.__canvasCreateCount += 1;
                }
                return element;
            };
            Document.prototype.__rainCanvasCounterInstalled = true;
        }
        window.prompt = () => 'pw';
    });
    await stubTerminalApis(page);
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.evaluate(async nextUser => {
        await window.executeCommand(`su ${nextUser}`);
    }, user);
    await page.waitForTimeout(300);
    return page;
}

async function measureCanvasChurn(page, durationMs = 900) {
    const before = await page.evaluate(() => window.__canvasCreateCount);
    await page.waitForTimeout(durationMs);
    const after = await page.evaluate(() => window.__canvasCreateCount);
    return after - before;
}

test('root and godlike rain animation stop allocating new canvases after startup', { timeout: 120000 }, async t => {
    const server = await createStaticServer(REPO_ROOT);
    t.after(async () => {
        await server.close();
    });

    const browser = await chromium.launch({
        executablePath: CHROME_PATH,
        headless: true
    });
    t.after(async () => {
        await browser.close();
    });

    for (const user of ['root', 'godlike']) {
        const page = await createVisualsPage(browser, server.origin, user);
        t.after(async () => {
            await page.close();
        });

        const churn = await measureCanvasChurn(page);
        assert.ok(
            churn <= 1,
            `expected ${user} rain to reuse startup canvases, but it allocated ${churn} additional canvases`
        );
        await page.close();
    }
});
