import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { headingLines } from '../src/codex-feature-help-labels-model.mjs';

test('help hierarchy declares exactly the pinned components used by its React entry', async () => {
    const asset = name => new URL(`../src/codex-feature-help-labels.${name}`, import.meta.url);
    const manifest = JSON.parse(await readFile(asset('react-bits.json'), 'utf8'));
    const entry = await readFile(asset('jsx'), 'utf8');
    const imports = [...entry.matchAll(/from 'react-bits:([^']+)'/g)].map(match => match[1]);
    assert.deepEqual(manifest.components, ['GradientText', 'StarBorder']);
    assert.deepEqual(imports, manifest.components);
});

test('help hierarchy follows semantic title metadata through wrapped fragments', () => {
    const block = role => ({ id: role, top: 0, data: { type: 'help-heading', role },
        layout: { plans: [0, 24].map(y => ({ x: 0, y,
            plans: [{ text: 'Wrapped heading', x: 0, width: 150 }] })) } });
    const lines = headingLines([block('title'), block('section')],
        { paddingX: 12, lineHeight: 24, textFont: '18px monospace' }, 0, 200);
    assert.deepEqual(lines.map(line => line.kind), ['title', 'title', 'section', 'section']);
    assert.deepEqual(lines.map(line => line.width), [150, 150, 150, 150]);
});

test('wrapped labels do not overlap across zero during fractional scrolling', () => {
    const block = { id: 'wrapped', top: 100, data: { type: 'help-heading' },
        layout: { plans: [0, 24].map(y => ({ x: 0, y,
            plans: [{ text: 'Heading fragment', x: 0, width: 150 }] })) } };
    // Chromium stores CSS positions in 1/64px units, truncating toward zero.
    const cssPosition = value => Math.trunc(value * 64) / 64;
    for (const fraction of [0.001, 0.009, 0.017, 0.333, 0.999]) {
        const lines = headingLines([block], { paddingX: 12, lineHeight: 24,
            textFont: '18px monospace' }, 100 + fraction, 200);
        assert.equal(lines.length, 2);
        assert.ok(cssPosition(lines[1].y) >= cssPosition(lines[0].y) + lines[0].height,
            `wrapped rows stay disjoint at scroll fraction ${fraction}`);
        assert.ok(Math.abs(lines[0].y + fraction) <= 1 / 128,
            'overlay remains aligned with the Canvas fragment');
    }
});
