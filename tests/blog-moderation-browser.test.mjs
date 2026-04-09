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

async function setupModerationPage(page, origin) {
    await page.addInitScript(() => {
        window.__bannerGlyphDraws = [];
        window.__labelDraws = [];
        window.__mediaDraws = [];
        window.__widgetDraws = [];
        const proto = CanvasRenderingContext2D.prototype;
        const originalFillText = proto.fillText;
        const originalDrawImage = proto.drawImage;
        proto.fillText = function(text, x, y, maxWidth) {
            const matrix = typeof this.getTransform === 'function' ? this.getTransform() : { e: 0, f: 0 };
            const fontMatch = String(this.font || '').match(/(\d+(?:\.\d+)?)px/);
            const fontSize = fontMatch ? Number(fontMatch[1]) : 0;
            if (text === '[delete post]' || text === '[delete media]') {
                window.__labelDraws.push({
                    font: this.font,
                    text,
                    tx: matrix.e,
                    ty: matrix.f,
                    x,
                    y
                });
            }
            if (text === 'Visits:' || text === 'Uniq. Visitors:' || text === 'On-site:') {
                window.__widgetDraws.push({
                    font: this.font,
                    text,
                    tx: matrix.e,
                    ty: matrix.f,
                    x,
                    y
                });
            }
            if (fontSize >= 50 && typeof text === 'string' && text.length === 1 && this.shadowColor === 'transparent' && this.shadowBlur === 0) {
                window.__bannerGlyphDraws.push({
                    font: this.font,
                    text,
                    tx: matrix.e,
                    ty: matrix.f,
                    x,
                    y
                });
            }
            return originalFillText.call(this, text, x, y, maxWidth);
        };
        proto.drawImage = function(...args) {
            if (args.length >= 5 && Number.isFinite(args[3]) && Number.isFinite(args[4]) && args[3] >= 80 && args[4] >= 80) {
                const matrix = typeof this.getTransform === 'function' ? this.getTransform() : { e: 0, f: 0 };
                window.__mediaDraws.push({
                    height: args[4],
                    tx: matrix.e,
                    ty: matrix.f,
                    width: args[3],
                    x: args[1],
                    y: args[2]
                });
            }
            return originalDrawImage.apply(this, args);
        };
        window.prompt = () => 'pw';
    });

    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors', route => route.fulfill({
        body: JSON.stringify({ onSite: 1, uniqueVisitors: 7, visits: 77 }),
        contentType: 'application/json',
        status: 200
    }));
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/track', route => route.fulfill({
        body: JSON.stringify({ onSite: 1, uniqueVisitors: 7, visits: 77 }),
        contentType: 'application/json',
        status: 200
    }));
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/leave', route => route.fulfill({
        body: JSON.stringify({ ok: true }),
        contentType: 'application/json',
        status: 200
    }));
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/terminal/su', route => route.fulfill({
        body: JSON.stringify({ ok: true }),
        contentType: 'application/json',
        status: 200
    }));

    await page.goto(`${origin}/?command=cat%20blog.txt`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await page.evaluate(async () => {
        window.__deleteCalls = {
            entry: [],
            media: []
        };
        window.deleteBlogEntryByTimestamp = async (...args) => {
            window.__deleteCalls.entry.push(args);
            return { ok: true };
        };
        window.deleteBlogImageByBlockIndex = async (...args) => {
            window.__deleteCalls.media.push(args);
            return { ok: true };
        };
        await window.executeCommand('su godlike');
    });
    await page.waitForTimeout(1500);
}

async function getLatestRenderedLabel(page, text) {
    await page.evaluate(() => {
        window.__labelDraws = [];
    });
    await page.waitForTimeout(120);

    return page.evaluate(target => {
        const labels = Array.isArray(window.__labelDraws) ? window.__labelDraws : [];
        return labels.filter(item => item.text === target).at(-1) || null;
    }, text);
}

async function getLatestRenderedMedia(page) {
    await page.evaluate(() => {
        window.__mediaDraws = [];
    });
    await page.waitForTimeout(120);

    return page.evaluate(() => {
        const media = Array.isArray(window.__mediaDraws) ? window.__mediaDraws : [];
        return media.at(-1) || null;
    });
}

async function clickRenderedDeleteLabel(page, text) {
    const label = await getLatestRenderedLabel(page, text);
    assert.ok(label, `expected ${text} to be rendered`);

    const width = await page.evaluate(({ text: labelText, font }) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = font;
        return ctx.measureText(labelText).width;
    }, label);

    await page.mouse.click(label.x + label.tx + width / 2, label.y + label.ty + 8);
    await page.waitForTimeout(200);
}

