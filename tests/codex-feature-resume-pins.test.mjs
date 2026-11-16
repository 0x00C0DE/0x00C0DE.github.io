import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pageText, findPassages } from '../src/codex-feature-resume-reader-model.mjs';
import { keepPassage, passageKey, passageContext } from '../src/codex-feature-resume-pins-model.mjs';

test('two queries retain unique passages and removal preserves original offsets', () => {
    const page = pageText(['Python systems', 'Reliable services', 'Cloud tools'].map((str, i) =>
        ({ str, transform: [1, 0, 0, 1, 0, 30 - i * 10] })), 2);
    const [first] = findPassages([page], 'Python');
    const [second] = findPassages([page], 'services');
    const [third] = findPassages([page], 'Cloud');
    let pins = keepPassage([], first);
    assert.equal(keepPassage(pins, first), pins);
    pins = keepPassage(pins, second);
    assert.deepEqual(pins, [first, second]);
    assert.equal(keepPassage(pins, third), pins);
    assert.equal(keepPassage(pins, null), pins);
    pins = pins.filter(pin => passageKey(pin) !== passageKey(first));
    assert.deepEqual(pins, [second]);
    assert.equal(pins[0].page.text.slice(pins[0].start, pins[0].end), 'services');
    assert.equal(passageContext(second), page.lines.map(line => line.text).join('\n'));
    assert.equal(pins[0].page.number, 2);
    assert.deepEqual([pins[0].from, pins[0].to], [1, 1]);
    assert.deepEqual(keepPassage(pins, third), [second, third]);
});

test('published PDF provides both browser-plan passages with exact context', async () => {
    globalThis.DOMMatrix ??= class {};
    Uint8Array.prototype.toHex ??= function () { return Buffer.from(this).toString('hex'); };
    const { getDocument, GlobalWorkerOptions } = await import('../vendor/pdfjs/pdf.min.mjs');
    GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
    const task = getDocument({ data: new Uint8Array(await readFile(new URL('../assets/resume.pdf', import.meta.url))),
        isEvalSupported: false, disableFontFace: true });
    try {
        const pdf = await task.promise;
        const source = await pdf.getPage(1);
        const page = pageText((await source.getTextContent()).items, 1);
        const [python] = findPassages([page], 'Python');
        const [skills] = findPassages([page], 'Skills');
        const pins = keepPassage(keepPassage([], python), skills);
        assert.equal(pins.length, 2);
        for (const pin of pins) {
            const context = page.lines.slice(Math.max(0, pin.from - 1), pin.to + 2);
            assert.equal(passageContext(pin), context.map(line => line.text).join('\n'));
            assert.ok(passageContext(pin).includes(page.text.slice(pin.start, pin.end)));
        }
    } finally { await task.destroy(); }
});

test('route mounts isolated pinned components', async () => {
    const load = path => readFile(new URL(path, import.meta.url), 'utf8');
    const html = await load('../pages/resume-reader.html');
    assert.match(html, /id="resume-pins"/);
    assert.match(html, /src="\/src\/codex-feature-resume-pins.js"/);
    assert.match(html, /href="\/src\/codex-feature-resume-pins.css"/);
    const manifest = JSON.parse(await load('../src/codex-feature-resume-pins.react-bits.json'));
    assert.deepEqual(manifest.components, ['SpecularButton', 'SpotlightCard']);
    const css = await load('../src/codex-feature-resume-pins-style.css');
    assert.ok(css.split('\n').filter(line => line.includes('{') && !line.startsWith('@'))
        .every(line => line.trim().startsWith('#resume-pins')));
    assert.match(css, /prefers-reduced-motion/);

});

test('one React root owns the kept-passages container', async () => {
    const source = await readFile(new URL('../src/codex-feature-resume-pins.jsx', import.meta.url), 'utf8');
    assert.equal([...source.matchAll(/createRoot\(/g)].length, 1);
    assert.match(source, /createRoot\(document.getElementById\('resume-pins'\)\)/);
});
