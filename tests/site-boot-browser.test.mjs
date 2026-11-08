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

test('the resume command reveals the HTML resume in place after the Nazarick cutscene', { timeout: 65000 }, async t => {
    const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
    t.after(() => browser.close());
    const origin = 'https://resume.test';
    const introUrl = `${origin}/pages/resume-intro.html`;
    const videoPath = '/assets/resume-initial-flash-4k.mp4';
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
    assert.equal(await page.locator('iframe').count(), 0);
    assert.deepEqual(await video.evaluate(element =>
        [element.videoWidth, element.videoHeight, element.textTracks.length]
    ), [3840, 2160, 0]);
    const sound = page.getByRole('button', { name: 'Sound', exact: true });
    const initiallyMuted = await video.evaluate(element => element.muted);
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
    assert.ok(handoffTime >= 11.78 && handoffTime < 12, `Expected the initial Fallen Down flash, got ${handoffTime}s`);
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

    const staticContext = await browser.newContext({ javaScriptEnabled: false });
    await staticContext.route(`${origin}/**`, serveLocalFiles);
    const staticIntro = await staticContext.newPage();
    await staticIntro.goto(introUrl);
    assert.equal(await staticIntro.locator('#intro').isHidden(), true);
    assert.equal(await staticIntro.locator('noscript').innerText(), 'Enable JavaScript to display the HTML résumé.');
});
