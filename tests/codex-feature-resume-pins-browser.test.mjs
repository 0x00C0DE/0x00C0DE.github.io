// Run against a served Pages build; second argument locates the locked Playwright tooling.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const origin = process.env.RESUME_PINS_TEST_ORIGIN;
const tooling = process.env.RESUME_PINS_TEST_TOOLING || '.';
test('résumé passage pins preserve layout, source provenance, and fallback', { skip: !origin }, async () => {
    assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
    const { chromium } = createRequire(resolve(tooling, 'package.json'))('playwright');
    const browser = await chromium.launch();
    try {
        for (const width of [1280, 390]) {
            for (const reducedMotion of ['no-preference', 'reduce']) {
                const page = await browser.newPage({ viewport: { width, height: 844 },
                    hasTouch: width === 390, reducedMotion });
                page.setDefaultTimeout(20_000);
                const errors = [];
                page.on('pageerror', error => errors.push(error.message));
                await page.goto(new URL('/pages/resume-reader.html', origin).href);
                const expected = [];
                for (const query of ['Python', 'Skills']) {
                    await page.locator('#reader-search').fill(query);
                    await page.locator('#reader-match-0').click();
                    await page.locator('#reader-passage').waitFor();
                    const context = await page.locator('#reader-passage .reader-line').allTextContents();
                    expected.push({ context: context.join('\n'),
                        heading: await page.locator('#reader-passage h2').innerText(),
                        href: await page.locator('#reader-passage-source').getAttribute('href') });
                    const keep = page.locator('#resume-pins-keep');
                    await (width === 390 ? keep.tap() : keep.click());
                    const index = expected.length - 1;
                    await page.locator(`#resume-pin-${index}`).waitFor();
                    assert.equal(await page.locator(`#resume-pin-${index} blockquote`).innerText(), expected[index].context);
                    assert.equal(await page.locator(`#resume-pin-${index} h3`).innerText(), expected[index].heading);
                    assert.equal(await page.locator(`#resume-pin-source-${index}`).getAttribute('href'), expected[index].href);
                }
                const first = await page.locator('#resume-pin-0').boundingBox();
                const second = await page.locator('#resume-pin-1').boundingBox();
                assert.ok(first && second);
                if (width === 1280) {
                    assert.ok(Math.abs(first.y - second.y) < 2, 'Desktop cards share a row');
                    assert.ok(second.x >= first.x + first.width, 'Desktop columns do not overlap');
                } else {
                    assert.ok(Math.abs(first.x - second.x) < 2, 'Phone cards share a column');
                    assert.ok(second.y >= first.y + first.height, 'Phone cards stack without overlap');
                }
                assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
                const styles = await page.locator('#resume-pins-keep').evaluate(button => ({
                    transition: getComputedStyle(button).transitionDuration,
                    light: getComputedStyle(button.querySelector('canvas')).display,
                    height: button.getBoundingClientRect().height,
                    edges: [...document.querySelectorAll('#resume-pins .spotlight-card__edge')]
                        .map(edge => getComputedStyle(edge).display)
                }));
                assert.ok(styles.height >= 44);
                assert.equal(styles.light === 'none', reducedMotion === 'reduce');
                if (reducedMotion === 'reduce') {
                    assert.equal(styles.transition, '0s');
                    assert.deepEqual(styles.edges, ['none', 'none']);
                }
                await page.locator('#resume-pin-remove-0').press('Enter');
                await page.locator('#resume-pin-1').waitFor({ state: 'hidden' });
                assert.equal(await page.locator('#resume-pin-0 blockquote').innerText(), expected[1].context);
                assert.equal(await page.locator('#resume-pin-remove-0').evaluate(el => el === document.activeElement), true);
                assert.deepEqual(errors, []);
                await page.close();
            }
        }
        const failure = await browser.newPage();
        await failure.route('**/assets/resume.pdf', route => route.abort());
        await failure.goto(new URL('/pages/resume-reader.html', origin).href);
        await failure.locator('#resume-reader [role="alert"]').waitFor();
        assert.match(await failure.locator('#resume-reader [role="alert"]').innerText(), /Search could not load/);
        assert.equal(await failure.locator('#reader-pdf').getAttribute('href'), '/assets/resume.pdf');
        assert.equal(await failure.locator('#reader-pdf').isVisible(), true);
        assert.equal(await failure.locator('#resume-pins-keep').isDisabled(), true);
        assert.equal(await failure.locator('#resume-pin-0').count(), 0);
        await failure.close();
        console.log('Verified columns, stacking, provenance, motion preferences, focus, touch, and PDF failure.');
    } finally {
        await browser.close();
    }
});
