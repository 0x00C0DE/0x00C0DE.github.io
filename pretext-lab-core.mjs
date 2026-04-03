export const PRETEXT_DEFAULT_STATE = Object.freeze({
    text: [
        'Pretext now powers this in-repo lab.',
        'Resize the width, tweak line height, and watch the measured lines update without DOM reflow guesses.'
    ].join('\n'),
    fontFamily: '"Courier New", monospace',
    fontSize: 18,
    lineHeight: 28,
    maxWidth: 480,
    whiteSpace: 'pre-wrap'
});

const PRETEXT_LIMITS = Object.freeze({
    fontSize: { min: 12, max: 36 },
    lineHeight: { min: 16, max: 72 },
    maxWidth: { min: 80, max: 960 }
});

function clampNumber(value, fallback, limits) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.min(limits.max, Math.max(limits.min, Math.round(parsed)));
}

function normalizeText(value) {
    if (typeof value !== 'string') {
        return PRETEXT_DEFAULT_STATE.text;
    }

    return value.trim() ? value : PRETEXT_DEFAULT_STATE.text;
}

function normalizeWhiteSpace(value) {
    return value === 'normal' ? 'normal' : 'pre-wrap';
}

export function normalizePretextState(input = {}) {
    return {
        text: normalizeText(input.text),
        fontFamily: PRETEXT_DEFAULT_STATE.fontFamily,
        fontSize: clampNumber(input.fontSize, PRETEXT_DEFAULT_STATE.fontSize, PRETEXT_LIMITS.fontSize),
        lineHeight: clampNumber(input.lineHeight, PRETEXT_DEFAULT_STATE.lineHeight, PRETEXT_LIMITS.lineHeight),
        maxWidth: clampNumber(input.maxWidth ?? input.width, PRETEXT_DEFAULT_STATE.maxWidth, PRETEXT_LIMITS.maxWidth),
        whiteSpace: normalizeWhiteSpace(input.whiteSpace)
    };
}

export function parsePretextStateFromSearch(search = '') {
    const params = new URLSearchParams(String(search || '').startsWith('?') ? search.slice(1) : search);
    return normalizePretextState({
        text: params.get('text') ?? PRETEXT_DEFAULT_STATE.text,
        width: params.get('width'),
        fontSize: params.get('fontSize'),
        lineHeight: params.get('lineHeight'),
        whiteSpace: params.get('whiteSpace')
    });
}

export function buildPretextSearch(state) {
    const normalized = normalizePretextState(state);
    const params = new URLSearchParams();
    params.set('text', normalized.text);
    params.set('width', String(normalized.maxWidth));
    params.set('fontSize', String(normalized.fontSize));
    params.set('lineHeight', String(normalized.lineHeight));
    params.set('whiteSpace', normalized.whiteSpace);
    return params.toString();
}

export function buildPretextLabHref(text = '') {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!trimmed) {
        return 'pretext-lab.html';
    }

    const params = new URLSearchParams({ text: trimmed });
    return `pretext-lab.html?${params.toString()}`;
}

export function buildPretextLayout(pretextApi, input = {}) {
    if (!pretextApi || typeof pretextApi.prepareWithSegments !== 'function' || typeof pretextApi.layoutWithLines !== 'function') {
        throw new Error('pretext api is required');
    }

    const normalized = normalizePretextState(input);
    const font = `${normalized.fontSize}px ${normalized.fontFamily}`;
    const prepared = pretextApi.prepareWithSegments(normalized.text, font, {
        whiteSpace: normalized.whiteSpace
    });
    const layout = pretextApi.layoutWithLines(prepared, normalized.maxWidth, normalized.lineHeight);
    const lines = Array.isArray(layout.lines)
        ? layout.lines.map((line, index) => ({
            index,
            text: line.text,
            width: Math.ceil(line.width ?? 0)
        }))
        : [];
    const widestLineWidth = lines.reduce((currentMax, line) => Math.max(currentMax, line.width), 0);

    return {
        ...normalized,
        font,
        height: layout.height,
        lineCount: layout.lineCount,
        widestLineWidth,
        lines
    };
}