async function clickRenderedDeleteButtonPadding(page, text, side = 'right') {
    const label = await getLatestRenderedLabel(page, text);
    assert.ok(label, `expected ${text} to be rendered`);

    const width = await page.evaluate(({ text: labelText, font }) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = font;
        return ctx.measureText(labelText).width;
    }, label);

    const x = side === 'left'
        ? label.x + label.tx - 4
        : label.x + label.tx + width + 4;

    await page.mouse.click(x, label.y + label.ty + 8);
    await page.waitForTimeout(200);
}

async function setupRootEditorialPage(page, origin) {
    await page.addInitScript(() => {
        window.__bannerGlyphDraws = [];
        window.__labelDraws = [];
        window.__mediaDraws = [];
        window.__widgetDraws = [];
        const proto = CanvasRenderingContext2D.prototype;
        const originalFillText = proto.fillText;
        const originalDrawImage = proto.drawImage;
        proto.fillText = function(text, x, y, maxWidth) {
            const matrix = typeof this.getTransform === 'function' ? this.getTransform() : { e: 0, f: 0 };
            const fontMatch = String(this.font || '').match(/(\d+(?:\.\d+)?)px/);
            const fontSize = fontMatch ? Number(fontMatch[1]) : 0;
            if (text === 'Visits:' || text === 'Uniq. Visitors:' || text === 'On-site:') {
                window.__widgetDraws.push({
                    font: this.font,
                    text,
                    tx: matrix.e,
                    ty: matrix.f,
                    x,
                    y
                });
            }
            if (fontSize >= 50 && typeof text === 'string' && text.length === 1 && this.shadowColor === 'transparent' && this.shadowBlur === 0) {
                window.__bannerGlyphDraws.push({
                    font: this.font,
                    text,
                    tx: matrix.e,
                    ty: matrix.f,
                    x,
                    y
                });
            }
            return originalFillText.call(this, text, x, y, maxWidth);
        };
        proto.drawImage = function(...args) {
            if (args.length >= 5 && Number.isFinite(args[3]) && Number.isFinite(args[4]) && args[3] >= 80 && args[4] >= 80) {
                const matrix = typeof this.getTransform === 'function' ? this.getTransform() : { e: 0, f: 0 };
                window.__mediaDraws.push({
                    height: args[4],
                    tx: matrix.e,
                    ty: matrix.f,
                    width: args[3],
                    x: args[1],
                    y: args[2]
                });
            }
            return originalDrawImage.apply(this, args);
        };
    });

    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors', route => route.fulfill({
        body: JSON.stringify({ onSite: 1, uniqueVisitors: 7, visits: 77 }),
        contentType: 'application/json',
        status: 200
    }));
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/track', route => route.fulfill({
        body: JSON.stringify({ onSite: 1, uniqueVisitors: 7, visits: 77 }),
        contentType: 'application/json',
        status: 200
    }));
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/leave', route => route.fulfill({
        body: JSON.stringify({ ok: true }),
        contentType: 'application/json',
        status: 200
    }));
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/terminal/su', route => route.fulfill({
        body: JSON.stringify({ ok: true }),
        contentType: 'application/json',
        status: 200
    }));

    await page.goto(`${origin}/?command=banner`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
}

async function getLatestWidgetLabels(page) {
    await page.evaluate(() => {
        window.__widgetDraws = [];
    });
    await page.waitForTimeout(120);

    return page.evaluate(() => {
        const labels = ['Visits:', 'Uniq. Visitors:', 'On-site:'];
        const draws = Array.isArray(window.__widgetDraws) ? window.__widgetDraws : [];
        return labels.map(label => {
            const match = draws.filter(item => item.text === label).at(-1);
            return match ? {
                ...match,
                screenX: match.x + match.tx,
                screenY: match.y + match.ty
            } : null;
        });
    });
}

async function getLatestBannerGlyphCenters(page) {
    await page.evaluate(() => {
        window.__bannerGlyphDraws = [];
    });
    await page.waitForTimeout(120);

    return page.evaluate(() => {
        const draws = Array.isArray(window.__bannerGlyphDraws) ? window.__bannerGlyphDraws.slice(-64) : [];
        const positions = draws
            .map(draw => draw.x + draw.tx)
            .sort((left, right) => left - right);
        const centers = [];
        positions.forEach(position => {
            const last = centers[centers.length - 1];
            if (!last || Math.abs(position - last[last.length - 1]) > 12) {
                centers.push([position]);
                return;
            }
            last.push(position);
        });
        return centers.map(group => group.reduce((sum, value) => sum + value, 0) / group.length);
    });
}
test('godlike delete controls respond when clicking the rendered label centers', { timeout: 120000 }, async t => {
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

    const postPage = await browser.newPage({
        viewport: { height: 822, width: 679 }
    });
    await setupModerationPage(postPage, server.origin);
    await clickRenderedDeleteLabel(postPage, '[delete post]');
    const postCalls = await postPage.evaluate(() => window.__deleteCalls);
    assert.equal(postCalls.entry.length, 1, 'expected the post delete handler to fire');
    await postPage.close();

    const mediaPage = await browser.newPage({
        viewport: { height: 822, width: 679 }
    });
    await setupModerationPage(mediaPage, server.origin);
    await clickRenderedDeleteLabel(mediaPage, '[delete media]');
    const mediaCalls = await mediaPage.evaluate(() => window.__deleteCalls);
    assert.equal(mediaCalls.media.length, 1, 'expected the media delete handler to fire');
    await mediaPage.close();
});

