let sharedGraphemeSegmenter = null;

function getGraphemeSegmenter() {
    if (sharedGraphemeSegmenter === null) {
        sharedGraphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    }

    return sharedGraphemeSegmenter;
}

export function splitBannerWaveGlyphs(text) {
    const safeText = typeof text === 'string' ? text : String(text ?? '');
    if (!safeText) {
        return [];
    }

    let waveIndex = 0;
    const glyphs = [];

    for (const part of getGraphemeSegmenter().segment(safeText)) {
        const glyph = part.segment;
        if (/^\s+$/.test(glyph)) {
            glyphs.push({
                isAnimated: false,
                text: glyph,
                waveIndex: null
            });
            continue;
        }

        glyphs.push({
            isAnimated: true,
            text: glyph,
            waveIndex
        });
        waveIndex += 1;
    }

    return glyphs;
}
