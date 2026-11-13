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

test('resume sound defaults on and recovers from blocked audible autoplay on a tap', async t => {
    const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
    t.after(() => browser.close());
    const page = await browser.newPage();
    await page.route('https://resume.test/**', route => {
        const { pathname } = new URL(route.request().url());
        return route.fulfill({ path: path.join(REPO_ROOT, pathname) });
    });
    await page.addInitScript(() => {
        const play = HTMLMediaElement.prototype.play;
        window.playAttempts = [];
        HTMLMediaElement.prototype.play = function () {
            window.playAttempts.push(this.muted);
            if (window.playAttempts.length === 1) {
                return Promise.reject(new DOMException('Gesture required', 'NotAllowedError'));
            }
            return play.call(this);
        };
    });
    await page.goto('https://resume.test/pages/resume-intro.html');
    const video = page.locator('#cinematic');
    assert.equal(await video.evaluate(element => element.defaultMuted), false);
    await page.waitForFunction(() => window.playAttempts.length >= 2);
    assert.deepEqual(await page.evaluate(() => window.playAttempts.slice(0, 2)), [false, true]);
    await page.locator('#cinematic-sound').waitFor({ state: 'visible' });
    await video.click();
    await page.waitForFunction(() => !document.querySelector('#cinematic').muted);
    assert.equal(await page.locator('#cinematic-sound').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => window.playAttempts.at(-1)), false);
});

test('the resume command reveals the HTML resume in place after the Nazarick cutscene', { timeout: 65000 }, async t => {
    const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
    t.after(() => browser.close());
    const origin = 'https://resume.test';
    const introUrl = `${origin}/pages/resume-intro.html`;
    const videoPath = '/assets/resume-crystal-whiteout-1080p.mp4';
    let videoRequests = 0;
    let pdfNavigations = 0;

    const serveLocalFiles = async route => {
        const { pathname } = new URL(route.request().url());
        if (pathname === '/assets/resume.pdf' && route.request().isNavigationRequest()) {
            pdfNavigations++;
        }
        if (pathname === videoPath) videoRequests++;
        const file = pathname === '/' ? '/index.html' : pathname;
        await route.fulfill({ path: path.join(REPO_ROOT, file) });
    };

    const viewport = { width: 390, height: 844 };
    const context = await browser.newContext({ viewport });
    await context.route(`${origin}/**`, serveLocalFiles);
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
    assert.deepEqual(link, [introUrl, '']);
    await page.evaluate(() => window.resume_command());
    await page.waitForURL(introUrl);
    const video = page.locator('video');
    await page.waitForFunction(() => {
        const cinematic = document.querySelector('video');
        return cinematic?.currentTime > .1 && cinematic.videoWidth > 0;
    });
    assert.deepEqual(await video.boundingBox(), { x: 0, y: 0, ...viewport });
    assert.equal(await video.evaluate(element => getComputedStyle(element).objectFit), 'cover');
    assert.equal(await video.evaluate(element => getComputedStyle(element).objectPosition), '42% 50%');
    assert.equal(await page.locator('iframe').count(), 0);
    assert.deepEqual(await video.evaluate(element =>
        [element.videoWidth, element.videoHeight, element.textTracks.length]
    ), [1920, 1080, 0]);
    assert.equal(await video.getAttribute('src'), videoPath);
    const landscape = { width: 844, height: 390 };
    await page.setViewportSize(landscape);
    assert.deepEqual(await video.boundingBox(), { x: 0, y: 0, ...landscape });
    assert.equal(await video.evaluate(element => getComputedStyle(element).objectFit), 'cover');
    await page.setViewportSize(viewport);
    const sound = page.getByRole('button', { name: 'Sound', exact: true });
    const initiallyMuted = await video.evaluate(element => element.muted);
    assert.equal(initiallyMuted, false, 'sound starts enabled after the resume command');
    await sound.click();
    assert.equal(await video.evaluate(element => element.muted), !initiallyMuted);
    await page.waitForFunction(() => {
        const article = document.querySelector('.resume-handoff .resume-page');
        return article?.querySelector('canvas') && article.getAnimations().some(animation => {
            const frames = animation.effect.getKeyframes();
            return frames[0].filter === 'blur(24px)' && frames.at(-1).filter === 'blur(0px)';
        });
    }, null, { timeout: 40000 });
    const handoffTime = await video.evaluate(element => element.currentTime);
    assert.ok(handoffTime >= 4.75 && handoffTime < 5.05, `Expected the full Fallen Down whiteout, got ${handoffTime}s`);
    const education = page.locator('.resume-text-layer').getByText('Education', { exact: true });
    await education.waitFor();
    const sheet = page.getByRole('region', { name: 'Résumé page 1 of 1' });
    assert.deepEqual(await sheet.locator('canvas').evaluate(canvas => [canvas.width, canvas.height]), [1224, 1584]);
    const box = await sheet.boundingBox();
    assert.ok(box.width <= viewport.width);
    assert.ok(Math.abs(box.width / box.height - 612 / 792) < .01);
    assert.ok(await sheet.getByRole('link').count() > 0);
    assert.ok(await education.evaluate(element => parseFloat(getComputedStyle(element).fontSize) > 0));
    await education.scrollIntoViewIfNeeded();
    assert.equal(page.url(), introUrl);
    assert.equal(await page.locator('#intro').isHidden(), true);
    await page.goBack();
    await page.waitForURL(`${origin}/`);

    await page.goto(introUrl);
    const skip = page.getByRole('link', { name: 'Skip to resume' });
    await skip.focus();
    await skip.press('Enter');
    await education.waitFor();
    assert.equal(page.url(), introUrl);

    await context.route(`${origin}${videoPath}`, route => route.fulfill({ status: 404 }));
    await page.goto(introUrl, { waitUntil: 'commit' });
    await education.waitFor();
    assert.equal(page.url(), introUrl);
    await context.unroute(`${origin}${videoPath}`);

    const beforeReducedMotion = videoRequests;
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(introUrl, { waitUntil: 'commit' });
    await education.waitFor();
    assert.equal(page.url(), introUrl);
    assert.equal(videoRequests, beforeReducedMotion);
    assert.equal(pdfNavigations, 0);

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(introUrl);
    assert.equal(await video.getAttribute('src'), '/assets/resume-crystal-whiteout-4k.mp4');
    assert.equal(await video.evaluate(element => getComputedStyle(element).objectFit), 'cover');
    await page.keyboard.press('Escape');
    await education.waitFor();

    const staticContext = await browser.newContext({ javaScriptEnabled: false });
    await staticContext.route(`${origin}/**`, serveLocalFiles);
    const staticIntro = await staticContext.newPage();
    await staticIntro.goto(introUrl);
    assert.equal(await staticIntro.locator('#intro').isHidden(), true);
    assert.equal(await staticIntro.locator('noscript').innerText(), 'Enable JavaScript to display the HTML résumé.');
});

