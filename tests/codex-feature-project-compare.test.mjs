import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { comparisonFields, readComparison, toggleSelection } from '../src/codex-feature-project-compare-core.mjs';

test('comparison preserves exact facts and source links from all seven public panels', () => {
    const pages = readdirSync('pages').filter(name => /^project-.*\.html$/.test(name));
    assert.equal(pages.length, 7);
    for (const page of pages) {
        const html = readFileSync(`pages/${page}`, 'utf8');
        const pairs = [...html.matchAll(/<dt>(.*?)<\/dt>\s*<dd>(.*?)<\/dd>/gs)];
        const panel = { querySelectorAll: () => pairs.map(([, label, text]) => ({
            textContent: label, nextElementSibling: { tagName: 'DD', textContent: text },
        })) };
        const result = readComparison(panel);
        for (const field of comparisonFields) {
            assert.equal(result[field], pairs.find(pair => pair[1] === field)[2], `${page}: ${field}`);
        }
        assert.ok(html.includes('id="project-facts"'));
        assert.equal(new URL(`${page}#project-facts`, 'https://example.test/pages/projects.html').pathname, `/pages/${page}`);
    }
});

test('missing panels and fields are explicit', () => {
    for (const panel of [null, { querySelectorAll: () => [] }]) {
        assert.deepEqual(Object.values(readComparison(panel)), comparisonFields.map(() => 'Not provided in public panel.'));
    }
});

test('selection survives independent filtering, caps at three, and supports removal and reselection', () => {
    let selected = [];
    for (const id of ['a', 'b', 'c', 'd']) selected = toggleSelection(selected, id);
    assert.deepEqual(selected, ['a', 'b', 'c']);
    const filtered = ['d'];
    assert.deepEqual(selected, ['a', 'b', 'c']);
    selected = toggleSelection(selected, 'b');
    selected = toggleSelection(selected, filtered[0]);
    assert.deepEqual(selected, ['a', 'c', 'd']);
    assert.deepEqual(toggleSelection(selected, 'a'), ['c', 'd']);
});
