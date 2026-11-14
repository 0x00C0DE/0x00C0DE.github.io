import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('interest matches are deterministic, grounded excerpts from public project pages', async () => {
    const { projectPaths } = await import('../src/codex-feature-project-paths.mjs');
    const expected = {
        systems: ['smallsh', 'shellcode-template'],
        security: ['qr-totp', 'shellcode-template', 'bloom-filters'],
        robotics: ['collision-avoidance'],
        data: ['proprts', 'bloom-filters'],
        web: ['doublehitcollectibles'],
    };
    for (const [interest, names] of Object.entries(expected)) {
        assert.deepEqual(projectPaths[interest].map(item => item.href),
            names.map(name => `project-${name}.html`));
        for (const item of projectPaths[interest]) {
            const page = await readFile(new URL(`../pages/${item.href}`, import.meta.url), 'utf8');
            assert.ok(page.includes(item.excerpt), item.href);
        }
    }
});

test('interest and title compose, announce counts, and clearing restores original links', async () => {
    const { attachProjectPaths } = await import('../src/codex-feature-project-paths.mjs');
    const { attachProjectFilter } = await import('../src/codex-feature-project-filter.mjs');
    const page = await readFile(new URL('../pages/projects.html', import.meta.url), 'utf8');
    const links = [...page.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map(([, href, textContent]) => ({
        textContent, hidden: false, getAttribute: () => href,
        after(node) { this.note = node; },
    }));
    const handlers = {};
    const inputHandlers = [];
    const input = { value: '', addEventListener: (_, fn) => { inputHandlers.push(fn); } };
    handlers.input = () => inputHandlers.forEach(fn => fn());
    const select = { value: '', addEventListener: (_, fn) => { handlers.change = fn; } };
    const status = {};
    const empty = {};
    const controls = { hidden: true };
    attachProjectFilter({ input, status, empty, controls: {}, links });
    attachProjectPaths({ input, select, status, empty, controls, links,
        createNote: () => ({ hidden: true, textContent: '' }) });
    assert.equal(controls.hidden, false);
    assert.equal(status.textContent, '7 of 7 projects');
    select.value = 'security';
    handlers.change();
    assert.equal(status.textContent, '3 of 7 projects');
    assert.ok(links[1].note.textContent.includes('multi-factor authentication'));
    assert.equal(links[4].hidden, true);
    input.value = ' BLOOM ';
    handlers.input();
    assert.equal(status.textContent, '1 of 7 projects');
    assert.equal(links[5].hidden, false);
    assert.equal(links[1].note.hidden, true);
    select.value = 'robotics';
    handlers.change();
    assert.equal(status.textContent, '0 of 7 projects');
    assert.equal(empty.hidden, false);
    select.value = '';
    handlers.change();
    assert.equal(status.textContent, '1 of 7 projects');
    input.value = '';
    handlers.input();
    assert.equal(status.textContent, '7 of 7 projects');
    assert.ok(links.every(link => !link.hidden && link.note.hidden));
    assert.equal(empty.hidden, true);
});
