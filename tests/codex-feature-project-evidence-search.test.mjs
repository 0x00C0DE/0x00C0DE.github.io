import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { loadEvidence, findEvidence, attachEvidence } from '../src/codex-feature-project-evidence-search.mjs';

const page = await readFile(new URL('../pages/projects.html', import.meta.url), 'utf8');
const projects = [...page.matchAll(/<a href="(project-[^"]+)">([^<]+)<\/a>/g)]
    .map(([, href, title]) => ({ href, title }));
const parseFacts = html => [...html.matchAll(/<dd>([^<]+)<\/dd>/g)].map(m => m[1]);
const fetchPage = async href => ({ ok: true, text: () => readFile(new URL(`../pages/${href}`, import.meta.url), 'utf8') });

test('technology searches return exact public facts and compose with interests', async () => {
    const entries = await loadEvidence(projects, fetchPage, parseFacts);
    for (const [query, name, interest] of [['POSIX', 'smallsh', 'systems'],
        ['RFC 6238', 'qr-totp', 'security'], ['Durable Objects', 'doublehitcollectibles', 'web']]) {
        const results = findEvidence(entries, ` ${query.toUpperCase()} `, interest);
        assert.equal(results.length, 1);
        assert.equal(results[0].href, `project-${name}.html`);
        assert.ok(results[0].excerpts.some(text => text.includes(query)));
        assert.equal(findEvidence(entries, query, 'robotics').length, 0);
    }
    assert.equal(findEvidence(entries, '', '').length, 7);
    assert.equal(findEvidence(entries, 'never-a-technology', '').length, 0);
});

test('failed and malformed sources retain title search with explicit partial state', async () => {
    for (const fetcher of [async () => { throw Error('offline'); },
        async () => ({ ok: false }), async () => ({ ok: true, text: async () => '<html></html>' })]) {
        const entries = await loadEvidence(projects, fetcher, parseFacts);
        assert.ok(entries.every(entry => entry.unavailable));
        assert.equal(findEvidence(entries, 'Small Shell', '').length, 1);
        assert.equal(findEvidence(entries, 'POSIX', '').length, 0);
    }
});

function control(value = '') {
    return { value, handlers: {}, addEventListener(type, fn) { this.handlers[type] = fn; },
        focus() { this.focused = true; } };
}
test('input, interest, Escape and Clear keep counts and empty state consistent', async () => {
    const entries = await loadEvidence(projects, fetchPage, parseFacts);
    const input = control('POSIX'), select = control('systems'), clear = control();
    const status = {}, empty = {}, sourceStatus = {};
    let rendered;
    attachEvidence({ entries, input, select, clear, status, empty, sourceStatus,
        render: results => { rendered = results; } });
    assert.equal(status.textContent, '1 of 7 projects');
    select.value = 'web'; select.handlers.change();
    assert.equal(status.textContent, '0 of 7 projects');
    assert.equal(empty.hidden, false);
    clear.handlers.click();
    assert.equal(rendered.length, 7);
    assert.equal(input.focused, true);
    input.value = 'RFC 6238'; input.handlers.input();
    assert.equal(rendered[0].href, 'project-qr-totp.html');
    input.handlers.keydown({ key: 'Escape', preventDefault() {} });
    assert.equal(status.textContent, '7 of 7 projects');
    assert.equal(empty.hidden, true);
    entries[0].unavailable = true;
    input.handlers.input();
    assert.match(sourceStatus.textContent, /Partial results: 1 of 7/);
});

test('one failed source preserves technology matches from all available panels', async () => {
    const entries = await loadEvidence(projects, href => href === 'project-proprts.html'
        ? Promise.reject(new Error('offline')) : fetchPage(href), parseFacts);
    assert.equal(entries.filter(entry => entry.unavailable).length, 1);
    assert.equal(findEvidence(entries, 'Durable Objects', 'web').length, 1);
    assert.equal(findEvidence(entries, 'PROPR', 'data').length, 1);
});
