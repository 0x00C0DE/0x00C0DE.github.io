import test from 'node:test';
import assert from 'node:assert/strict';

import { splitBannerWaveGlyphs } from '../banner-wave-core.mjs';

test('splitBannerWaveGlyphs assigns wave indexes only to visible glyphs', () => {
    assert.deepEqual(splitBannerWaveGlyphs('0x 0'), [
        { isAnimated: true, text: '0', waveIndex: 0 },
        { isAnimated: true, text: 'x', waveIndex: 1 },
        { isAnimated: false, text: ' ', waveIndex: null },
        { isAnimated: true, text: '0', waveIndex: 2 }
    ]);
});

test('splitBannerWaveGlyphs preserves grapheme clusters and punctuation', () => {
    assert.deepEqual(splitBannerWaveGlyphs('Flé!'), [
        { isAnimated: true, text: 'F', waveIndex: 0 },
        { isAnimated: true, text: 'l', waveIndex: 1 },
        { isAnimated: true, text: 'é', waveIndex: 2 },
        { isAnimated: true, text: '!', waveIndex: 3 }
    ]);
});
