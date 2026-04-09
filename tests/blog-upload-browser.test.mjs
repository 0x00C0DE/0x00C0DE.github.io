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

function getMediaMimeType(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    switch (extension) {
    case '.jpg':
    case '.jpeg':
        return 'image/jpeg';
    case '.png':
        return 'image/png';
    case '.gif':
        return 'image/gif';
    case '.webp':
        return 'image/webp';
    case '.mp4':
        return 'video/mp4';
    default:
        return 'application/octet-stream';
    }
}

async function loadActualPickerFixtures(filePaths = SAMPLE_MEDIA_PATHS) {
    return Promise.all(filePaths.map(async filePath => ({
        bytes: Array.from(await readFile(filePath)),
        name: path.basename(filePath),
        type: getMediaMimeType(filePath)
    })));
}

async function installShowOpenFilePickerMock(page, selectedFileBatches, options = {}) {
    const delayMs = Number.isFinite(options.delayMs) ? Math.max(0, Math.floor(options.delayMs)) : 0;
    await page.evaluate(({ delayMs: responseDelayMs, selectedFileBatches: fixtureBatches }) => {
        window.__showOpenFilePickerCalls = [];
        let pickerCallIndex = 0;
        window.showOpenFilePicker = async options => {
            window.__showOpenFilePickerCalls.push({
                excludeAcceptAllOption: Boolean(options?.excludeAcceptAllOption),
                multiple: Boolean(options?.multiple),
                types: Array.isArray(options?.types)
                    ? options.types.map(type => ({
                        accept: type?.accept || null,
                        description: type?.description || ''
                    }))
                    : []
            });

            if (responseDelayMs > 0) {
                await new Promise(resolve => window.setTimeout(resolve, responseDelayMs));
            }

            const batch = fixtureBatches[Math.min(pickerCallIndex, fixtureBatches.length - 1)] || [];
            pickerCallIndex += 1;

            return batch.map(fixture => ({
                kind: 'file',
                name: fixture.name,
                async getFile() {
                    return new File(
                        [Uint8Array.from(fixture.bytes)],
                        fixture.name,
                        { type: fixture.type }
                    );
                }
            }));
        };
        HTMLInputElement.prototype.click = function() {
            throw new Error('legacy input picker fallback should not run when showOpenFilePicker is available');
        };
        HTMLInputElement.prototype.showPicker = function() {
            throw new Error('legacy input picker fallback should not run when showOpenFilePicker is available');
        };
    }, {
        delayMs,
        selectedFileBatches
    });
}

test('post uses showOpenFilePicker for multiple [image] placeholders and uploads every selected media file in order', { timeout: 120000 }, async t => {
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
    const sampleFixtures = await loadActualPickerFixtures();
    await installShowOpenFilePickerMock(page, [sampleFixtures]);

    await startPostCommand(page, createMediaPostCommand(3));

    await page.waitForFunction(() => window.__postCommandDone === true);
    const postCommandError = await page.evaluate(() => window.__postCommandError);
    assert.equal(postCommandError, null);
    const pickerCalls = await page.evaluate(() => window.__showOpenFilePickerCalls || []);
    assert.equal(pickerCalls.length, 1);
    assert.equal(pickerCalls[0].multiple, true);

    assert.ok(appendPayload && Array.isArray(appendPayload.contentBlocks));
    assert.deepEqual(
        appendPayload.contentBlocks.map(block => block.type),
        ['text', 'image', 'text', 'image', 'text', 'image', 'text']
    );

    const imageBlocks = appendPayload.contentBlocks.filter(block => block.type === 'image');
    assert.equal(imageBlocks.length, 3);
    assert.deepEqual(
        imageBlocks.map(block => block.fileName),
        ['spongebob1.jpg', 'patrick2.jpg', 'plankton1.jpg']
    );
    assert.match(imageBlocks[0].imageDataUrl || '', /^data:image\/jpeg;base64,/);
    assert.match(imageBlocks[1].imageDataUrl || '', /^data:image\/jpeg;base64,/);
    assert.match(imageBlocks[2].imageDataUrl || '', /^data:image\/jpeg;base64,/);
});

test('post keeps reopening showOpenFilePicker until spongebob1, patrick2, and plankton1 are all attached when each selection returns one file', { timeout: 120000 }, async t => {
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
    const sampleFixtures = await loadActualPickerFixtures();
    await installShowOpenFilePickerMock(page, sampleFixtures.map(file => [file]));

    await startPostCommand(page, createMediaPostCommand(3));
    await page.waitForFunction(() => window.__postCommandDone === true);

    const postCommandError = await page.evaluate(() => window.__postCommandError);
    assert.equal(postCommandError, null);
    const pickerCalls = await page.evaluate(() => window.__showOpenFilePickerCalls || []);
    assert.equal(pickerCalls.length, 3);
    assert.deepEqual(
        pickerCalls.map(call => call.multiple),
        [true, true, false]
    );

    const terminalText = await page.evaluate(() => document.body.innerText);
    assert.doesNotMatch(terminalText, /upload cancelled/);
    assert.ok(appendPayload && Array.isArray(appendPayload.contentBlocks));
    assert.deepEqual(
        appendPayload.contentBlocks
            .filter(block => block.type === 'image')
            .map(block => block.fileName),
        ['spongebob1.jpg', 'patrick2.jpg', 'plankton1.jpg']
    );
});

test('post waits for a delayed showOpenFilePicker resolution instead of treating focus return as an empty selection', { timeout: 120000 }, async t => {
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
    const sampleFixtures = await loadActualPickerFixtures();
    await installShowOpenFilePickerMock(page, [sampleFixtures], {
        delayMs: 650
    });

    await startPostCommand(page, createMediaPostCommand(3));
    await page.waitForFunction(() => window.__postCommandDone === true);

    const terminalText = await page.evaluate(() => document.body.innerText);
    assert.doesNotMatch(terminalText, /post: no media selected/);
    assert.ok(appendPayload && Array.isArray(appendPayload.contentBlocks));
    assert.equal(
        appendPayload.contentBlocks.filter(block => block.type === 'image').length,
        3
    );
});