test('godlike delete controls respond when clicking inside the rendered button padding', { timeout: 120000 }, async t => {
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

    const postPage = await browser.newPage({
        viewport: { height: 822, width: 679 }
    });
    await setupModerationPage(postPage, server.origin);
    await clickRenderedDeleteButtonPadding(postPage, '[delete post]');
    const postCalls = await postPage.evaluate(() => window.__deleteCalls);
    assert.equal(postCalls.entry.length, 1, 'expected the padded post delete click to fire');
    await postPage.close();

    const mediaPage = await browser.newPage({
        viewport: { height: 822, width: 679 }
    });
    await setupModerationPage(mediaPage, server.origin);
    await clickRenderedDeleteButtonPadding(mediaPage, '[delete media]');
    const mediaCalls = await mediaPage.evaluate(() => window.__deleteCalls);
    assert.equal(mediaCalls.media.length, 1, 'expected the padded media delete click to fire');
    await mediaPage.close();
});

test('godlike post delete stays clickable after dragging media across it', { timeout: 120000 }, async t => {
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
        viewport: { height: 822, width: 679 }
    });
    t.after(async () => {
        await page.close();
    });

    await setupModerationPage(page, server.origin);

    const media = await getLatestRenderedMedia(page);
    assert.ok(media, 'expected a rendered blog media item');
    const initialLabel = await getLatestRenderedLabel(page, '[delete post]');
    assert.ok(initialLabel, 'expected a rendered post delete label');

    const targetX = initialLabel.x + initialLabel.tx + 52;
    const targetY = initialLabel.y + initialLabel.ty + 8;
    await page.mouse.move(media.x + media.tx + media.width / 2, media.y + media.ty + media.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetX, targetY, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    await clickRenderedDeleteLabel(page, '[delete post]');
    const deleteCalls = await page.evaluate(() => window.__deleteCalls);
    assert.equal(deleteCalls.entry.length, 1, 'expected the overlapped post delete handler to fire');
});

test('root keeps guest banner/widget geometry and drags the widget as a whole', { timeout: 120000 }, async t => {
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

    await setupRootEditorialPage(page, server.origin);
    const guestWidget = await getLatestWidgetLabels(page);
    const guestBanner = await getLatestBannerGlyphCenters(page);

    await page.evaluate(async () => {
        await window.executeCommand('su');
        await window.executeCommand('cat blog.txt');
    });
    await page.waitForTimeout(1800);
    await page.keyboard.press('Home');
    await page.waitForTimeout(200);

    const rootWidget = await getLatestWidgetLabels(page);
    const rootBanner = await getLatestBannerGlyphCenters(page);

    guestWidget.forEach((label, index) => {
        assert.ok(label, `expected guest widget label ${index}`);
        assert.ok(rootWidget[index], `expected root widget label ${index}`);
        assert.ok(Math.abs(rootWidget[index].screenX - label.screenX) <= 2, `expected widget label ${label.text} to keep the guest x position`);
    });

    assert.equal(rootBanner.length, guestBanner.length, 'expected the banner glyph cluster count to stay stable');
    rootBanner.forEach((position, index) => {
        assert.ok(Math.abs(position - guestBanner[index]) <= 2, 'expected root banner glyph centers to match the guest layout');
    });

    const dragStart = rootWidget[0];
    await page.mouse.move(dragStart.screenX + 80, dragStart.screenY + 18);
    await page.mouse.down();
    await page.mouse.move(dragStart.screenX + 320, dragStart.screenY + 18, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const movedWidget = await getLatestWidgetLabels(page);
    const deltas = movedWidget.map((label, index) => label.screenX - rootWidget[index].screenX);
    deltas.forEach(delta => {
        assert.ok(delta > 140, 'expected the widget labels to move to the right together');
    });
    deltas.slice(1).forEach(delta => {
        assert.ok(Math.abs(delta - deltas[0]) <= 2, 'expected the whole widget to move as a single block');
    });
});
