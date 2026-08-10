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
            const contentType = path.extname(resolvedPath) === '.html'
                ? 'text/html; charset=utf-8'
                : 'application/javascript; charset=utf-8';
            response.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
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
        origin: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    };
}

test('fortune uses the prefetched first-party endpoint without contacting public proxies', { timeout: 30000 }, async t => {
    const server = await createStaticServer(REPO_ROOT);
    t.after(() => server.close());

    const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage();

    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors**', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ onSite: 1, uniqueVisitors: 1, visits: 1 })
    }));
    let publicProxyRequests = 0;
    await page.route('https://api.codetabs.com/**', route => {
        publicProxyRequests += 1;
        return route.fulfill({ status: 503 });
    });
    await page.route('https://api.allorigins.win/**', route => {
        publicProxyRequests += 1;
        return route.fulfill({ status: 503 });
    });
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/fortune', async route => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return route.fulfill({
        status: 200,
        contentType: 'application/json',
            body: JSON.stringify({ fortune: 'A fast live fortune.' })
        });
    });

    await page.goto(server.origin, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.fortune_command === 'function');

    const result = await page.evaluate(async () => {
        const startedAt = performance.now();
        const fortune = await Promise.race([
            window.fortune_command(),
            new Promise(resolve => setTimeout(() => resolve(['timed out']), 500))
        ]);
        return { fortune, elapsedMs: performance.now() - startedAt };
    });

    assert.deepEqual(result.fortune, ['A fast live fortune.']);
    assert.ok(result.elapsedMs < 500, `expected a live fortune within 500ms, got ${result.elapsedMs}ms`);
    assert.equal(publicProxyRequests, 0);
});
