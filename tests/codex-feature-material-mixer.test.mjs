import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initial, change } from '../src/codex-feature-material-mixer-model.mjs';
import { equalPixels } from '../src/codex-feature-material-mixer-probe.mjs';

test('render comparison rejects missing, resized, or changed pixel buffers', () => {
    const frame = new Uint8Array([10, 20, 30, 255]);
    assert.equal(equalPixels(frame, frame.slice()), true);
    assert.equal(equalPixels(frame, undefined), false);
    assert.equal(equalPixels(frame, frame.subarray(1)), false);
    assert.equal(equalPixels(frame, new Uint8Array([11, 20, 30, 255])), false);
});

test('boundary and density change independently; Undo and Reset restore settings', () => {
    const start = initial();
    const left = change(start, 'boundary', 25);
    const right = change(left, 'boundary', 75);
    const dense = change(right, 'density', 3);
    assert.deepEqual(dense.current, { boundary: 75, density: 3 });
    assert.deepEqual(change(dense, 'undo').current, right.current);
    assert.deepEqual(change(dense, 'reset'), start);
    assert.equal(change(start, 'undo'), start);
    assert.equal(change(start, 'boundary', 50), start);
    for (const value of [NaN, 0, 101, '75']) {
        assert.throws(() => change(start, 'boundary', value), RangeError);
    }
    assert.throws(() => change(start, 'density', 4), RangeError);
});

test('public page loads pinned assets and preserves a no-script material study', async () => {
    const read = path => readFile(new URL(path, import.meta.url), 'utf8');
    const page = await read('../pages/material-mixer.html');
    assert.match(page, /id="mixer-static"/);
    assert.match(page, /codex-feature-material-mixer\.js/);
    assert.match(page, /codex-feature-material-mixer\.css/);
    assert.deepEqual(JSON.parse(await read('../src/codex-feature-material-mixer.react-bits.json')),
        { components: ['LiquidChrome', 'Silk', 'SpecularButton'] });
});
