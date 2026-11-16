import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const origin = process.env.BLOG_READER_TEST_ORIGIN;
test('reading desk Chromium interaction, motion, layout, failure and no-JS sources', { skip: !origin }, async () => {
    assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
    const { chromium } = createRequire(resolve(process.env.BLOG_READER_TEST_TOOLING || '.', 'package.json'))('playwright');
    const browser = await chromium.launch();
    const url = new URL('/pages/blog-reader.html', origin).href;
    const fixture = '<feed xmlns="http://www.w3.org/2005/Atom">'
        + '<entry><title>Older</title><updated>2026-01-01T00:00:00Z</updated><summary>Hello</summary></entry>'
        + '<entry><title>Newest</title><updated>2026-11-01T00:00:00Z</updated>'
        + '<summary>&lt;img src=x&gt; [literal].*</summary></entry></feed>';
    try {
        for (const width of [1280, 390]) for (const reducedMotion of ['reduce', 'no-preference']) {
            const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: width === 390, reducedMotion });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/content/feed.xml', route => route.fulfill({ body: fixture, contentType: 'application/atom+xml' }));
            await page.goto(url);
            await page.locator('#reader-title').waitFor();
            assert.equal(await page.locator('#reader-title').textContent(), 'Newest');
            assert.equal(await page.locator('#reader-text').textContent(), '<img src=x> [literal].*');
            assert.equal(await page.locator('#reader-text img').count(), 0);
            const next = page.locator('#reader-next');
            await (width === 390 ? next.tap() : next.click());
            await page.locator('#reader-title:focus').waitFor();
            assert.equal(await page.locator('#reader-title').textContent(), 'Older');
            await page.locator('#reader-search').fill('HELLO');
            assert.equal(await page.locator('#reader-count').textContent(), '1 of 2 recent entries');
            await page.locator('#reader-search').fill('absent');
            await page.locator('#reader-empty').waitFor();
            assert.equal(await page.locator('#reader-detail').count(), 0);
            await page.locator('#reader-clear').press('Enter');
            await page.locator('#reader-search:focus').waitFor();
            await page.locator('#reader-entry-1').press('Enter');
            await page.locator('#reader-title:focus').waitFor();
            assert.equal(await page.locator('#reader-title').textContent(), 'Older');
            const style = await next.evaluate(el => ({ height: el.offsetHeight,
                light: getComputedStyle(el.querySelector('canvas')).display,
                transition: getComputedStyle(el).transitionDuration }));
            assert.ok(style.height >= 44);
            if (reducedMotion === 'reduce') { assert.equal(style.light, 'none'); assert.equal(style.transition, '0s'); }
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await page.route('**/content/feed.xml', route => route.abort());
            await page.reload();
            await page.locator('#reader-status').filter({ hasText: 'unavailable' }).waitFor();
            assert.ok(await page.locator('#reader-source').isVisible());
            assert.deepEqual(errors, []);
            await page.close();
        }
        const page = await browser.newPage({ javaScriptEnabled: false });
        await page.goto(url);
        for (const id of ['reader-source', 'reader-terminal']) assert.ok(await page.locator('#' + id).isVisible());
        await page.close();
    } finally { await browser.close(); }
});
