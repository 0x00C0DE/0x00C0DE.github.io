import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

import { chromium, devices } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const CHROME_PATH = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const MOBILE_DEVICE = devices['iPhone 13'];

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

async function createPage(t, options = {}) {
    const browser = await chromium.launch({
        executablePath: CHROME_PATH,
        headless: true
    });
    t.after(async () => {
        await browser.close();
    });

    const page = await browser.newPage(
        options.mobile
            ? { ...MOBILE_DEVICE }
            : { viewport: { width: 1280, height: 720 } }
    );
    t.after(async () => {
        await page.close();
    });

    return page;
}

async function stubVisitorApis(page, stats = { onSite: 4, uniqueVisitors: 23, visits: 456 }) {
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors', route => route.fulfill({
        body: JSON.stringify(stats),
        contentType: 'application/json',
        status: 200
    }));
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/track', route => route.fulfill({
        body: JSON.stringify(stats),
        contentType: 'application/json',
        status: 200
    }));
    await page.route('https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/leave', route => route.fulfill({
        body: JSON.stringify({ ok: true }),
        contentType: 'application/json',
        status: 200
    }));
}

async function installHelpDrawCapture(page) {
    await page.addInitScript(() => {
        window.__helpDraws = [];
        window.__mediaDraws = [];
        window.__strokeRects = [];
        const proto = CanvasRenderingContext2D.prototype;
        const originalFillText = proto.fillText;
        const originalDrawImage = proto.drawImage;
        const originalStrokeRect = proto.strokeRect;
        proto.fillText = function(text, x, y, maxWidth) {
            const matrix = typeof this.getTransform === 'function' ? this.getTransform() : { e: 0, f: 0 };
            window.__helpDraws.push({
                fillStyle: String(this.fillStyle),
                font: String(this.font),
                text: String(text),
                width: this.measureText(String(text)).width,
                x: x + matrix.e,
                y: y + matrix.f
            });
            return originalFillText.call(this, text, x, y, maxWidth);
        };
        proto.drawImage = function(image, ...args) {
            const matrix = typeof this.getTransform === 'function' ? this.getTransform() : { e: 0, f: 0 };
            const sourceKind = image instanceof HTMLVideoElement
                ? 'video'
                : image instanceof HTMLImageElement
                    ? 'image'
                    : image instanceof HTMLCanvasElement
                        ? 'canvas'
                        : typeof image;
            if ((sourceKind === 'image' || sourceKind === 'video') && args.length >= 4) {
                window.__mediaDraws.push({
                    height: Number(args[3]) || 0,
                    sourceKind,
                    width: Number(args[2]) || 0,
                    x: Number(args[0]) + matrix.e,
                    y: Number(args[1]) + matrix.f
                });
            }
            return originalDrawImage.call(this, image, ...args);
        };
        proto.strokeRect = function(x, y, width, height) {
            const matrix = typeof this.getTransform === 'function' ? this.getTransform() : { e: 0, f: 0 };
            window.__strokeRects.push({
                height: Number(height) || 0,
                strokeStyle: String(this.strokeStyle),
                width: Number(width) || 0,
                x: Number(x) + matrix.e,
                y: Number(y) + matrix.f
            });
            return originalStrokeRect.call(this, x, y, width, height);
        };
    });
}

function dedupeByKey(entries, keyForEntry) {
    const deduped = new Map();
    (Array.isArray(entries) ? entries : []).forEach(entry => {
        const key = keyForEntry(entry);
        if (!deduped.has(key)) {
            deduped.set(key, entry);
        }
    });
    return [...deduped.values()];
}

