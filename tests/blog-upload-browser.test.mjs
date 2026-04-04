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
const SAMPLE_MEDIA_PATHS = [
    'E:/Downloads/spongebob1.jpg',
    'E:/Downloads/patrick2.jpg',
    'E:/Downloads/plankton1.jpg'
];

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
        } catch (error) {
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

test('post with three media placeholders reopens file chooser three times and succeeds with the sample images', { timeout: 120000 }, async t => {
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

    const page = await browser.newPage();
    let appendPayload = null;

    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors', async route => {
        await route.fulfill({
            body: JSON.stringify({ onSite: 1, uniqueVisitors: 9, visits: 254 }),
            contentType: 'application/json',
            status: 200
        });
    });
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/track', async route => {
        await route.fulfill({
            body: JSON.stringify({ onSite: 1, uniqueVisitors: 9, visits: 254 }),
            contentType: 'application/json',
            status: 200
        });
    });
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/leave', async route => {
        await route.fulfill({
            body: JSON.stringify({ ok: true }),
            contentType: 'application/json',
            status: 200
        });
    });
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/blog/append', async route => {
        appendPayload = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({
            body: JSON.stringify({ commitUrl: 'https://example.com/commit' }),
            contentType: 'application/json',
            status: 200
        });
    });

    await page.goto(server.origin, { waitUntil: 'networkidle' });

    const input = page.locator('#command-input');
    await input.fill('post aaa [image] bbb [image] ccc [image] eee');

    const chooser1Promise = page.waitForEvent('filechooser');
    await input.press('Enter');
    const chooser1 = await chooser1Promise;

    const chooser2Promise = page.waitForEvent('filechooser', { timeout: 5000 });
    await chooser1.setFiles(SAMPLE_MEDIA_PATHS[0]);
    const chooser2 = await chooser2Promise;

    const chooser3Promise = page.waitForEvent('filechooser', { timeout: 5000 });
    await chooser2.setFiles(SAMPLE_MEDIA_PATHS[1]);
    const chooser3 = await chooser3Promise;

    await chooser3.setFiles(SAMPLE_MEDIA_PATHS[2]);

    await page.waitForFunction(() => document.body.textContent.includes('post: attached 3 media items in the entry'));
    const terminalText = await page.locator('#terminal').innerText();

    assert.match(terminalText, /post: blog entry appended successfully/);
    assert.match(terminalText, /post: attached 3 media items in the entry/);
    assert.doesNotMatch(terminalText, /upload cancelled/);
    assert.ok(appendPayload && Array.isArray(appendPayload.contentBlocks));
    assert.equal(
        appendPayload.contentBlocks.filter(block => block.type === 'image').length,
        3
    );
});
