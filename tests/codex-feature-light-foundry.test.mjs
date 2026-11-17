import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { defaults, compose, palettes } from '../src/codex-feature-light-foundry-model.mjs';
import { measureBeam, identicalFrame } from '../src/codex-feature-light-foundry-probe.mjs';

test('pixel measurements reject blank or unchanged effects and detect actual light changes', () => {
    const pixels = new Uint8Array(400);
    assert.equal(measureBeam(pixels, 1).position, 'blank');
    pixels.set([80, 40, 200, 255], 25 * 4);
    const left = measureBeam(pixels, .7);
    assert.equal(left.position, 'left');
    assert.equal(left.color, 'violet');
    const moved = new Uint8Array(400);
    moved.set([200, 60, 20, 255], 75 * 4);
    assert.equal(measureBeam(moved, .7).position, 'right');
    assert.equal(measureBeam(moved, .7).color, 'ember');
    assert.ok(measureBeam(moved, 1).brightness > measureBeam(moved, .2).brightness * 4);
    assert.deepEqual(measureBeam(pixels.slice(), .7), left);
    assert.equal(identicalFrame(pixels.slice(), pixels, .7, .7), true);
    const outsideBeam = pixels.slice();
    outsideBeam[0] = 1;
    assert.equal(identicalFrame(outsideBeam, pixels, .7, .7), false);
    assert.equal(identicalFrame(pixels, pixels, .2, .7), false);
    assert.equal(identicalFrame(pixels.subarray(4), pixels, .7, .7), false);
});

test('composition moves the beam, changes light, and resets exactly', () => {
    const initial = compose(defaults);
    const left = compose({ position: 25, intensity: 40, palette: 'ember' });
    const right = compose({ position: 75, intensity: 100, palette: 'ice' });
    assert.equal(left.beamPosition, 0.25);
    assert.equal(right.beamPosition, 0.75);
    assert.notEqual(left.color, right.color);
    assert.ok(left.brightness < right.brightness);
    assert.deepEqual(compose({ ...defaults }), initial);
    assert.equal(Object.keys(palettes).length, 3);
});

test('invalid compositions fail before reaching graphics', () => {
    for (const change of [{ position: NaN }, { position: 101 }, { intensity: -1 },
        { palette: 'remote' }]) {
        assert.throws(() => compose({ ...defaults, ...change }), RangeError);
    }
});

test('page keeps a static composition and loads both pinned build assets', async () => {
    const page = await readFile(new URL('../pages/light-foundry.html', import.meta.url), 'utf8');
    assert.match(page, /id="foundry-static"/);
    assert.match(page, /src\/codex-feature-light-foundry\.js/);
    assert.match(page, /src\/codex-feature-light-foundry\.css/);
    const manifest = JSON.parse(await readFile(new URL(
        '../src/codex-feature-light-foundry.react-bits.json', import.meta.url), 'utf8'));
    assert.deepEqual(manifest.components, ['LaserFlow', 'SpecularButton']);
});
