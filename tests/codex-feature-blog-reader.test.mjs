import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { prepareEntries, searchEntries, loadFeed } from '../src/codex-feature-blog-reader-model.mjs';

const rows = [
    { date: '2026-04-01T00:00:00Z', title: 'Older', text: 'Hello' },
    { date: '2026-11-01T00:00:00Z', title: 'Newest', text: '<img src=x> [literal].*' },
];
test('newest first; case-insensitive literal search, empty and cleared results', () => {
    const entries = prepareEntries(rows);
    assert.equal(entries[0].title, 'Newest');
    assert.equal(searchEntries(entries, 'HELLO')[0].title, 'Older');
    assert.equal(searchEntries(entries, '.*')[0].text, rows[1].text);
    assert.deepEqual(searchEntries(entries, 'absent'), []);
    assert.deepEqual(searchEntries(entries, ''), entries);
    assert.equal(prepareEntries([...rows, { date: 'invalid' }]).length, 2);
    assert.equal(prepareEntries(Array.from({ length: 30 }, () => rows[0])).length, 20);
    assert.equal(prepareEntries([{ ...rows[0], text: 'a'.repeat(2100) }])[0].text.length, 2000);
});
test('feed failures are explicit; only the generated same-site feed is requested', async () => {
    await assert.rejects(loadFeed(async () => ({ ok: false }), () => []), /Feed unavailable/);
    await assert.rejects(loadFeed(async () => { throw Error('offline'); }, () => []), /offline/);
    const result = await loadFeed(async (url, options) => {
        assert.equal(url, '/content/feed.xml');
        assert.equal(options.redirect, 'error');
        assert.ok(options.signal);
        return { ok: true, text: async () => 'xml' };
    }, xml => { assert.equal(xml, 'xml'); return rows; });
    assert.equal(result[0].title, 'Newest');
});
test('route keeps static sources and loads the isolated pinned components', async () => {
    const read = name => readFile(new URL('../' + name, import.meta.url), 'utf8');
    const html = await read('pages/blog-reader.html');
    for (const path of ['/content/blog.txt', '/content/feed.xml', '/',
        '/src/codex-feature-blog-reader.js', '/src/codex-feature-blog-reader.css']) {
        assert.ok(html.includes('"' + path + '"'));
    }
    const manifest = JSON.parse(await read('src/codex-feature-blog-reader.react-bits.json'));
    assert.deepEqual(manifest.components, ['LineSidebar', 'SpecularButton']);
    const jsx = await read('src/codex-feature-blog-reader.jsx');
    assert.doesNotMatch(jsx, /dangerouslySetInnerHTML|innerHTML/);
    const css = await read('src/codex-feature-blog-reader-style.css');
    assert.match(css, /prefers-reduced-motion/);
    assert.ok(css.split('\n').filter(line => line.includes('{') && !line.startsWith('@'))
        .every(line => line.trim().startsWith('#blog-reader-page')));
});
