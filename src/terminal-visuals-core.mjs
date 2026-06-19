const DEFAULT_BINARY_GLYPHS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ!?@#$%&*+-=<>[]{}';

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

function pickDifferentGlyph(currentGlyph, glyphs, rng) {
    if (glyphs.length <= 1) {
        return glyphs.charAt(0);
    }

    let nextGlyph = pickGlyph(glyphs, rng);
    if (nextGlyph === currentGlyph) {
        const currentIndex = glyphs.indexOf(currentGlyph);
        const nextIndex = currentIndex >= 0
            ? (currentIndex + 1 + Math.floor(rng() * (glyphs.length - 1))) % glyphs.length
            : Math.floor(rng() * glyphs.length);
        nextGlyph = glyphs.charAt(clamp(nextIndex, 0, glyphs.length - 1));
    }
    return nextGlyph;
}

function createBinaryRainCells(length, glyphs, rng) {
    const output = [];
    for (let index = 0; index < length; index += 1) {
        output.push(pickGlyph(glyphs, rng));
    }
    return output;
}

function createBinaryRainStream(cells) {
    return cells.join('\n');
}

export function getPromptUserClassName(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
        return 'prompt-user';
    }

    if (snapshot.isGodlike || String(snapshot.user || '').trim().toLowerCase() === 'godlike') {
        return 'prompt-user prompt-user-godlike';
    }

    return snapshot.isRoot ? 'prompt-user prompt-user-root' : 'prompt-user';
}

export function shouldUseRootTerminalVisuals(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
        return false;
    }

    if (snapshot.isRoot || snapshot.isGodlike) {
        return true;
    }

    const normalizedUser = String(snapshot.user || '').trim().toLowerCase();
    return normalizedUser === 'root' || normalizedUser === 'godlike';
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
        const cells = createBinaryRainCells(streamLength, glyphs, rng);

        columns.push({
            blurPx: roundTo(rng() < 0.2 ? 0.5 + rng() * 1.8 : 0, 1),
            delayMs: -Math.round(rng() * 12000),
            durationMs: Math.round(6000 + rng() * 10000),
            fontSizePx,
            glyphs,
            leftPercent: roundTo(leftPercent, 2),
            mutationIntervalMs: Math.round(70 + rng() * 170),
            opacity: roundTo(0.16 + rng() * 0.38, 2),
            cells,
            stream: createBinaryRainStream(cells)
        });
    }

    return columns.sort((left, right) => left.leftPercent - right.leftPercent);
}

export function advanceBinaryRainColumn(column, options = {}) {
    const rng = typeof options.rng === 'function' ? options.rng : Math.random;
    const glyphs = normalizeGlyphs(options.glyphs ?? column?.glyphs);
    const sourceCells = Array.isArray(column?.cells)
        ? column.cells
        : String(column?.stream || '')
            .split('\n')
            .filter(entry => entry.length > 0);
    const cells = [...sourceCells];

    if (cells.length === 0) {
        return {
            ...column,
            cells,
            glyphs,
            mutatedIndexes: [],
            stream: ''
        };
    }

    const mutationCount = clamp(
        Math.round(cells.length * (0.08 + rng() * 0.2)),
        1,
        cells.length
    );

    for (let index = 0; index < mutationCount; index += 1) {
        const cellIndex = clamp(Math.floor(rng() * cells.length), 0, cells.length - 1);
        cells[cellIndex] = pickDifferentGlyph(cells[cellIndex], glyphs, rng);
    }

    const mutatedIndexes = [];
    for (let index = 0; index < cells.length; index += 1) {
        if (cells[index] !== sourceCells[index]) {
            mutatedIndexes.push(index);
        }
    }

    return {
        ...column,
        cells,
        glyphs,
        mutatedIndexes,
        stream: createBinaryRainStream(cells)
    };
}

export function getBinaryRainColumnFrame(column, options = {}) {
    const height = Number.isFinite(options.height) ? options.height : 720;
    const timestamp = Number.isFinite(options.timestamp) ? options.timestamp : 0;
    const fontSizePx = Number.isFinite(column?.fontSizePx) ? column.fontSizePx : 16;
    const glyphHeight = Math.max(12, roundTo(fontSizePx * 0.84, 1));
    const cells = Array.isArray(column?.cells)
        ? column.cells
        : String(column?.stream || '')
            .split('\n')
            .filter(Boolean);
    const streamHeight = Math.max(glyphHeight, cells.length * glyphHeight);
    const durationMs = Math.max(1000, Number.isFinite(column?.durationMs) ? column.durationMs : 9000);
    const delayMs = Number.isFinite(column?.delayMs) ? column.delayMs : 0;
    const elapsed = timestamp - delayMs;
    const progress = elapsed < 0 ? 0 : (elapsed % durationMs) / durationMs;
    const startY = -streamHeight * 1.25;
    const endY = height * 1.35;

    return {
        blurPx: Number.isFinite(column?.blurPx) ? column.blurPx : 0,
        durationMs,
        fontSizePx,
        glyphHeight,
        leftPercent: clamp(Number.isFinite(column?.leftPercent) ? column.leftPercent : 0, 0, 100),
        opacity: clamp(Number.isFinite(column?.opacity) ? column.opacity : 0.22, 0.05, 1),
        progress,
        streamHeight,
        x: clamp(Number.isFinite(column?.leftPercent) ? column.leftPercent : 0, 0, 100) / 100,
        y: startY + (endY - startY) * progress
    };
}
