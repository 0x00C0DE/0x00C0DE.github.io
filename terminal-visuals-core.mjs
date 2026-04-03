const DEFAULT_BINARY_GLYPHS = '01';

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

function roundTo(value, decimals = 0) {
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
}

function normalizeGlyphs(glyphs) {
    const safeGlyphs = typeof glyphs === 'string' ? glyphs : DEFAULT_BINARY_GLYPHS;
    const uniqueGlyphs = Array.from(new Set(Array.from(safeGlyphs).filter(Boolean)));
    return uniqueGlyphs.length > 0 ? uniqueGlyphs.join('') : DEFAULT_BINARY_GLYPHS;
}

function pickGlyph(glyphs, rng) {
    const index = Math.floor(rng() * glyphs.length);
    return glyphs.charAt(clamp(index, 0, glyphs.length - 1));
}

function createBinaryRainStream(length, glyphs, rng) {
    const output = [];
    for (let index = 0; index < length; index += 1) {
        output.push(pickGlyph(glyphs, rng));
    }
    return output.join('\n');
}

export function getPromptUserClassName(snapshot) {
    const isRoot = Boolean(snapshot && typeof snapshot === 'object' && snapshot.isRoot);
    return isRoot ? 'prompt-user prompt-user-root' : 'prompt-user';
}

export function createBinaryRainColumns(options = {}) {
    const width = Number.isFinite(options.width) ? options.width : 1280;
    const height = Number.isFinite(options.height) ? options.height : 720;
    const rng = typeof options.rng === 'function' ? options.rng : Math.random;
    const glyphs = normalizeGlyphs(options.glyphs);
    const requestedCount = Number.isFinite(options.columnCount) ? Math.floor(options.columnCount) : null;
    const automaticCount = clamp(Math.floor(width / 44), 12, 40);
    const columnCount = requestedCount === null
        ? automaticCount
        : clamp(requestedCount, 1, 60);
    const safeHeight = Math.max(240, height);
    const columns = [];

    for (let index = 0; index < columnCount; index += 1) {
        const spacing = 100 / columnCount;
        const jitterRange = spacing * 0.46;
        const leftPercent = clamp(
            index * spacing + rng() * jitterRange,
            0,
            100
        );
        const fontSizePx = roundTo(14 + rng() * 18, 1);
        const streamLength = clamp(
            Math.floor(safeHeight / Math.max(fontSizePx * 0.82, 10)) + 8 + Math.floor(rng() * 14),
            16,
            60
        );

        columns.push({
            blurPx: roundTo(rng() < 0.2 ? 0.5 + rng() * 1.8 : 0, 1),
            delayMs: -Math.round(rng() * 12000),
            durationMs: Math.round(6000 + rng() * 10000),
            fontSizePx,
            leftPercent: roundTo(leftPercent, 2),
            opacity: roundTo(0.16 + rng() * 0.38, 2),
            stream: createBinaryRainStream(streamLength, glyphs, rng)
        });
    }

    return columns.sort((left, right) => left.leftPercent - right.leftPercent);
}