function normalizeCapturedScene(raw, commands = []) {
    return {
        commands,
        draws: dedupeByKey(raw?.draws, draw => [
            draw.text,
            Math.round(draw.x * 10) / 10,
            Math.round(draw.y * 10) / 10,
            draw.fillStyle,
            draw.font
        ].join('|')).sort((left, right) => left.y - right.y || left.x - right.x),
        mediaDraws: dedupeByKey(raw?.mediaDraws, draw => [
            Math.round(draw.x * 10) / 10,
            Math.round(draw.y * 10) / 10,
            Math.round(draw.width * 10) / 10,
            Math.round(draw.height * 10) / 10,
            draw.sourceKind
        ].join('|')).sort((left, right) => left.y - right.y || left.x - right.x),
        strokeRects: dedupeByKey(raw?.strokeRects, rect => [
            Math.round(rect.x * 10) / 10,
            Math.round(rect.y * 10) / 10,
            Math.round(rect.width * 10) / 10,
            Math.round(rect.height * 10) / 10,
            rect.strokeStyle
        ].join('|')).sort((left, right) => left.y - right.y || left.x - right.x)
    };
}

async function bootTerminal(page, origin) {
    await page.goto(origin, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.executeCommand === 'function');
    await page.waitForTimeout(2500);
}

async function setTerminalUser(page, user = 'guest') {
    await page.evaluate(async selectedUser => {
        if (selectedUser === 'root') {
            await window.executeCommand('su');
            return;
        }
        if (selectedUser === 'guest' || selectedUser === 'godlike') {
            window.setTerminalSessionState({
                shell: 'default',
                user: selectedUser
            });
        }
    }, user);
}

async function runTerminalCommands(page, commands = []) {
    await page.evaluate(async commandList => {
        for (const command of Array.isArray(commandList) ? commandList : []) {
            await window.executeCommand(command);
        }
    }, commands);
}

async function resetCanvasCaptures(page) {
    await page.evaluate(() => {
        window.__helpDraws.length = 0;
        window.__mediaDraws.length = 0;
        window.__strokeRects.length = 0;
    });
}

async function readCapturedScene(page, commands = []) {
    const raw = await page.evaluate(() => ({
        draws: Array.isArray(window.__helpDraws) ? window.__helpDraws.slice() : [],
        mediaDraws: Array.isArray(window.__mediaDraws) ? window.__mediaDraws.slice() : [],
        strokeRects: Array.isArray(window.__strokeRects) ? window.__strokeRects.slice() : []
    }));
    return normalizeCapturedScene(raw, commands);
}

async function renderHelp(page, origin, options = {}) {
    await bootTerminal(page, origin);
    await setTerminalUser(page, options.user || 'guest');
    await runTerminalCommands(page, options.preCommands || []);
    await resetCanvasCaptures(page);
    await runTerminalCommands(page, ['help']);
    await page.waitForFunction(() => {
        const entries = window.help_command()
            .filter(entry => entry && typeof entry === 'object' && entry.type === 'help-entry')
            .map(entry => entry.command);
        return Array.isArray(window.__helpDraws) && window.__helpDraws.some(draw => entries.includes(draw?.text));
    }, { timeout: 10000 });
    await page.waitForTimeout(150);

    const commands = await page.evaluate(() => window.help_command()
        .filter(entry => entry && typeof entry === 'object' && entry.type === 'help-entry')
        .map(entry => entry.command));
    return readCapturedScene(page, commands);
}

function getHelpRow(rendered, commandText) {
    const commandDraw = rendered.draws.find(draw => draw.text === commandText);
    assert.ok(commandDraw, `expected a standalone draw for "${commandText}"`);

    const separatorDraw = rendered.draws.find(draw => draw.y === commandDraw.y && draw.text === ' - ');
    assert.ok(separatorDraw, `expected a separator draw for "${commandText}"`);

    const commandIndex = rendered.commands.indexOf(commandText);
    const nextCommandText = rendered.commands[commandIndex + 1] || null;
    const nextCommandDraw = nextCommandText
        ? rendered.draws.find(draw => draw.text === nextCommandText && draw.y > commandDraw.y)
        : null;
    const nextBoundaryY = nextCommandDraw ? nextCommandDraw.y : Number.POSITIVE_INFINITY;
    const descriptionDraw = rendered.draws.find(draw => (
        draw.y >= commandDraw.y - 0.5
        && draw.y < nextBoundaryY - 0.5
        && !rendered.commands.includes(draw.text)
        && draw.text !== ' - '
    ));
    assert.ok(descriptionDraw, `expected a description draw for "${commandText}"`);

    return {
        commandDraw,
        descriptionDraw,
        separatorDraw
    };
}

