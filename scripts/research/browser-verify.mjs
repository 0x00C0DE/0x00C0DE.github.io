import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export function artifactPath(root, url) {
    const path = decodeURIComponent(url.split('?')[0]).replaceAll('\\', '/');
    const base = resolve(root);
    const target = resolve(base, '.' + (path === '/' ? '/index.html' : path));
    if (!target.startsWith(base + sep)) throw new Error('Path outside Pages artifact');
    return target;
}

const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript',
    '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

async function verify(root, planPath, dependencyRoot) {
    const plan = JSON.parse(await readFile(planPath, 'utf8'));
    assert.match(plan.route, /^\/pages\/[a-z0-9-]+\.html$/);
    assert.ok(Array.isArray(plan.steps) && plan.steps.length > 0 && plan.steps.length <= 15);
    assert.ok(plan.steps.some(step => ['visible', 'hidden', 'text'].includes(step.action)));
    const require = createRequire(resolve(dependencyRoot, 'package.json'));
    const { chromium } = require('playwright');
    const server = createServer(async (request, response) => {
        try {
            const path = artifactPath(root, request.url);
            const body = await readFile(path);
            response.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' });
            response.end(body);
        } catch {
            response.writeHead(404).end();
        }
    });
    await new Promise((ok, reject) => server.once('error', reject).listen(0, '127.0.0.1', ok));
    let browser;
    try {
        browser = await chromium.launch({ timeout: 30_000 });
        const origin = 'http://127.0.0.1:' + server.address().port;
        for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
            const page = await browser.newPage({ viewport, hasTouch: viewport.width < 500,
                reducedMotion: 'reduce' });
            page.setDefaultTimeout(20_000);
            await page.route('**/*', route => new URL(route.request().url()).origin === origin
                ? route.continue() : route.abort());
            const response = await page.goto(origin + plan.route, {
                waitUntil: 'domcontentloaded', timeout: 30_000,
            });
            assert.ok(response?.ok(), 'Feature route did not load');
            for (const { action, selector, value } of plan.steps) {
                const locator = page.locator(selector);
                switch (action) {
                case 'fill': await locator.fill(value); break;
                case 'press': await locator.press(value); break;
                case 'activate': await (viewport.width < 500 ? locator.tap() : locator.click()); break;
                case 'visible': await locator.waitFor({ state: 'visible' }); break;
                case 'hidden': await locator.waitFor({ state: 'hidden' }); break;
                case 'text': assert.ok((await locator.innerText()).includes(value)); break;
                default: throw new Error('Unsupported browser step: ' + action);
                }
            }
            await page.close();
        }
        console.log('Verified feature interactions in desktop and mobile Chromium.');
    } finally {
        try { await browser?.close(); } finally { server.close(); }
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    await verify(...process.argv.slice(2));
}
