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

test('history command lists previously executed commands without throwing', { timeout: 120000 }, async t => {
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

    const page = await browser.newPage({
        viewport: { width: 1280, height: 720 }
    });
    t.after(async () => {
        await page.close();
    });

    const pageErrors = [];
    page.on('pageerror', error => {
        pageErrors.push(String(error?.message || error || ''));
    });

    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors', route => route.fulfill({
        body: JSON.stringify({ onSite: 1, uniqueVisitors: 9, visits: 254 }),
        contentType: 'application/json',
        status: 200
    }));
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/track', route => route.fulfill({
        body: JSON.stringify({ onSite: 1, uniqueVisitors: 9, visits: 254 }),
        contentType: 'application/json',
        status: 200
    }));
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/leave', route => route.fulfill({
        body: JSON.stringify({ ok: true }),
        contentType: 'application/json',
        status: 200
    }));

    await page.goto(server.origin, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.executeCommand === 'function');
    await page.waitForTimeout(2500);

    await page.evaluate(async () => {
        await window.executeCommand('date');
        await window.executeCommand('pwd');
    });

    const historyOutput = await page.evaluate(() => window.history_command());
    assert.deepEqual(
        historyOutput,
        [
            '    1: banner',
            '    2: date',
            '    3: pwd'
        ]
    );
    assert.deepEqual(pageErrors, [], 'expected history command to avoid browser page errors');
});