function rectsOverlap(left, right) {
    return (
        left.x < right.x + right.width
        && left.x + left.width > right.x
        && left.y < right.y + right.height
        && left.y + left.height > right.y
    );
}

function getVisibleMediaRects(rendered) {
    return (Array.isArray(rendered.mediaDraws) ? rendered.mediaDraws : [])
        .filter(draw => draw.width >= 100 && draw.height >= 100);
}

async function getFirstVisibleMediaRect(page) {
    return page.evaluate(() => {
        const deduped = new Map();
        (Array.isArray(window.__mediaDraws) ? window.__mediaDraws : []).forEach(draw => {
            if (!(draw.width >= 100 && draw.height >= 100)) {
                return;
            }
            const key = [
                Math.round(draw.x * 10) / 10,
                Math.round(draw.y * 10) / 10,
                Math.round(draw.width * 10) / 10,
                Math.round(draw.height * 10) / 10,
                draw.sourceKind
            ].join('|');
            if (!deduped.has(key)) {
                deduped.set(key, draw);
            }
        });
        const visible = [...deduped.values()].sort((left, right) => left.y - right.y || left.x - right.x);
        return visible[0] || null;
    });
}

async function dispatchPointerEvent(page, type, point, options = {}) {
    await page.dispatchEvent('#terminal-canvas', type, {
        bubbles: true,
        clientX: point.x,
        clientY: point.y,
        isPrimary: true,
        pointerId: options.pointerId || 1,
        pointerType: options.pointerType || 'mouse'
    });
}

async function dragFirstVisibleMedia(page, target, options = {}) {
    await page.waitForFunction(() => (
        Array.isArray(window.__mediaDraws)
        && window.__mediaDraws.some(draw => draw.width >= 100 && draw.height >= 100)
    ), { timeout: 10000 });
    const rect = await getFirstVisibleMediaRect(page);
    assert.ok(rect, 'expected at least one visible media rect to drag');

    const start = {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2
    };
    const end = {
        x: target.x + rect.width / 2,
        y: target.y + rect.height / 2
    };
    await dispatchPointerEvent(page, 'pointerdown', start, options);
    await dispatchPointerEvent(page, 'pointermove', end, options);
    await dispatchPointerEvent(page, 'pointerup', end, options);
    await page.waitForTimeout(250);
}

async function scrollTerminalToTop(page) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
        await page.dispatchEvent('#terminal-canvas', 'wheel', {
            bubbles: true,
            cancelable: true,
            deltaY: -10000
        });
        await page.waitForTimeout(120);
    }
}

async function waitForTestHooks(page) {
    await page.waitForFunction(() => Boolean(window.__terminalCanvasTestHooks));
}

async function captureSettledScene(page, commands = []) {
    await resetCanvasCaptures(page);
    await page.waitForTimeout(200);
    return readCapturedScene(page, commands);
}

function roundLineY(y) {
    return Math.round(y * 2) / 2;
}

function getFontSizePx(font) {
    const match = /(\d+(?:\.\d+)?)px\b/i.exec(String(font || ''));
    return match ? Number(match[1]) : NaN;
}

