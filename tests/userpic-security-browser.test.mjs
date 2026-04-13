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

async function preparePage(page, origin) {
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors', async route => {
        await route.fulfill({
            body: JSON.stringify({ onSite: 1, uniqueVisitors: 1, visits: 1 }),
            contentType: 'application/json',
            status: 200
        });
    });
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/track', async route => {
        await route.fulfill({
            body: JSON.stringify({ onSite: 1, uniqueVisitors: 1, visits: 1 }),
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
    await page.waitForFunction(() => Boolean(window.__terminalCanvasTestHooks));
    await page.waitForTimeout(2500);
}

async function installUserpicPickerMock(page, fixtureBatch) {
    await page.evaluate(selectedFixtures => {
        window.__showOpenFilePickerCalls = [];
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

            return (Array.isArray(selectedFixtures) ? selectedFixtures : []).map(fixture => ({
                kind: 'file',
                name: fixture.name,
                async getFile() {
                    if (fixture.kind === 'canvas') {
                        const canvas = document.createElement('canvas');
                        canvas.width = fixture.width;
                        canvas.height = fixture.height;
                        const context = canvas.getContext('2d');
                        context.fillStyle = fixture.color || '#ff6b78';
                        context.fillRect(0, 0, canvas.width, canvas.height);
                        const blob = await new Promise(resolve => canvas.toBlob(resolve, fixture.type));
                        return new File([blob], fixture.name, { type: fixture.type });
                    }

                    if (fixture.kind === 'zeros') {
                        return new File(
                            [new Uint8Array(fixture.size || 0)],
                            fixture.name,
                            { type: fixture.type }
                        );
                    }

                    return new File(
                        [Uint8Array.from(fixture.bytes || [])],
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
    }, fixtureBatch);
}

async function startUserpicCommand(page, command = 'userpic') {
    await page.evaluate(commandLine => {
        window.__userpicCommandDone = false;
        window.__userpicCommandError = null;
        window.__userpicCommandResult = null;
        Promise.resolve(window.executeCommand(commandLine))
            .then(result => {
                window.__userpicCommandResult = result ?? null;
            })
            .catch(error => {
                window.__userpicCommandError = String(error?.message || error || '');
            })
            .finally(() => {
                window.__userpicCommandDone = true;
            });
    }, command);
}

async function getTerminalText(page) {
    return page.evaluate(() => {
        if (!window.__terminalCanvasTestHooks) {
            return '';
        }

        const state = window.__terminalCanvasTestHooks.getState();
        return (Array.isArray(state?.blocks) ? state.blocks : [])
            .filter(block => block?.kind === 'output' && typeof block.text === 'string')
            .map(block => block.text)
            .join('\n');
    });
}

test('userpic requests only explicit raster picker types', { timeout: 120000 }, async t => {
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

    await preparePage(page, server.origin);
    await installUserpicPickerMock(page, []);

    await startUserpicCommand(page);
    await page.waitForFunction(() => window.__userpicCommandDone === true);

    const pickerCalls = await page.evaluate(() => window.__showOpenFilePickerCalls || []);
    assert.equal(pickerCalls.length, 1);
    assert.equal(pickerCalls[0].multiple, false);
    assert.deepEqual(
        Object.keys(pickerCalls[0].types[0].accept || {}).sort(),
        ['image/gif', 'image/jpeg', 'image/png', 'image/webp']
    );
    assert.deepEqual(
        pickerCalls[0].types[0].accept['image/jpeg'],
        ['.jpg', '.jpeg']
    );
});

test('userpic rejects oversized files before decoding them', { timeout: 120000 }, async t => {
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

    await preparePage(page, server.origin);
    await installUserpicPickerMock(page, [{
        kind: 'zeros',
        size: (8 * 1024 * 1024) + 1,
        name: 'too-large.png',
        type: 'image/png'
    }]);

    await startUserpicCommand(page);
    await page.waitForFunction(() => window.__userpicCommandDone === true);

    const commandError = await page.evaluate(() => window.__userpicCommandError);
    assert.equal(commandError, null);
    const terminalText = await getTerminalText(page);
    assert.match(terminalText, /userpic: selected image must be 8 MB or smaller/);
});

test('userpic rejects files whose bytes are not a supported raster image', { timeout: 120000 }, async t => {
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

    await preparePage(page, server.origin);
    await installUserpicPickerMock(page, [{
        bytes: Array.from(Buffer.from('<svg xmlns=\"http://www.w3.org/2000/svg\"><rect width=\"1\" height=\"1\"/></svg>', 'utf8')),
        name: 'not-really-a-png.png',
        type: 'image/png'
    }]);

    await startUserpicCommand(page);
    await page.waitForFunction(() => window.__userpicCommandDone === true);

    const commandError = await page.evaluate(() => window.__userpicCommandError);
    assert.equal(commandError, null);
    const terminalText = await getTerminalText(page);
    assert.match(terminalText, /userpic: selected file must be a png, jpg, jpeg, webp, or gif image/);
});

test('userpic rejects images whose dimensions exceed the cap', { timeout: 120000 }, async t => {
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

    await preparePage(page, server.origin);
    await installUserpicPickerMock(page, [{
        kind: 'canvas',
        width: 5000,
        height: 32,
        name: 'too-wide.png',
        type: 'image/png'
    }]);

    await startUserpicCommand(page);
    await page.waitForFunction(() => window.__userpicCommandDone === true);

    const commandError = await page.evaluate(() => window.__userpicCommandError);
    assert.equal(commandError, null);
    const terminalText = await getTerminalText(page);
    assert.match(terminalText, /userpic: selected image dimensions must be 4096x4096 or smaller/);
});
