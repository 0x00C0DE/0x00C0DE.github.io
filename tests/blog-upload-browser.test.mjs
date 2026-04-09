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
    'E:/Downloads/50cent1.gif',
    'E:/Downloads/plankton1.jpg'
];

function createMediaPostCommand(requestedCount) {
    const textBlocks = ['aaa', 'bbb', 'ccc', 'ddd', 'eee', 'fff'];
    const output = ['post'];
    for (let index = 0; index < requestedCount; index += 1) {
        output.push(textBlocks[index] || `block-${index + 1}`);
        output.push('[image]');
    }
    output.push(textBlocks[requestedCount] || `block-${requestedCount + 1}`);
    return output.join(' ');
}

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

async function prepareUploadPage(page, origin) {
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

    await page.goto(origin, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.executeCommand === 'function');
    await page.waitForTimeout(2500);
}

async function startPostCommand(page, command) {
    await page.evaluate(commandLine => {
        window.__postCommandDone = false;
        window.__postCommandError = null;
        window.__postCommandResult = null;
        Promise.resolve(window.executeCommand(commandLine))
            .then(result => {
                window.__postCommandResult = result ?? null;
            })
            .catch(error => {
                window.__postCommandError = String(error?.message || error || '');
            })
            .finally(() => {
                window.__postCommandDone = true;
            });
    }, command);
}

test('post opens one multi-select chooser for multiple [image] placeholders and uploads every selected media file in order', { timeout: 120000 }, async t => {
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
    t.after(async () => {
        await page.close();
    });

    let appendPayload = null;
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/blog/append', async route => {
        appendPayload = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({
            body: JSON.stringify({ commitUrl: 'https://example.com/commit' }),
            contentType: 'application/json',
            status: 200
        });
    });

    await prepareUploadPage(page, server.origin);

    const chooserPromise = page.waitForEvent('filechooser', { timeout: 5000 });
    await startPostCommand(page, createMediaPostCommand(3));

    const chooser = await chooserPromise;
    const isMultiple = await chooser.element().evaluate(input => input.multiple);
    assert.equal(isMultiple, true);
    await chooser.setFiles(SAMPLE_MEDIA_PATHS);

    const extraChooserOpened = await page.waitForEvent('filechooser', { timeout: 1500 })
        .then(() => true)
        .catch(() => false);
    assert.equal(extraChooserOpened, false);

    await page.waitForFunction(() => window.__postCommandDone === true);
    const postCommandError = await page.evaluate(() => window.__postCommandError);
    assert.equal(postCommandError, null);

    assert.ok(appendPayload && Array.isArray(appendPayload.contentBlocks));
    assert.deepEqual(
        appendPayload.contentBlocks.map(block => block.type),
        ['text', 'image', 'text', 'image', 'text', 'image', 'text']
    );

    const imageBlocks = appendPayload.contentBlocks.filter(block => block.type === 'image');
    assert.equal(imageBlocks.length, 3);
    assert.deepEqual(
        imageBlocks.map(block => block.fileName),
        ['spongebob1.jpg', '50cent1.gif', 'plankton1.jpg']
    );
    assert.match(imageBlocks[0].imageDataUrl || '', /^data:image\/jpeg;base64,/);
    assert.match(imageBlocks[1].imageDataUrl || '', /^data:image\/gif;base64,/);
    assert.match(imageBlocks[2].imageDataUrl || '', /^data:image\/jpeg;base64,/);
});