test('terminal interaction is disabled inside a cross-origin frame', { timeout: 30000 }, async t => {
    const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
    t.after(() => browser.close());
    const context = await browser.newContext();
    const site = 'https://site-fixture.example';
    const embedder = 'https://embedder-fixture.example/';
    await context.route(site + '/**', route => {
        const { pathname } = new URL(route.request().url());
        return route.fulfill({ path: path.join(REPO_ROOT, pathname === '/' ? '/index.html' : pathname) });
    });
    await context.route(embedder, route => route.fulfill({
        contentType: 'text/html',
        body: '<iframe src="' + site + '/"></iframe>'
    }));
    const page = await context.newPage();
    await page.goto(embedder);
    const frame = page.frameLocator('iframe');
    await frame.locator('#terminal-canvas').waitFor({ state: 'attached', timeout: 10000 });
    await frame.locator('body[hidden]').waitFor({ state: 'attached', timeout: 10000 });
});

test('moderation requests carry the issued session token without the password', { timeout: 30000 }, async t => {
    const site = await createStaticServer(REPO_ROOT);
    const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
    t.after(async () => {
        await browser.close();
        await site.close();
    });
    const page = await browser.newPage();
    const api = 'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/';
    const posted = [];
    await page.route(api + '**', route => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/api/terminal/su') {
            return route.fulfill({ json: { ok: true, token: 'fixture-session', expiresAt: Date.now() + 60_000 } });
        }
        if (path.startsWith('/api/blog/delete-')) posted.push(route.request().postDataJSON());
        return route.fulfill({ json: { ok: true, visits: 0, uniqueVisitors: 0, onSite: 0 } });
    });
    await page.goto(site.origin);
    const results = await page.evaluate(async () => {
        const timestamp = '[2026-01-02T03:04:05.000Z]';
        window.prompt = () => 'fixture-password123456';
        await window.executeCommand('su godlike');
        return Promise.all([
            window.deleteBlogEntryByTimestamp(timestamp),
            window.deleteBlogImageByBlockIndex(0),
            window.deleteBlogTextBlockByContext(0, undefined, timestamp)
        ]);
    });
    assert.ok(results.every(result => result.ok));
    assert.equal(posted.length, 3);
    assert.ok(posted.every(body => body.moderationToken === 'fixture-session' && !Object.hasOwn(body, 'password')));
});

test('homepage intro yields to the terminal and stays dismissed in the same browser', { timeout: 30000 }, async t => {
    const site = await createStaticServer(REPO_ROOT);
    const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
    t.after(async () => {
        await browser.close();
        await site.close();
    });
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    await context.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/**', route =>
        route.fulfill({ json: { ok: true, visits: 0, uniqueVisitors: 0, onSite: 0 } })
    );
    const page = await context.newPage();
    const rendererRequests = [];
    page.on('request', request => {
        if (request.url().includes('/vendor/aero-shards/')) rendererRequests.push(request.url());
    });
    await page.goto(site.origin);
    const enter = page.getByRole('button', { name: 'Enter terminal' });
    await enter.waitFor({ timeout: 3000 });
    assert.equal(await enter.evaluate(button => document.activeElement === button), true);
    await page.keyboard.press('Enter');
    await enter.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#terminal-canvas').isVisible(), true);
    assert.equal(new URL(page.url()).pathname, '/');
    await page.reload();
    assert.equal(await enter.isVisible(), false);
    assert.deepEqual(rendererRequests, []);

    const touch = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
    await touch.addInitScript(() => {
        Object.defineProperty(navigator, 'gpu', { value: undefined });
    });
    await touch.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/**', route =>
        route.fulfill({ json: { ok: true, visits: 0, uniqueVisitors: 0, onSite: 0 } })
    );
    const phone = await touch.newPage();
    await phone.goto(site.origin + '/?command=banner');
    assert.equal(await phone.locator('#home-intro').isVisible(), false);
    await phone.goto(site.origin);
    await phone.locator('#home-intro[open]').waitFor();
    await phone.touchscreen.tap(20, 20);
    await phone.locator('#home-intro').waitFor({ state: 'hidden' });
    assert.equal(await phone.locator('#terminal-canvas').isVisible(), true);
});
