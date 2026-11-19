import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareHelpCommand } from '../src/terminal-help-shortcuts.mjs';

test('shortcuts prepare exact commands without executing or changing history', () => {
    for (const command of ['ls', 'cat blog.txt', 'history']) {
        const calls = [];
        assert.equal(prepareHelpCommand(command, value => calls.push(value)), true);
        assert.deepEqual(calls, [command]);
    }
    assert.equal(prepareHelpCommand('sudo anything', () => assert.fail()), false);
});

const origin = process.env.FEATURE_BROWSER_ORIGIN;
for (const touch of [false, true]) {
    for (const reducedMotion of ['no-preference', 'reduce']) {
        test(`real help task: touch=${touch}, motion=${reducedMotion}`, {
            skip: !origin, timeout: 60000
        }, async () => {
            const { chromium } = await import('playwright');
            const browser = await chromium.launch({ headless: true });
            try {
                const context = await browser.newContext({
                    viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 800 },
                    hasTouch: touch, reducedMotion,
                    permissions: ['clipboard-read', 'clipboard-write']
                });
                const page = await context.newPage();
                await page.goto(new URL('/?command=help', origin).href);
                const button = page.locator('#help-shortcut-0');
                await button.waitFor({ state: 'visible' });
                await page.waitForFunction(() => !!window.__terminalCanvasTestHooks);
                const history = () => page.evaluate(() => window.getTerminalCommandHistory());
                const before = await history();
                assert.deepEqual(before, ['help']);
                assert.equal(await page.locator('#help-shortcuts .gradient-text').count(), 3);
                const input = page.locator('#terminal-mobile-input');
                await input.press('Shift+Tab');
                assert.equal(await page.locator('#help-shortcut-2').evaluate(el => el === document.activeElement), true);
                await page.keyboard.press('Tab');
                assert.equal(await input.evaluate(el => el === document.activeElement), true);
                await input.press('Tab');
                assert.equal(await button.evaluate(el => el === document.activeElement), true);
                await button.press('Shift+Tab');
                assert.equal(await input.evaluate(el => el === document.activeElement), true);
                await input.fill('his');
                await input.press('Tab');
                assert.equal(await input.inputValue(), 'history', 'typed commands retain autocomplete');
                await input.fill('');
                if (touch) await button.tap();
                else {
                    await input.press('Tab');
                    assert.notEqual(await button.evaluate(el => getComputedStyle(el).outlineStyle), 'none');
                    await button.press('Space');
                }
                assert.equal(await input.inputValue(), 'ls');
                assert.equal(await input.evaluate(el => el === document.activeElement), true);
                assert.match(await page.locator('#help-shortcuts-status').innerText(), /Prepared: ls/);
                assert.deepEqual(await history(), before, 'activation must not execute');
                // Native selection and copy still operate on the real input proxy.
                await input.evaluate(el => el.setSelectionRange(0, 2));
                await page.keyboard.press('Control+c');
                assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'ls');
                await input.press('End');
                await input.press('Enter');
                await page.waitForFunction(() => window.getTerminalCommandHistory().length === 2);
                const expected = await page.evaluate(() => window.ls_command()[0]);
                await page.waitForFunction(expected =>
                    window.__terminalCanvasTestHooks.getState().blocks.filter(b => b.text === expected).length === 1,
                    expected);
                assert.deepEqual(await history(), ['help', 'ls']);
                assert.equal(await page.locator('#help-shortcuts-output').textContent(), expected);
                await page.waitForFunction(() => {
                    const state = window.__terminalCanvasTestHooks.ensureLayout();
                    const rect = document.querySelector('#help-shortcuts').getBoundingClientRect();
                    return rect.top >= state.blocks.at(-1).bottom - state.scrollTop
                        && rect.bottom < innerHeight - 20;
                });
                const geometry = await page.evaluate(() => {
                    const state = window.__terminalCanvasTestHooks.ensureLayout();
                    const rect = document.querySelector('#help-shortcuts').getBoundingClientRect();
                    const last = state.blocks.at(-1);
                    return { top: rect.top, bottom: rect.bottom, right: rect.right,
                        outputBottom: last.bottom - state.scrollTop, height: innerHeight, width: innerWidth,
                        canvas: document.querySelector('#terminal-canvas').getBoundingClientRect().height };
                });
                assert.ok(geometry.top >= geometry.outputBottom, 'accessory must not cover Canvas output');
                assert.ok(geometry.bottom < geometry.height - 20, 'leave room for the Canvas prompt');
                assert.ok(geometry.right <= geometry.width);
                assert.equal(geometry.canvas, geometry.height);
                if (reducedMotion === 'reduce') {
                    assert.equal(await button.locator('canvas').evaluate(el => getComputedStyle(el).display), 'none');
                }
                // Native Tab moves between buttons without terminal autocomplete.
                await input.press('Tab');
                await button.press('Tab');
                assert.equal(await page.locator('#help-shortcut-1').evaluate(el => el === document.activeElement), true);
                await page.locator('#help-shortcut-1').press('Enter');
                assert.equal(await input.inputValue(), 'cat blog.txt');
                assert.deepEqual(await history(), ['help', 'ls']);
                await page.locator('#help-shortcut-2').click();
                assert.equal(await input.inputValue(), 'history');
                await input.press('Enter');
                await page.waitForFunction(() => window.getTerminalCommandHistory().length === 3);
                await page.waitForFunction(() => {
                    const expected = window.history_command();
                    const blocks = window.__terminalCanvasTestHooks.getState().blocks;
                    return expected.every(text => blocks.some(block => block.text === text))
                        && document.querySelector('#help-shortcuts-output').textContent === expected.join('\n');
                });
                await input.fill('clear');
                await input.press('Enter');
                await page.locator('#help-shortcuts').waitFor({ state: 'detached' });
                await input.fill('help');
                await input.press('Enter');
                await button.waitFor({ state: 'visible' });
                assert.equal(await page.locator('#help-shortcuts').count(), 1);
                await page.evaluate(() => window.showAsciiStill(['viewer']));
                await page.locator('#help-shortcuts').waitFor({ state: 'detached' });
            } finally {
                await browser.close();
            }
        });
    }
}