function getEntryDescriptionLines(rendered, commandText) {
    const commandDraws = rendered.draws
        .filter(draw => rendered.commands.includes(draw.text))
        .sort((left, right) => left.y - right.y || left.x - right.x);
    const entryIndex = commandDraws.findIndex(draw => draw.text === commandText);
    assert.notEqual(entryIndex, -1, `expected a standalone draw for "${commandText}"`);

    const currentCommandDraw = commandDraws[entryIndex];
    const nextCommandDraw = commandDraws.slice(entryIndex + 1).find(draw => draw.y > currentCommandDraw.y + 0.5);
    const nextBoundaryY = nextCommandDraw ? nextCommandDraw.y : Number.POSITIVE_INFINITY;
    const descriptionDraws = rendered.draws.filter(draw => {
        if (draw.y < currentCommandDraw.y - 0.5 || draw.y >= nextBoundaryY - 0.5) {
            return false;
        }
        if (draw.text === commandText || draw.text === ' - ') {
            return false;
        }
        return !rendered.commands.includes(draw.text);
    });

    const lineStarts = new Map();
    descriptionDraws.forEach(draw => {
        const key = roundLineY(draw.y);
        const previous = lineStarts.get(key);
        if (!previous || draw.x < previous.x) {
            lineStarts.set(key, draw);
        }
    });

    return {
        commandDraw: currentCommandDraw,
        lineStarts: [...lineStarts.values()].sort((left, right) => left.y - right.y)
    };
}

function getHelpRowGeometry(rendered, commandText) {
    const row = getHelpRow(rendered, commandText);
    return {
        commandX: row.commandDraw.x,
        commandY: row.commandDraw.y,
        descriptionOffsetX: row.descriptionDraw.x - row.commandDraw.x,
        separatorOffsetX: row.separatorDraw.x - row.commandDraw.x
    };
}

function getBannerTitleBounds(rendered) {
    const titleGlyphs = rendered.draws.filter(draw => (
        draw.fillStyle === '#ff6b78'
        && getFontSizePx(draw.font) >= 40
        && /^[0xCDE]$/.test(draw.text)
    ));
    assert.ok(titleGlyphs.length > 0, 'expected banner glyph draws');
    const minX = Math.min(...titleGlyphs.map(draw => draw.x));
    const minY = Math.min(...titleGlyphs.map(draw => draw.y));
    const maxX = Math.max(...titleGlyphs.map(draw => draw.x + draw.width));
    const maxY = Math.max(...titleGlyphs.map(draw => draw.y + getFontSizePx(draw.font)));
    return {
        height: maxY - minY,
        width: maxX - minX,
        x: minX,
        y: minY
    };
}

function getWidgetOuterRect(rendered) {
    const widgetRect = rendered.strokeRects.find(rect => (
        rect.strokeStyle === 'rgba(255, 143, 153, 0.65)'
        && rect.width >= 200
        && rect.height >= 80
    ));
    assert.ok(widgetRect, 'expected the visitor widget border');
    return widgetRect;
}

test('help lists video and mypic instead of the old movie and picture command names', { timeout: 120000 }, async t => {
    const server = await createStaticServer(REPO_ROOT);
    t.after(async () => {
        await server.close();
    });

    const page = await createPage(t);
    await stubVisitorApis(page);
    await bootTerminal(page, server.origin);

    const commands = await page.evaluate(() => window.help_command()
        .filter(entry => entry && typeof entry === 'object' && entry.type === 'help-entry')
        .map(entry => entry.command));

    assert.ok(commands.includes('video [w h]'));
    assert.ok(commands.includes('mypic [w h]'));
    assert.ok(!commands.includes('movie [w h]'));
    assert.ok(!commands.includes('picture [w h]'));
});

