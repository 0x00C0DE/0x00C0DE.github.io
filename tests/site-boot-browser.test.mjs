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

test('site boot loads the vendored pretext generated assets without module failures', { timeout: 120000 }, async t => {
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
        viewport: { height: 822, width: 1188 }
    });
    t.after(async () => {
        await page.close();
    });

    const pageErrors = [];
    const requestFailures = [];
    const responses = new Map();

    page.on('pageerror', error => {
        pageErrors.push(error.message);
    });
    page.on('requestfailed', request => {
        requestFailures.push({
            errorText: request.failure()?.errorText || '',
            url: request.url()
        });
    });
    page.on('response', response => {
        responses.set(response.url(), response.status());
    });

    await page.goto(server.origin, { waitUntil: 'load' });
    await page.waitForTimeout(2500);

    const generatedAssetUrl = `${server.origin}/vendor/pretext/generated/bidi-data.js`;
    const legacyPretextRuntimeRequests = [...responses.keys()].filter(url => url.includes('terminal-pretext-runtime.mjs'));
    assert.equal(
        responses.get(generatedAssetUrl),
        200,
        'expected the generated Pretext bidi data module to be served'
    );
    assert.deepEqual(
        legacyPretextRuntimeRequests,
        [],
        'expected site boot to skip the legacy terminal-pretext runtime shim'
    );
    assert.deepEqual(pageErrors, [], 'expected site boot to avoid browser page errors');
    assert.deepEqual(
        requestFailures.filter(failure => failure.url.includes('/vendor/pretext/generated/') || failure.url.includes('terminal-canvas-core.mjs')),
        [],
        'expected no boot-time module request failures'
    );
});

test('the resume command opens the Nazarick intro before the PDF', { timeout: 30000 }, async t => {
    const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
    t.after(() => browser.close());
    const origin = 'https://resume.test';
    const serveLocalFiles = async route => {
        const { pathname } = new URL(route.request().url());
        const file = pathname === '/' ? '/index.html' : pathname;
        if (file === '/assets/resume.pdf') {
            // Keep the native PDF viewer out of the test.
            await route.fulfill({ body: 'Resume PDF destination' });
            return;
        }
        await route.fulfill({ path: path.join(REPO_ROOT, file) });
    };

    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.route(`${origin}/**`, serveLocalFiles);
    await context.route('https://www.youtube.com/iframe_api', route => route.fulfill({
        contentType: 'application/javascript',
        body: `
            window.YT = {
                PlayerState: { ENDED: 0, PLAYING: 1 },
                Player: function (id, options) {
                    const player = {
                        getIframe() { return document.querySelector('#player'); },
                        mute() { document.body.dataset.muted = 'true'; },
                        loadVideoById(clip) {
                            document.body.dataset.clip = JSON.stringify(clip);
                            options.events.onStateChange({ data: 1 });
                            window.finishClip = () => options.events.onStateChange({ data: 0 });
                        }
                    };
                    queueMicrotask(() => options.events.onReady({ target: player }));
                }
            };
            window.onYouTubeIframeAPIReady();
        `
    }));
    const page = await context.newPage();
    await page.goto(origin);
    const resumeListing = (await readFile(path.join(REPO_ROOT, 'content', 'links.txt'), 'utf8'))
        .split(/\r?\n/).find(line => line.startsWith('Resume'));
    const link = await page.evaluate(listing => {
        const container = document.createElement('div');
        window.renderTerminalLineContent(container, listing);
        const anchor = container.querySelector('a');
        return [anchor?.href, anchor?.target];
    }, resumeListing);
    assert.deepEqual(link, [`${origin}/pages/resume-intro.html`, '_blank']);
    const popupPromise = context.waitForEvent('page');
    await page.evaluate(() => window.resume_command());
    const intro = await popupPromise;
    await intro.waitForURL('**/pages/resume-intro.html', { timeout: 3000 });
    await intro.waitForFunction(() => Boolean(window.finishClip), null, { timeout: 3000 });
    assert.equal(await intro.locator('body').getAttribute('data-muted'), 'true');
    assert.deepEqual(JSON.parse(await intro.locator('body').getAttribute('data-clip')), {
        videoId: 'WxrJ_RdtLqQ',
        startSeconds: 72,
        endSeconds: 82
    });
    await intro.evaluate(() => window.finishClip());
    await intro.waitForURL('**/assets/resume.pdf?v=20260810a');

    await intro.goto(`${origin}/pages/resume-intro.html`);
    const skip = intro.getByRole('link', { name: 'Skip to resume' });
    await skip.focus();
    await skip.press('Enter');
    await intro.waitForURL('**/assets/resume.pdf?v=20260810a');

    await context.route('https://www.youtube.com/iframe_api', route => route.abort());
    await intro.goto(`${origin}/pages/resume-intro.html`, { waitUntil: 'commit' });
    await intro.waitForURL('**/assets/resume.pdf?v=20260810a');

    let reducedMotionRequests = 0;
    await context.route('https://www.youtube.com/iframe_api', route => {
        reducedMotionRequests++;
        return route.abort();
    });
    await intro.emulateMedia({ reducedMotion: 'reduce' });
    await intro.goto(`${origin}/pages/resume-intro.html`, { waitUntil: 'commit' });
    await intro.waitForURL('**/assets/resume.pdf?v=20260810a');
    assert.equal(reducedMotionRequests, 0);

    const staticContext = await browser.newContext({ javaScriptEnabled: false });
    await staticContext.route(`${origin}/**`, serveLocalFiles);
    const staticIntro = await staticContext.newPage();
    await staticIntro.goto(`${origin}/pages/resume-intro.html`);
    assert.equal(
        await staticIntro.getByRole('link', { name: 'Skip to resume' }).getAttribute('href'),
        '/assets/resume.pdf?v=20260810a'
    );
});
