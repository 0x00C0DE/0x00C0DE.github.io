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
        const proto = CanvasRenderingContext2D.prototype;
        const originalFillText = proto.fillText;
        proto.fillText = function(text, x, y, maxWidth) {
            const matrix = typeof this.getTransform === 'function' ? this.getTransform() : { e: 0, f: 0 };
            window.__helpDraws.push({
                fillStyle: String(this.fillStyle),
                font: String(this.font),
                text: String(text),
                x: x + matrix.e,
                y: y + matrix.f
            });
            return originalFillText.call(this, text, x, y, maxWidth);
        };
    });
}

async function renderHelp(page, origin, options = {}) {
    await page.goto(origin, { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.executeCommand === 'function');
    await page.waitForTimeout(2500);
    await page.evaluate(async ({ preCommands, user }) => {
        if (user === 'root') {
            await window.executeCommand('su');
        } else if (user === 'guest' || user === 'godlike') {
            window.setTerminalSessionState({
                shell: 'default',
                user
            });
        }
        for (const command of Array.isArray(preCommands) ? preCommands : []) {
            await window.executeCommand(command);
        }
        window.__helpDraws.length = 0;
        await window.executeCommand('help');
    }, {
        preCommands: options.preCommands || [],
        user: options.user || 'guest'
    });
    await page.waitForFunction(() => {
        const entries = window.help_command()
            .filter(entry => entry && typeof entry === 'object' && entry.type === 'help-entry')
            .map(entry => entry.command);
        return Array.isArray(window.__helpDraws) && window.__helpDraws.some(draw => entries.includes(draw?.text));
    }, { timeout: 10000 });
    await page.waitForTimeout(150);

    return page.evaluate(() => {
        const entries = window.help_command()
            .filter(entry => entry && typeof entry === 'object' && entry.type === 'help-entry')
            .map(entry => entry.command);
        const deduped = new Map();
        (Array.isArray(window.__helpDraws) ? window.__helpDraws : []).forEach(draw => {
            const key = [
                draw.text,
                Math.round(draw.x * 10) / 10,
                Math.round(draw.y * 10) / 10,
                draw.fillStyle
            ].join('|');
            if (!deduped.has(key)) {
                deduped.set(key, draw);
            }
        });
        return {
            commands: entries,
            draws: [...deduped.values()].sort((left, right) => left.y - right.y || left.x - right.x)
        };
    });
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

function roundLineY(y) {
    return Math.round(y * 2) / 2;
}

function getFontSizePx(font) {
    const match = /^(\d+(?:\.\d+)?)px\b/i.exec(String(font || ''));
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

test('root desktop help stays tabular even after cat blog.txt adds editorial media obstacles', { timeout: 120000 }, async t => {
    const server = await createStaticServer(REPO_ROOT);
    t.after(async () => {
        await server.close();
    });

    const guestPage = await createPage(t);
    await installHelpDrawCapture(guestPage);
    await stubVisitorApis(guestPage);
    const guestRendered = await renderHelp(guestPage, server.origin, { user: 'guest' });

    const rootPage = await createPage(t);
    await installHelpDrawCapture(rootPage);
    await stubVisitorApis(rootPage);
    const rootRendered = await renderHelp(rootPage, server.origin, {
        preCommands: ['cat blog.txt'],
        user: 'root'
    });
    const guestRow = getHelpRow(guestRendered, 'help');
    const rootRow = getHelpRow(rootRendered, 'help');

    assert.ok(Math.abs(rootRow.commandDraw.x - guestRow.commandDraw.x) <= 1);
    assert.ok(Math.abs(rootRow.separatorDraw.x - guestRow.separatorDraw.x) <= 1);
    assert.ok(Math.abs(rootRow.descriptionDraw.x - guestRow.descriptionDraw.x) <= 1);
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

test('root mobile help stays column-aligned after cat blog.txt adds editorial media obstacles', { timeout: 120000 }, async t => {
    const server = await createStaticServer(REPO_ROOT);
    t.after(async () => {
        await server.close();
    });

    const guestPage = await createPage(t, { mobile: true });
    await installHelpDrawCapture(guestPage);
    await stubVisitorApis(guestPage);
    const guestRendered = await renderHelp(guestPage, server.origin, { user: 'guest' });

    const rootPage = await createPage(t, { mobile: true });
    await installHelpDrawCapture(rootPage);
    await stubVisitorApis(rootPage);
    const rootRendered = await renderHelp(rootPage, server.origin, {
        preCommands: ['cat blog.txt'],
        user: 'root'
    });
    const guestEntry = getEntryDescriptionLines(guestRendered, 'userpic [w h]');
    const rootEntry = getEntryDescriptionLines(rootRendered, 'userpic [w h]');

    assert.ok(Math.abs(rootEntry.commandDraw.x - guestEntry.commandDraw.x) <= 1);
    assert.ok(Math.abs(rootEntry.lineStarts[0].x - guestEntry.lineStarts[0].x) <= 1);
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