test('desktop help commands stay on the terminal text color instead of bright white', { timeout: 120000 }, async t => {
    const server = await createStaticServer(REPO_ROOT);
    t.after(async () => {
        await server.close();
    });

    const page = await createPage(t);
    await installHelpDrawCapture(page);
    await stubVisitorApis(page);

    const rendered = await renderHelp(page, server.origin);
    const commandDraw = rendered.draws.find(draw => draw.text === 'help');
    const descriptionDraw = rendered.draws.find(draw => draw.text === 'Show this help message');

    assert.ok(commandDraw, 'expected a standalone help command draw');
    assert.ok(descriptionDraw, 'expected the help description draw');
    assert.equal(commandDraw.fillStyle, descriptionDraw.fillStyle);
    assert.doesNotMatch(commandDraw.fillStyle, /^#fff/i);
});

test('root desktop help keeps the same tabular command and description columns as guest', { timeout: 120000 }, async t => {
    const server = await createStaticServer(REPO_ROOT);
    t.after(async () => {
        await server.close();
    });

    const page = await createPage(t);
    await installHelpDrawCapture(page);
    await stubVisitorApis(page);

    const guestRendered = await renderHelp(page, server.origin, { user: 'guest' });
    const rootRendered = await renderHelp(page, server.origin, { user: 'root' });
    const guestRow = getHelpRow(guestRendered, 'help');
    const rootRow = getHelpRow(rootRendered, 'help');

    assert.ok(Math.abs(rootRow.commandDraw.x - guestRow.commandDraw.x) <= 1);
    assert.ok(Math.abs(rootRow.separatorDraw.x - guestRow.separatorDraw.x) <= 1);
    assert.ok(Math.abs(rootRow.descriptionDraw.x - guestRow.descriptionDraw.x) <= 1);
});

test('root desktop help keeps the same row geometry while dragged media still pushes it around', { timeout: 120000 }, async t => {
    const server = await createStaticServer(REPO_ROOT);
    t.after(async () => {
        await server.close();
    });

    const baselinePage = await createPage(t);
    await installHelpDrawCapture(baselinePage);
    await stubVisitorApis(baselinePage);
    const baselineRendered = await renderHelp(baselinePage, server.origin, { user: 'root' });
    const baselinePosition = await baselinePage.evaluate(() => window.__terminalCanvasTestHooks.getHelpBlock('userpic [w h]'));

    const page = await createPage(t);
    await installHelpDrawCapture(page);
    await stubVisitorApis(page);
    await bootTerminal(page, server.origin);
    await waitForTestHooks(page);
    await setTerminalUser(page, 'root');
    await runTerminalCommands(page, ['clear', 'cat blog.txt', 'help']);
    const obstaclePosition = await page.evaluate(() => {
        const hooks = window.__terminalCanvasTestHooks;
        const helpBlock = hooks.getHelpBlock('userpic [w h]');
        hooks.pinFirstEditorialMedia({
            x: 0,
            y: Math.max(0, helpBlock.top - 16)
        });
        const updatedHelpBlock = hooks.getHelpBlock('userpic [w h]');
        hooks.setScrollTop(Math.max(0, updatedHelpBlock.top - 140));
        return {
            after: updatedHelpBlock,
            before: helpBlock
        };
    });
    const commands = await page.evaluate(() => window.help_command()
        .filter(entry => entry && typeof entry === 'object' && entry.type === 'help-entry')
        .map(entry => entry.command));
    await resetCanvasCaptures(page);
    await page.waitForFunction(() => Array.isArray(window.__helpDraws) && window.__helpDraws.some(draw => draw?.text === 'userpic [w h]'));
    const obstacleRendered = await readCapturedScene(page, commands);
    const baselineRow = getHelpRowGeometry(baselineRendered, 'userpic [w h]');
    const obstacleRow = getHelpRowGeometry(obstacleRendered, 'userpic [w h]');

    assert.ok(Math.abs(obstacleRow.separatorOffsetX - baselineRow.separatorOffsetX) <= 1);
    assert.ok(Math.abs(obstacleRow.descriptionOffsetX - baselineRow.descriptionOffsetX) <= 1);
    assert.ok(
        Math.abs(obstaclePosition.after.top - obstaclePosition.before.top) > 20,
        `expected pinned media to move the root help row, before=${JSON.stringify(obstaclePosition.before)} after=${JSON.stringify(obstaclePosition.after)} baseline=${JSON.stringify(baselinePosition)}`
    );
});

test('mobile help keeps wrapped descriptions aligned under the description column', { timeout: 120000 }, async t => {
    const server = await createStaticServer(REPO_ROOT);
    t.after(async () => {
        await server.close();
    });

    const page = await createPage(t, { mobile: true });
    await installHelpDrawCapture(page);
    await stubVisitorApis(page);

    const rendered = await renderHelp(page, server.origin);
    const entry = getEntryDescriptionLines(rendered, 'userpic [w h]');

    assert.ok(entry.lineStarts.length >= 2, 'expected userpic help description to wrap on mobile');
    assert.ok(
        entry.lineStarts.every(draw => draw.x > entry.commandDraw.x + 40),
        'expected wrapped description lines to stay indented past the command column'
    );
    assert.ok(
        Math.abs(entry.lineStarts[0].x - entry.lineStarts[1].x) <= 1,
        'expected wrapped description lines to share a single description-column alignment'
    );
});

test('root mobile help keeps the same wrapped description column as guest and godlike', { timeout: 120000 }, async t => {
    const server = await createStaticServer(REPO_ROOT);
    t.after(async () => {
        await server.close();
    });

    const page = await createPage(t, { mobile: true });
    await installHelpDrawCapture(page);
    await stubVisitorApis(page);

    const guestRendered = await renderHelp(page, server.origin, { user: 'guest' });
    const rootRendered = await renderHelp(page, server.origin, { user: 'root' });
    const godlikeRendered = await renderHelp(page, server.origin, { user: 'godlike' });
    const guestEntry = getEntryDescriptionLines(guestRendered, 'userpic [w h]');
    const rootEntry = getEntryDescriptionLines(rootRendered, 'userpic [w h]');
    const godlikeEntry = getEntryDescriptionLines(godlikeRendered, 'userpic [w h]');

    assert.ok(Math.abs(rootEntry.commandDraw.x - guestEntry.commandDraw.x) <= 1);
    assert.ok(Math.abs(rootEntry.lineStarts[0].x - guestEntry.lineStarts[0].x) <= 1);
    assert.ok(Math.abs(rootEntry.lineStarts[0].x - godlikeEntry.lineStarts[0].x) <= 1);
});

test('root mobile help keeps the same row geometry while dragged media still pushes it around', { timeout: 120000 }, async t => {
    const server = await createStaticServer(REPO_ROOT);
    t.after(async () => {
        await server.close();
    });

    const baselinePage = await createPage(t, { mobile: true });
    await installHelpDrawCapture(baselinePage);
    await stubVisitorApis(baselinePage);
    const baselineRendered = await renderHelp(baselinePage, server.origin, { user: 'root' });
    const baselinePosition = await baselinePage.evaluate(() => window.__terminalCanvasTestHooks.getHelpBlock('userpic [w h]'));

    const page = await createPage(t, { mobile: true });
    await installHelpDrawCapture(page);
    await stubVisitorApis(page);
    await bootTerminal(page, server.origin);
    await waitForTestHooks(page);
    await setTerminalUser(page, 'root');
    await runTerminalCommands(page, ['clear', 'cat blog.txt', 'help']);
    const obstaclePosition = await page.evaluate(() => {
        const hooks = window.__terminalCanvasTestHooks;
        const helpBlock = hooks.getHelpBlock('userpic [w h]');
        hooks.pinFirstEditorialMedia({
            x: 0,
            y: Math.max(0, helpBlock.top - 12)
        });
        const updatedHelpBlock = hooks.getHelpBlock('userpic [w h]');
        hooks.setScrollTop(Math.max(0, updatedHelpBlock.top - 120));
        return {
            after: updatedHelpBlock,
            before: helpBlock
        };
    });
    const commands = await page.evaluate(() => window.help_command()
        .filter(entry => entry && typeof entry === 'object' && entry.type === 'help-entry')
        .map(entry => entry.command));
    await resetCanvasCaptures(page);
    await page.waitForFunction(() => Array.isArray(window.__helpDraws) && window.__helpDraws.some(draw => draw?.text === 'userpic [w h]'));
    const obstacleRendered = await readCapturedScene(page, commands);
    const baselineEntry = getEntryDescriptionLines(baselineRendered, 'userpic [w h]');
    const obstacleEntry = getEntryDescriptionLines(obstacleRendered, 'userpic [w h]');

    assert.ok(
        Math.abs((obstacleEntry.lineStarts[0].x - obstacleEntry.commandDraw.x) - (baselineEntry.lineStarts[0].x - baselineEntry.commandDraw.x)) <= 1
    );
    assert.ok(
        Math.abs(obstaclePosition.after.top - obstaclePosition.before.top) > 20,
        `expected pinned media to move the mobile root help entry, before=${JSON.stringify(obstaclePosition.before)} after=${JSON.stringify(obstaclePosition.after)} baseline=${JSON.stringify(baselinePosition)}`
    );
});

test('root desktop banner and widget keep the same geometry while dragged media still pushes them around', { timeout: 120000 }, async t => {
    const server = await createStaticServer(REPO_ROOT);
    t.after(async () => {
        await server.close();
    });

    const baselinePage = await createPage(t);
    await installHelpDrawCapture(baselinePage);
    await stubVisitorApis(baselinePage);
    await bootTerminal(baselinePage, server.origin);
    await waitForTestHooks(baselinePage);
    await setTerminalUser(baselinePage, 'root');
    await runTerminalCommands(baselinePage, ['clear']);
    await runTerminalCommands(baselinePage, ['banner']);
    await baselinePage.evaluate(() => window.__terminalCanvasTestHooks.setScrollTop(0));
    await resetCanvasCaptures(baselinePage);
    await baselinePage.waitForFunction(() => Array.isArray(window.__helpDraws) && window.__helpDraws.some(draw => draw.fillStyle === '#ff6b78' && /^(0|x|C|D|E)$/.test(draw.text)));
    const baselineRendered = await readCapturedScene(baselinePage);

    const page = await createPage(t);
    await installHelpDrawCapture(page);
    await stubVisitorApis(page);
    await bootTerminal(page, server.origin);
    await waitForTestHooks(page);
    await setTerminalUser(page, 'root');
    await runTerminalCommands(page, ['clear', 'banner', 'cat blog.txt']);
    await page.evaluate(() => {
        const hooks = window.__terminalCanvasTestHooks;
        const bannerBlock = hooks.getBannerBlock();
        hooks.pinFirstEditorialMedia({
            x: 0,
            y: Math.max(0, bannerBlock.top)
        });
        hooks.setScrollTop(0);
    });
    await resetCanvasCaptures(page);
    await page.waitForFunction(() => Array.isArray(window.__helpDraws) && window.__helpDraws.some(draw => draw.fillStyle === '#ff6b78' && /^(0|x|C|D|E)$/.test(draw.text)));
    const obstacleRendered = await readCapturedScene(page);
    const baselineBanner = getBannerTitleBounds(baselineRendered);
    const obstacleBanner = getBannerTitleBounds(obstacleRendered);
    const baselineWidget = getWidgetOuterRect(baselineRendered);
    const obstacleWidget = getWidgetOuterRect(obstacleRendered);

    assert.ok(Math.abs(obstacleBanner.width - baselineBanner.width) <= 2);
    assert.ok(
        obstacleBanner.x > baselineBanner.x + 30 || obstacleBanner.y > baselineBanner.y + 30,
        `expected dragged media to move the banner, baseline=${JSON.stringify(baselineBanner)} obstacle=${JSON.stringify(obstacleBanner)}`
    );
    assert.ok(Math.abs(obstacleWidget.width - baselineWidget.width) <= 1);
    assert.ok(Math.abs(obstacleWidget.height - baselineWidget.height) <= 1);
    assert.ok(
        obstacleWidget.x > baselineWidget.x + 30 || obstacleWidget.y > baselineWidget.y + 30,
        `expected dragged media to move the widget, baseline=${JSON.stringify(baselineWidget)} obstacle=${JSON.stringify(obstacleWidget)}`
    );
});

test('root mobile banner and widget keep the same geometry while dragged media still pushes them around', { timeout: 120000 }, async t => {
    const server = await createStaticServer(REPO_ROOT);
    t.after(async () => {
        await server.close();
    });

    const baselinePage = await createPage(t, { mobile: true });
    await installHelpDrawCapture(baselinePage);
    await stubVisitorApis(baselinePage);
    await bootTerminal(baselinePage, server.origin);
    await waitForTestHooks(baselinePage);
    await setTerminalUser(baselinePage, 'root');
    await runTerminalCommands(baselinePage, ['clear']);
    await runTerminalCommands(baselinePage, ['banner']);
    await baselinePage.evaluate(() => window.__terminalCanvasTestHooks.setScrollTop(0));
    await resetCanvasCaptures(baselinePage);
    await baselinePage.waitForFunction(() => Array.isArray(window.__helpDraws) && window.__helpDraws.some(draw => draw.fillStyle === '#ff6b78' && /^(0|x|C|D|E)$/.test(draw.text)));
    const baselineRendered = await readCapturedScene(baselinePage);

    const page = await createPage(t, { mobile: true });
    await installHelpDrawCapture(page);
    await stubVisitorApis(page);
    await bootTerminal(page, server.origin);
    await waitForTestHooks(page);
    await setTerminalUser(page, 'root');
    await runTerminalCommands(page, ['clear', 'banner', 'cat blog.txt']);
    await page.evaluate(() => {
        const hooks = window.__terminalCanvasTestHooks;
        const bannerBlock = hooks.getBannerBlock();
        hooks.pinFirstEditorialMedia({
            x: 0,
            y: Math.max(0, bannerBlock.top)
        });
        hooks.setScrollTop(0);
    });
    await resetCanvasCaptures(page);
    await page.waitForFunction(() => Array.isArray(window.__helpDraws) && window.__helpDraws.some(draw => draw.fillStyle === '#ff6b78' && /^(0|x|C|D|E)$/.test(draw.text)));
    const obstacleRendered = await readCapturedScene(page);
    const baselineBanner = getBannerTitleBounds(baselineRendered);
    const obstacleBanner = getBannerTitleBounds(obstacleRendered);
    const baselineWidget = getWidgetOuterRect(baselineRendered);
    const obstacleWidget = getWidgetOuterRect(obstacleRendered);

    assert.ok(Math.abs(obstacleBanner.width - baselineBanner.width) <= 2);
    assert.ok(
        obstacleBanner.x > baselineBanner.x + 20 || obstacleBanner.y > baselineBanner.y + 20,
        `expected dragged media to move the mobile banner, baseline=${JSON.stringify(baselineBanner)} obstacle=${JSON.stringify(obstacleBanner)}`
    );
    assert.ok(Math.abs(obstacleWidget.width - baselineWidget.width) <= 1);
    assert.ok(Math.abs(obstacleWidget.height - baselineWidget.height) <= 1);
    assert.ok(
        obstacleWidget.x > baselineWidget.x + 20 || obstacleWidget.y > baselineWidget.y + 20,
        `expected dragged media to move the mobile widget, baseline=${JSON.stringify(baselineWidget)} obstacle=${JSON.stringify(obstacleWidget)}`
    );
});

test('mobile help uses a condensed layout so long command entries fit the screen without zooming out', { timeout: 120000 }, async t => {
    const server = await createStaticServer(REPO_ROOT);
    t.after(async () => {
        await server.close();
    });

    const page = await createPage(t, { mobile: true });
    await installHelpDrawCapture(page);
    await stubVisitorApis(page);

    const rendered = await renderHelp(page, server.origin);
    const entry = getEntryDescriptionLines(rendered, 'userpic [w h]');

    assert.ok(
        getFontSizePx(entry.commandDraw.font) <= 13,
        `expected mobile help font to condense below the desktop-sized text, got ${entry.commandDraw.font}`
    );
    assert.ok(
        entry.lineStarts[0].x <= 230,
        `expected mobile help description column to start earlier, got x=${entry.lineStarts[0].x}`
    );
    assert.ok(
        entry.lineStarts.length <= 4,
        `expected long mobile help descriptions to need at most 4 lines, got ${entry.lineStarts.length}`
    );
});
