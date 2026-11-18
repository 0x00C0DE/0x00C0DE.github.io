import test from 'node:test';
import assert from 'node:assert/strict';
import { stageExample } from '../src/codex-feature-help-examples.mjs';
test('staging changes only an empty prompt, never executes or changes history', () => {
    const state = { inputValue: '', commandHistory: ['help'] };
    let updates = 0;
    assert.equal(stageExample(state, 'ls', () => updates++), true);
    assert.equal(state.inputValue, 'ls');
    assert.deepEqual(state.commandHistory, ['help']);
    assert.equal(updates, 1);
    assert.equal(stageExample(state, 'history', () => updates++), false);
    assert.equal(state.inputValue, 'ls');
    state.inputValue = ' ';
    assert.equal(stageExample(state, 'ls', () => updates++), false);
    state.inputValue = '';
    assert.equal(stageExample(state, 'ls; clear', () => updates++), false);
    assert.equal(updates, 1);
});
test('every supported literal can be staged without changing command history', () => {
    for (const command of ['ls', 'cat blog.txt', 'history']) {
        const state = { inputValue: '', commandHistory: ['help'] };
        assert.equal(stageExample(state, command, () => {}), true);
        assert.equal(state.inputValue, command);
        assert.deepEqual(state.commandHistory, ['help']);
    }
});
test('strip keeps native keys local, returns focus, and forwards wheel/touch scrolling', async () => {
    const { bindExampleEvents } = await import('../src/codex-feature-help-examples.mjs');
    const listeners = new Map();
    const host = { addEventListener: (name, fn) => listeners.set(name, fn),
        removeEventListener: name => listeners.delete(name) };
    let focus = 0, delta = 0, stopped = 0;
    const dispose = bindExampleEvents(host, { focus: () => focus++, wheel: () => delta++,
        scroll: amount => delta += amount });
    const key = { key: 'Escape', stopPropagation: () => stopped++, preventDefault() {} };
    listeners.get('keydown')(key);
    assert.equal(focus, 1);
    listeners.get('paste')(key);
    assert.equal(stopped, 2);
    listeners.get('wheel')({});
    listeners.get('touchstart')({ touches: [{ clientY: 100 }] });
    listeners.get('touchmove')({ touches: [{ clientY: 60 }], preventDefault() {} });
    assert.equal(delta, 41);
    dispose();
    assert.equal(listeners.size, 0);
});
const origin = process.env.HELP_EXAMPLES_TEST_ORIGIN;
test('help examples through real terminal input in desktop/touch Chromium', { skip: !origin }, async () => {
    const { createRequire } = await import('node:module');
    const { resolve } = await import('node:path');
    assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin).hostname));
    const { chromium } = createRequire(resolve(process.env.HELP_EXAMPLES_TEST_TOOLING || '.', 'package.json'))('playwright');
    const browser = await chromium.launch();
    try {
        for (const width of [1280, 390]) for (const reducedMotion of ['reduce', 'no-preference']) {
            const page = await browser.newPage({ viewport: { width, height: 800 }, hasTouch: width === 390, reducedMotion });
            await page.goto(new URL('/?command=help', origin).href);
            if (await page.locator('#home-intro[open]').count()) await page.locator('#home-intro button').click();
            const strip = page.locator('#help-examples'), input = page.locator('#terminal-mobile-input');
            await strip.waitFor({ state: 'visible' });
            const history = () => page.evaluate(() => window.history_command());
            const before = await history();
            await input.press('Shift+Tab');
            await page.locator('#help-example-choice:focus').waitFor();
            await page.locator('#help-example-choice').press('Home');
            assert.equal(await page.locator('#help-example-preview').textContent(), 'ls');
            assert.equal(await page.locator('#help-example-description').textContent(), 'List directory contents');
            await page.locator('#help-example-choice').press('Tab');
            await page.locator('#help-example-use:focus').waitFor();
            assert.deepEqual(await history(), before);
            await page.locator('#help-example-use').press('Enter');
            await page.waitForFunction(() => document.querySelector('#help-example-status')?.textContent.includes('Ready to run: ls'));
            assert.equal(await input.inputValue(), 'ls');
            assert.deepEqual(await history(), before);
            await input.press('Enter');
            await strip.waitFor({ state: 'detached' });
            await page.waitForFunction(() => window.__terminalCanvasTestHooks.getState().blocks.some(b => b.text?.includes('blog.txt')));
            const after = await history();
            assert.equal(after.length, before.length + 1);
            assert.match(after.at(-1), /: ls$/);
            const run = async command => { await input.fill(command); await input.press('Enter'); };
            await run('help'); await strip.waitFor({ state: 'visible' });
            await input.fill('draft');
            await page.locator('#help-example-use:disabled').waitFor();
            assert.equal(await input.inputValue(), 'draft');
            await input.fill('');
            await input.press('Shift+Tab'); await page.locator('#help-example-choice').press('Escape');
            await page.locator('#terminal-mobile-input:focus').waitFor();
            // Real selection and copy shortcut remain native inside the strip; paste must not reach the prompt.
            await page.locator('#help-example-description').evaluate(el => {
                const range = document.createRange(); range.selectNodeContents(el);
                getSelection().removeAllRanges(); getSelection().addRange(range);
            });
            await page.locator('#help-example-choice').press('Control+c');
            assert.equal(await page.evaluate(() => getSelection().toString()), 'List directory contents');
            await strip.evaluate(el => { const data = new DataTransfer(); data.setData('text', 'draft');
                el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: data })); });
            assert.equal(await input.inputValue(), '');
            await input.evaluate(el => { const data = new DataTransfer(); data.setData('text', 'paste check');
                el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: data })); });
            assert.equal(await input.inputValue(), 'paste check'); await input.fill('');
            const scrollBefore = await page.evaluate(() => window.__terminalCanvasTestHooks.getState().scrollTop);
            await strip.evaluate(el => el.dispatchEvent(new WheelEvent('wheel', { deltaY: -150, bubbles: true, cancelable: true })));
            await page.waitForFunction(old => window.__terminalCanvasTestHooks.getState().scrollTop < old, scrollBefore);
            await page.evaluate(() => window.__terminalCanvasTestHooks.setScrollTop(1e6));
            const touchBefore = await page.evaluate(() => window.__terminalCanvasTestHooks.getState().scrollTop);
            await strip.evaluate(el => {
                for (const [type, y] of [['touchstart', 100], ['touchmove', 180]]) {
                    const event = new Event(type, { cancelable: true });
                    Object.defineProperty(event, 'touches', { value: [{ clientY: y }] }); el.dispatchEvent(event);
                }
            });
            assert.ok(await page.evaluate(old => window.__terminalCanvasTestHooks.getState().scrollTop < old, touchBefore));
            const style = await page.locator('#help-example-use').evaluate(el => ({ height: el.offsetHeight,
                transition: getComputedStyle(el).transitionDuration, light: getComputedStyle(el.querySelector('canvas')).display }));
            assert.ok(style.height >= 44);
            if (reducedMotion === 'reduce') {
                assert.equal(style.transition, '0s'); assert.equal(style.light, 'none');
                assert.ok(await page.locator('#help-example-preview .gradient-text').evaluate(async el => {
                    await new Promise(requestAnimationFrame);
                    const before = el.style.getPropertyValue('--gt-gradient');
                    await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
                    return before !== '' && before === el.style.getPropertyValue('--gt-gradient');
                }));
            }
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await page.evaluate(async () => (await import('/src/terminal-canvas-core.mjs?v=editorial-pretext')).showAsciiStill(['viewer']));
            await strip.waitFor({ state: 'detached' }); await input.press('Escape');
            await run('help'); await strip.waitFor({ state: 'visible' });
            await run('clear'); await strip.waitFor({ state: 'detached' });
            await page.reload();
            await strip.waitFor({ state: 'visible' });
            assert.equal(await strip.count(), 1);
            await page.close();
        }
    } finally { await browser.close(); }
});
test('mandatory runner plan checks staging history and real directory results', async () => {
    const { readFile } = await import('node:fs/promises');
    const { steps } = JSON.parse(await readFile('tmp/feature-browser-plan.json', 'utf8'));
    const stage = steps.findIndex(step => step.action === 'activate' && step.selector === '#help-example-use');
    const submit = steps.findIndex((step, i) => i > stage && step.action === 'press' && step.value === 'Enter');
    assert.ok(steps.slice(stage + 1, submit).some(step => step.action === 'visible'
        && step.selector.includes('data-history=') && step.selector.includes('["help"]')));
    assert.ok(steps.slice(submit + 1).some(step => step.action === 'text'
        && step.selector.includes('data-history=') && step.selector.includes('["help","ls"]')
        && step.value === 'blog.txt'));
});

test('command route bypasses intro without activating its hidden entry button', async () => {
    const { readFile } = await import('node:fs/promises');
    const plan = JSON.parse(await readFile('tmp/feature-browser-plan.json', 'utf8'));
    const intro = await readFile('src/home-intro.mjs', 'utf8');
    assert.equal(new URL(plan.route, 'https://example.test').searchParams.get('command'), 'help');
    assert.ok(intro.includes("!new URLSearchParams(location.search).has('command')"));
    assert.ok(plan.steps.some(step => step.action === 'hidden' && step.selector === '#home-intro[open]'));
    assert.ok(!plan.steps.some(step => step.action === 'activate' && step.selector.startsWith('#home-intro')));
});
