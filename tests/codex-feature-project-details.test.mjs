import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
test('all seven project routes expose source facts without JavaScript and retain terminal boot', () => {
    const pages = readdirSync(new URL('../pages/', import.meta.url)).filter(p => /^project-.*\.html$/.test(p));
    assert.equal(pages.length, 7);
    for (const page of pages) {
        const html = read('pages/' + page);
        const command = html.match(/const DEFAULT_COMMAND = "cat ([^"]+)"/)[1];
        const content = read('content/' + command);
        assert.match(html, /<details id="project-details" class="project-browser">/);
        assert.match(html, /<summary>Project details<\/summary>/);
        for (const line of content.split(/\r?\n/)) {
            const field = line.match(/^([^:]+?)\s+: (.+)$/);
            if (!field || /command|Project page/i.test(field[1])) continue;
            assert.ok(html.includes(field[2]), `${page}: ${field[1]}`);
        }
        for (const label of ['Domain', 'Primary stack', 'Core behavior', 'Engineering notes']) {
            assert.ok(html.includes(`<dt>${label}</dt>`));
        }
        assert.ok(html.includes(`value="cat ${command}" readonly`));
        assert.match(html, /id="project-copy" type="button" hidden/);
        assert.match(html, /bootTerminalSite\(DEFAULT_COMMAND\)/);
        assert.match(html, /Descriptions of the project, not executed demonstrations/);
    }
});

test('copy writes only the displayed command and keeps text selectable on rejection or unavailable API', async () => {
    const { copyProjectCommand } = await import('../src/codex-feature-project-details.mjs');
    for (const mode of ['success', 'denied', 'missing']) {
        let selected = false;
        const input = { value: 'cat bloom.txt', focus() {}, select() { selected = true; } };
        const status = { textContent: '' };
        const clipboard = mode === 'missing' ? undefined : { async writeText(value) {
            assert.equal(value, input.value);
            if (mode === 'denied') throw new Error('denied');
        } };
        await copyProjectCommand(input, status, clipboard);
        assert.equal(selected, mode !== 'success');
        assert.equal(status.textContent, mode === 'success' ? 'Command copied.' : 'Copy unavailable. Command selected; copy it manually.');
    }
});
