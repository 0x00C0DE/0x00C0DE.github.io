import test from 'node:test';
import assert from 'node:assert/strict';
import { headingLines } from '../src/codex-feature-help-labels-model.mjs';

test('heading accents follow wrapped Canvas fragments and viewport clipping', () => {
    const block = { id: 'b1', top: 80, data: { type: 'help-heading' }, layout: {
        plans: [{ x: 4, y: 20, plans: [{ text: 'Projects ', x: 0, width: 90 },
            { text: 'and links', x: 90, width: 90 }] }] } };
    const metrics = { paddingX: 12, lineHeight: 24, textFont: '18px monospace' };
    assert.deepEqual(headingLines([block], metrics, 50, 100), [{
        id: 'b1-0', text: 'Projects and links', x: 16, y: 50, width: 180,
        height: 24, font: '18px monospace'
    }]);
    assert.deepEqual(headingLines([block], metrics, 140, 100), []);
    assert.deepEqual(headingLines([{ ...block, data: 'Projects and links' }], metrics, 50, 100), []);
});

const origin = process.env.FEATURE_BROWSER_ORIGIN;
test('served help labels preserve desktop and touch terminal tasks', { skip: !origin }, async () => {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch();
    try {
        for (const touch of [false, true]) {
            const context = await browser.newContext({ viewport: touch
                ? { width: 390, height: 844 } : { width: 1280, height: 800 },
                hasTouch: touch, isMobile: touch, reducedMotion: 'reduce',
                permissions: ['clipboard-read', 'clipboard-write'] });
            const page = await context.newPage();
            await page.goto(`${origin}/?command=help`);
            await page.waitForFunction(() => window.__terminalCanvasTestHooks?.getHelpBlock('echo [text]'));
            const input = page.locator('#terminal-mobile-input');
            async function command(value) {
                await input.fill(value);
                await input.press('Enter');
                await page.waitForFunction(value => window.getTerminalCommandHistory().includes(value), value);
            }
            async function geometry() {
                await page.waitForSelector('#terminal-help-labels [data-ready="true"]');
                await page.waitForFunction(() => {
                    const state = window.__terminalCanvasTestHooks.getState();
                    return [...document.querySelectorAll('[data-help-label]')].every(el => {
                        const block = state.blocks.find(b => el.dataset.helpLabel.startsWith(`${b.id}-`));
                        return block && Math.abs(el.getBoundingClientRect().y - (block.top - state.scrollTop)) < 2;
                    });
                });
                const result = await page.locator('[data-help-label]').evaluateAll(elements => elements.map(el => {
                    const gradient = el.querySelector('.gradient-text__content');
                    const border = el.querySelector('.star-border');
                    const rect = el.getBoundingClientRect();
                    return { text: el.textContent, image: getComputedStyle(gradient).backgroundImage,
                        border: getComputedStyle(border, '::before').boxShadow,
                        pointer: getComputedStyle(gradient).pointerEvents,
                        x: rect.x, y: rect.y, right: rect.right, height: rect.height,
                        track: getComputedStyle(border).getPropertyValue('--star-border-track').trim() };
                }));
                assert.ok(result.length);
                for (let i = 1; i < result.length; i++) {
                    assert.ok(result[i].y >= result[i - 1].y + result[i - 1].height);
                }
                for (const item of result) {
                    assert.ok(item.text.trim());
                    assert.match(item.image, /gradient/);
                    assert.match(item.image, /255, 240, 212/);
                    assert.equal(item.track, '#b77888');
                    assert.notEqual(item.border, 'none');
                    assert.equal(item.pointer, 'none');
                    assert.ok(item.x >= 0 && item.right <= (touch ? 390 : 1280));
                    assert.ok(item.height > 0);
                }
            }
            // Use real wheel input to reveal the start of the long command reference.
            await page.mouse.move(180, 350);
            await page.mouse.wheel(0, -100000);
            await page.waitForFunction(() => window.__terminalCanvasTestHooks.getState().scrollTop === 0);
            await geometry();
            assert.equal(await page.locator('[data-help-label]').first().textContent(), 'Available commands:');
            assert.equal(await page.locator('#terminal-help-labels button').count(), 0);
            await page.waitForFunction(() => getComputedStyle(document.querySelector(
                '[data-help-label] .gradient-text__content')).backgroundImage.includes('repeating-linear-gradient'));
            // Sample the actual upstream paint across frames: a motion preference alone
            // would not catch a regression that resumes GradientText's RAF animation.
            const still = await page.locator('[data-help-label]').first().evaluate(async el => {
                const gradient = el.querySelector('.gradient-text__content');
                const border = el.querySelector('.star-border');
                const sample = () => [gradient, border].map(node => {
                    const css = getComputedStyle(node);
                    const rect = node.getBoundingClientRect();
                    return { image: css.backgroundImage, transform: css.transform,
                        x: rect.x, y: rect.y, width: rect.width, height: rect.height,
                        outline: getComputedStyle(node, '::before').boxShadow };
                });
                const before = sample();
                const start = performance.now();
                while (performance.now() - start < 500) {
                    await new Promise(requestAnimationFrame);
                    if (JSON.stringify(sample()) !== JSON.stringify(before)) return false;
                }
                return matchMedia('(prefers-reduced-motion: reduce)').matches
                    && getComputedStyle(border.querySelector('canvas')).display === 'none'
                    && el.getAnimations({ subtree: true }).every(a => a.playState !== 'running');
            });
            assert.equal(still, true, 'reduced-motion lettering and borders stay stationary');
            if (touch) {
                const session = await context.newCDPSession(page);
                await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: 650 }] });
                await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y: 220 }] });
                await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            } else await page.mouse.wheel(0, 400);
            await page.waitForFunction(() => window.__terminalCanvasTestHooks.getState().scrollTop > 0);
            await geometry();
            await page.setViewportSize({ width: touch ? 390 : 1280, height: 700 });
            await geometry();
            if (touch) await page.locator('#terminal-canvas').tap({ position: { x: 180, y: 650 } });
            else await page.locator('#terminal-canvas').click({ position: { x: 180, y: 650 } });
            await page.waitForFunction(() => document.activeElement?.id === 'terminal-mobile-input');
            // Native input selection remains available for copying command text.
            await input.fill('echo label-check');
            await input.evaluate(el => el.setSelectionRange(5, 16));
            assert.equal(await input.evaluate(el => el.value.slice(el.selectionStart, el.selectionEnd)), 'label-check');
            // Exercise Chromium's native copy path, rather than inferring copy from selection.
            await page.evaluate(() => navigator.clipboard.writeText('copy-sentinel'));
            await input.press('Control+c');
            await page.waitForFunction(async () => await navigator.clipboard.readText() === 'label-check');
            assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'label-check');
            await input.press('Enter');
            await page.waitForFunction(() => window.__terminalCanvasTestHooks.getState().blocks.some(b => b.text === 'label-check'));
            for (let i = 0; i < 2; i++) {
                await command('clear');
                await page.waitForSelector('#terminal-help-labels', { state: 'detached' });
                await command('help');
                await page.waitForFunction(() => window.__terminalCanvasTestHooks.getHelpBlock('echo [text]'));
                await page.mouse.wheel(0, -100000);
                await page.waitForFunction(() => window.__terminalCanvasTestHooks.getState().scrollTop === 0);
                await geometry();
                assert.equal(await page.locator('#terminal-help-labels').count(), 1);
            }
            await context.close();
        }
    } finally { await browser.close(); }
});
