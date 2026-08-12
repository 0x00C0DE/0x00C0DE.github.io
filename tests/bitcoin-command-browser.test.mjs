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
const VISITOR_API_ROOT = 'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors';

function getContentType(filePath) {
    switch (path.extname(filePath).toLowerCase()) {
    case '.html':
        return 'text/html; charset=utf-8';
    case '.js':
    case '.mjs':
        return 'application/javascript; charset=utf-8';
    case '.txt':
        return 'text/plain; charset=utf-8';
    default:
        return 'application/octet-stream';
    }
}

async function createStaticServer(rootDirectory) {
    let bitcoinFullResponses = 0;
    let rejectedOversizedRanges = 0;
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
            const suffixRange = String(request.headers.range || '').match(/^bytes=-(\d+)$/);
            if (suffixRange) {
                const requestedBytes = Number(suffixRange[1]);
                if (requestedBytes > file.length) {
                    rejectedOversizedRanges += 1;
                    response.writeHead(416, {
                        'Accept-Ranges': 'bytes',
                        'Content-Range': `bytes */${file.length}`,
                        'Content-Length': 0
                    });
                    response.end();
                    return;
                }
                const start = Math.max(0, file.length - requestedBytes);
                const body = file.subarray(start);
                response.writeHead(206, {
                    'Accept-Ranges': 'bytes',
                    'Content-Range': `bytes ${start}-${file.length - 1}/${file.length}`,
                    'Content-Length': body.length,
                    'Content-Type': getContentType(resolvedPath),
                    'Cache-Control': 'no-store'
                });
                response.end(body);
                return;
            }
            if (requestedPath.startsWith('/bitcoindata/')) {
                bitcoinFullResponses += 1;
            }
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
        get bitcoinFullResponses() {
            return bitcoinFullResponses;
        },
        close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
        origin: `http://127.0.0.1:${address.port}`,
        get rejectedOversizedRanges() {
            return rejectedOversizedRanges;
        }
    };
}

test('bitcoin command renders repository analytics and interval detail in the live terminal', { timeout: 120000 }, async t => {
    const server = await createStaticServer(REPO_ROOT);
    t.after(() => server.close());

    const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
    t.after(() => browser.close());

    const context = await browser.newContext();
    await context.route(`${VISITOR_API_ROOT}**`, route => route.fulfill({
        body: JSON.stringify({ onSite: 1, uniqueVisitors: 1, visits: 1 }),
        contentType: 'application/json',
        status: 200
    }));
    const page = await context.newPage();
    await page.goto(server.origin, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.bitcoin_command === 'function');

    const dashboard = await page.evaluate(() => window.bitcoin_command([]));
    assert.match(dashboard.join('\n'), /BITCOIN MARKET ANALYTICS/);
    assert.match(dashboard.join('\n'), /Multi-timeframe bias/);
    assert.match(dashboard.join('\n'), /1M/);
    assert.match(dashboard.join('\n'), /FORECAST SNAPSHOT/);

    const forecast = await page.evaluate(() => window.bitcoin_command(['forecast', '1m']));
    assert.match(forecast.join('\n'), /BITCOIN 1M FORECAST/);
    assert.match(forecast.join('\n'), /estimated 80% range/i);

    const backtest = await page.evaluate(() => window.bitcoin_command(['backtest', '1m']));
    assert.match(backtest.join('\n'), /WALK-FORWARD BACKTEST/);
    assert.match(backtest.join('\n'), /RMSE/);

    await page.evaluate(() => window.executeCommand('bitcoin 1m'));
    const outputText = await page.evaluate(() => window.__terminalCanvasTestHooks.getState().blocks
        .map(block => block.text)
        .filter(Boolean)
        .join('\n'));
    assert.match(outputText, /1M INTERVAL DETAIL/);
    assert.match(outputText, /EMA 5\/13/);
    assert.ok(server.rejectedOversizedRanges > 0, 'expected GitHub Pages-style 416 range responses');
    assert.ok(server.bitcoinFullResponses > 0, 'expected a full-file retry after an oversized range is rejected');
});
