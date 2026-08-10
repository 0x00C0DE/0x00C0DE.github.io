import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const COMMANDS_PATH = path.join(REPO_ROOT, 'src', 'commands.js');
const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const VISITOR_API_ROOT = 'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors';
const VISITOR_STATS = { onSite: 1, uniqueVisitors: 23, visits: 456 };

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
            const requestedPath = requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname;
            const resolvedPath = path.resolve(rootDirectory, `.${decodeURIComponent(requestedPath)}`);

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

async function waitFor(check, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (check()) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 25));
    }
    assert.fail('timed out waiting for condition');
}

async function stubVisitorApis(context, calls) {
    await context.route(`${VISITOR_API_ROOT}/track`, async route => {
        calls.track.push({
            body: route.request().postDataJSON(),
            timestamp: Date.now()
        });
        await route.fulfill({
            body: JSON.stringify(VISITOR_STATS),
            contentType: 'application/json',
            status: 200
        });
    });
    await context.route(`${VISITOR_API_ROOT}/leave`, async route => {
        calls.leave.push({
            body: route.request().postDataJSON(),
            timestamp: Date.now()
        });
        await route.fulfill({
            body: JSON.stringify({ ok: true }),
            contentType: 'application/json',
            status: 200
        });
    });
    await context.route(VISITOR_API_ROOT, route => route.fulfill({
        body: JSON.stringify(VISITOR_STATS),
        contentType: 'application/json',
        status: 200
    }));
}

test('visitor tracking uses one combined 15-second heartbeat and no stats polling interval', async () => {
    const source = await readFile(COMMANDS_PATH, 'utf8');
    assert.match(source, /const VISITOR_HEARTBEAT_MS = 15000;/);
    assert.doesNotMatch(source, /VISITOR_STATS_POLL_MS/);
});

test('multiple tabs share one visitor tracking stream', { timeout: 120000 }, async t => {
    const server = await createStaticServer(REPO_ROOT);
    t.after(() => server.close());

    const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
    t.after(() => browser.close());

    const context = await browser.newContext();
    const calls = { leave: [], track: [] };
    await stubVisitorApis(context, calls);

    const firstPage = await context.newPage();
    await firstPage.goto(server.origin, { waitUntil: 'load' });
    await waitFor(() => calls.track.length === 1);

    const secondPage = await context.newPage();
    await secondPage.goto(server.origin, { waitUntil: 'load' });
    await secondPage.waitForTimeout(2500);

    assert.equal(calls.track.length, 1, 'expected the second tab to reuse the first tab tracking stream');
    assert.equal(calls.track[0].body.action, 'visit');
    assert.deepEqual(
        await secondPage.evaluate(() => window.getCurrentVisitorStats()),
        VISITOR_STATS,
        'expected follower tabs to receive the leader tab statistics'
    );
});

test('multiple tabs share one tracking stream when the Web Locks API is unavailable', { timeout: 120000 }, async t => {
    const server = await createStaticServer(REPO_ROOT);
    t.after(() => server.close());

    const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
    t.after(() => browser.close());

    const context = await browser.newContext();
    await context.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, 'locks', {
            configurable: true,
            get: () => undefined
        });
    });
    const calls = { leave: [], track: [] };
    await stubVisitorApis(context, calls);

    const firstPage = await context.newPage();
    await firstPage.goto(server.origin, { waitUntil: 'load' });
    await waitFor(() => calls.track.length === 1);

    const secondPage = await context.newPage();
    await secondPage.goto(server.origin, { waitUntil: 'load' });
    await secondPage.waitForTimeout(2500);

    assert.equal(calls.track.length, 1, 'expected the storage lease fallback to elect one tracking tab');
    assert.deepEqual(await secondPage.evaluate(() => window.getCurrentVisitorStats()), VISITOR_STATS);
});

test('pagehide sends one leave request when sendBeacon accepts the request', { timeout: 120000 }, async t => {
    const server = await createStaticServer(REPO_ROOT);
    t.after(() => server.close());

    const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
    t.after(() => browser.close());

    const context = await browser.newContext();
    const calls = { leave: [], track: [] };
    await stubVisitorApis(context, calls);

    const page = await context.newPage();
    await page.goto(server.origin, { waitUntil: 'load' });
    await waitFor(() => calls.track.length === 1);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide')));
    await waitFor(() => calls.leave.length >= 1);
    await page.waitForTimeout(500);

    assert.equal(calls.leave.length, 1, 'expected fetch to be skipped after sendBeacon succeeds');
});
