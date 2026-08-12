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
    await context.route('**/bitcoindata/PROPRTS-job_1h-unlimited-history.txt*', route => route.fulfill({
        body: 'temporarily unavailable',
        contentType: 'text/plain',
        status: 503
    }));
    const page = await context.newPage();
    await page.goto(server.origin, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.bitcoin_command === 'function');

    const dashboard = await page.evaluate(() => window.bitcoin_command([]));
    assert.match(dashboard.join('\n'), /BITCOIN MARKET ANALYTICS/);
    assert.match(dashboard.join('\n'), /Multi-timeframe bias/);
    assert.match(dashboard.join('\n'), /1M/);
    assert.match(dashboard.join('\n'), /FORECAST SNAPSHOT/);
    const visualDashboard = dashboard.find(item => item?.type === 'bitcoin-dashboard');
    assert.ok(visualDashboard, 'expected the default command to include a visual dashboard block');
    assert.ok(visualDashboard.dashboard.panels.length >= 2);
    assert.ok(visualDashboard.dashboard.panels.some(panel => panel.available));
    assert.ok(visualDashboard.dashboard.panels.every(panel => panel.intervalId));
    const unavailablePanel = visualDashboard.dashboard.panels.find(panel => panel.intervalId === '1h');
    assert.equal(unavailablePanel.available, false);
    assert.equal(unavailablePanel.status, 'UNAVAILABLE');
    assert.deepEqual(unavailablePanel.history, []);

    const standaloneDashboard = await page.evaluate(() => window.bitcoin_command(['dashboard', '1m']));
    assert.equal(standaloneDashboard[0].type, 'bitcoin-dashboard');
    assert.equal(standaloneDashboard[0].dashboard.panels.length, 1);
    assert.equal(standaloneDashboard[0].dashboard.panels[0].intervalId, '1m');
    assert.equal(
        standaloneDashboard[0].dashboard.panels[0].history.at(-1).mid,
        standaloneDashboard[0].dashboard.panels[0].latestPrice
    );

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

    await page.evaluate(() => window.executeCommand('clear'));
    await page.evaluate(() => window.executeCommand('bitcoin dashboard 1m'));
    const dashboardBlock = await page.evaluate(() => window.__terminalCanvasTestHooks.getBitcoinDashboardBlock());
    assert.equal(dashboardBlock.type, 'bitcoin-dashboard');
    assert.equal(dashboardBlock.panelCount, 1);
    assert.ok(dashboardBlock.height > 200);
    assert.equal(dashboardBlock.columns, 1);
    await page.waitForTimeout(150);
    const renderedColorCounts = await page.evaluate(() => {
        const canvas = document.getElementById('terminal-canvas');
        const context = canvas.getContext('2d');
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        const targets = {
            ask: [248, 81, 73],
            bid: [46, 160, 67],
            latest: [255, 152, 0],
            mid: [47, 129, 247],
            projection: [210, 153, 34]
        };
        const counts = Object.fromEntries(Object.keys(targets).map(key => [key, 0]));
        for (let index = 0; index < pixels.length; index += 4) {
            Object.entries(targets).forEach(([key, color]) => {
                if (
                    Math.abs(pixels[index] - color[0]) <= 24
                    && Math.abs(pixels[index + 1] - color[1]) <= 24
                    && Math.abs(pixels[index + 2] - color[2]) <= 24
                    && pixels[index + 3] > 0
                ) {
                    counts[key] += 1;
                }
            });
        }
        return counts;
    });
    Object.entries(renderedColorCounts).forEach(([series, count]) => {
        assert.ok(count > 2, `expected rendered ${series} chart pixels`);
    });

    await page.setViewportSize({ width: 430, height: 900 });
    await page.evaluate(() => window.executeCommand('clear'));
    await page.evaluate(() => window.executeCommand('bitcoin dashboard'));
    const mobileDashboardBlock = await page.evaluate(() => window.__terminalCanvasTestHooks.getBitcoinDashboardBlock());
    assert.equal(mobileDashboardBlock.panelCount, 8);
    assert.equal(mobileDashboardBlock.columns, 1);
    assert.ok(mobileDashboardBlock.height > dashboardBlock.height * 6);
    const mobileDashboardState = await page.evaluate(() => window.__terminalCanvasTestHooks.getState());
    assert.ok(
        mobileDashboardState.scrollTop >= mobileDashboardBlock.top - 2
        && mobileDashboardState.scrollTop <= mobileDashboardBlock.top + 2,
        'expected the command to reveal the dashboard header instead of scrolling past it'
    );
    assert.ok(server.rejectedOversizedRanges > 0, 'expected GitHub Pages-style 416 range responses');
    assert.ok(server.bitcoinFullResponses > 0, 'expected a full-file retry after an oversized range is rejected');
});
