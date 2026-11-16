import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pageText, findPassages } from '../src/codex-feature-resume-reader-model.mjs';

test('search spans PDF line breaks with exact page and line provenance', () => {
    const page = pageText([{ str: 'Alpha cloud', transform: [1,0,0,1,0,20] },
        { str: 'applications beta', transform: [1,0,0,1,0,10] }], 3);
    const [match] = findPassages([page], 'CLOUD \n applications');
    assert.equal(match.page.number, 3);
    assert.deepEqual([match.from, match.to], [0, 1]);
    assert.equal(page.text.slice(match.start, match.end), 'cloud applications');
    assert.deepEqual(findPassages([page], 'missing'), []);
    assert.deepEqual(findPassages([page], '  '), []);
    assert.equal(findPassages([page], 'a').length, 5);
});

test('public route loads the build outputs and preserves the static PDF fallback', async () => {
    const load = path => readFile(new URL(path, import.meta.url), 'utf8');
    const html = await load('../pages/resume-reader.html');
    assert.match(html, /href="\/assets\/resume.pdf"/);
    assert.match(html, /src="\/src\/codex-feature-resume-reader.js"/);
    assert.match(html, /href="\/src\/codex-feature-resume-reader.css"/);
    const manifest = JSON.parse(await load('../src/codex-feature-resume-reader.react-bits.json'));
    assert.deepEqual(manifest.components, ['LineSidebar', 'SpotlightCard']);
    const css = await load('../src/codex-feature-resume-reader-style.css');
    assert.match(css, /prefers-reduced-motion/);
    assert.ok(css.split('\n').filter(line => line.includes('{') && !line.startsWith('@'))
        .every(line => line.trim().startsWith('#resume-reader')));
});

test('published PDF reading order is single-column and searchable across wraps', async () => {
    // Extraction uses no DOM geometry. These shims support the browser build in Node 24.
    globalThis.DOMMatrix ??= class {};
    Uint8Array.prototype.toHex ??= function () { return Buffer.from(this).toString('hex'); };
    const { getDocument, GlobalWorkerOptions } = await import('../vendor/pdfjs/pdf.min.mjs');
    GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
    const task = getDocument({ data: new Uint8Array(await readFile(new URL('../assets/resume.pdf', import.meta.url))),
        isEvalSupported: false, disableFontFace: true });
    try {
        const pdf = await task.promise;
        assert.equal(pdf.numPages, 1);
        const source = await pdf.getPage(1);
        const { items } = await source.getTextContent();
        const rows = items.filter(item => item.str.trim());
        assert.ok(rows.every((item, i) => i === 0 || item.transform[5] <= rows[i - 1].transform[5]));
        const page = pageText(items, 1);
        const headings = ['Technical Highlights', 'Skills', 'Professional Experience', 'Technical Projects', 'Education'];
        assert.deepEqual(headings.map(h => page.text.indexOf(h)).toSorted((a,b) => a-b),
            headings.map(h => page.text.indexOf(h)));
        assert.ok(headings.every(h => page.text.includes(h)));
        const [match] = findPassages([page], 'improve operational efficiency');
        assert.ok(match.to > match.from);
        assert.equal(page.text.slice(match.start, match.end), 'improve operational efficiency');
        assert.deepEqual(findPassages([page], 'zz-no-such-passage-zz'), []);
    } finally { await task.destroy(); }
});
