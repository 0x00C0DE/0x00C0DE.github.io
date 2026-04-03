const TERMINAL_LINK_PATTERN = /\bhttps?:\/\/[^\s<]+|\bproject-[a-z0-9-]+\.html\b|\bprojects\.html\b|\bresume\.pdf\b|\b[A-Za-z0-9-]+\.txt\b/gi;

let sharedGraphemeSegmenter = null;

function getGraphemeSegmenter() {
    if (sharedGraphemeSegmenter === null) {
        sharedGraphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    }

    return sharedGraphemeSegmenter;
}

function resolveTerminalLinkToken(tokenText, options = {}) {
    if (/^https?:\/\//i.test(tokenText)) {
        return {
            type: 'link',
            text: tokenText,
            href: tokenText,
            newTab: true
        };
    }

    if (/\.txt$/i.test(tokenText)) {
        const normalized = typeof options.normalizeTextFilename === 'function'
            ? options.normalizeTextFilename(tokenText)
            : tokenText;

        if (!normalized) {
            return {
                type: 'text',
                text: tokenText
            };
        }

        return {
            type: 'link',
            text: normalized,
            href: `?command=${encodeURIComponent(`cat ${normalized}`)}`,
            newTab: false
        };
    }

    return {
        type: 'link',
        text: tokenText,
        href: tokenText,
        newTab: /\.pdf$/i.test(tokenText)
    };
}

export function tokenizeTerminalText(text, options = {}) {
    const safeText = typeof text === 'string' ? text : String(text ?? '');
    if (!safeText) {
        return [];
    }

    const tokens = [];
    let lastIndex = 0;
    let match = TERMINAL_LINK_PATTERN.exec(safeText);

    while (match) {
        const matchText = match[0];
        const start = match.index;
        const end = start + matchText.length;

        if (start > lastIndex) {
            tokens.push({
                type: 'text',
                text: safeText.slice(lastIndex, start),
                start: lastIndex,
                end: start
            });
        }

        const resolved = resolveTerminalLinkToken(matchText, options);
        tokens.push({
            ...resolved,
            start,
            end
        });

        lastIndex = end;
        match = TERMINAL_LINK_PATTERN.exec(safeText);
    }

    if (lastIndex < safeText.length) {
        tokens.push({
            type: 'text',
            text: safeText.slice(lastIndex),
            start: lastIndex,
            end: safeText.length
        });
    }

    return tokens;
}

export function getTerminalTextFromTokens(tokens) {
    return Array.isArray(tokens)
        ? tokens.map(token => token.text || '').join('')
        : '';
}

function getSegmentCodeUnitOffset(segmentText, graphemeIndex) {
    if (!graphemeIndex) {
        return 0;
    }

    let offset = 0;
    let count = 0;
    for (const part of getGraphemeSegmenter().segment(segmentText)) {
        if (count >= graphemeIndex) {
            break;
        }
        offset += part.segment.length;
        count += 1;
    }

    return offset;
}

function getAbsoluteOffsetFromPreparedRange(prepared, position) {
    const segments = Array.isArray(prepared?.segments) ? prepared.segments : [];
    const safeSegmentIndex = Math.max(0, Math.min(Number(position?.segmentIndex) || 0, segments.length));
    let offset = 0;

    for (let index = 0; index < safeSegmentIndex; index += 1) {
        offset += segments[index].length;
    }

    if (safeSegmentIndex < segments.length) {
        offset += getSegmentCodeUnitOffset(
            segments[safeSegmentIndex],
            Math.max(0, Number(position?.graphemeIndex) || 0)
        );
    }

    return offset;
}

function sliceTerminalTokensByOffsets(tokens, startOffset, endOffset) {
    const fragments = [];
    for (const token of tokens) {
        if (token.end <= startOffset || token.start >= endOffset) {
            continue;
        }

        const sliceStart = Math.max(startOffset, token.start) - token.start;
        const sliceEnd = Math.min(endOffset, token.end) - token.start;
        const slicedText = token.text.slice(sliceStart, sliceEnd);
        if (!slicedText) {
            continue;
        }

        if (token.type === 'link') {
            fragments.push({
                type: 'link',
                text: slicedText,
                href: token.href,
                newTab: Boolean(token.newTab)
            });
            continue;
        }

        fragments.push({
            type: 'text',
            text: slicedText
        });
    }

    return fragments;
}

export function buildTerminalPretextLayout(pretextApi, options = {}) {
    if (!pretextApi || typeof pretextApi.prepareWithSegments !== 'function' || typeof pretextApi.layoutWithLines !== 'function') {
        throw new Error('pretext api is required');
    }

    const tokens = Array.isArray(options.tokens)
        ? options.tokens
        : tokenizeTerminalText(options.text || '', options.linkOptions);
    const text = getTerminalTextFromTokens(tokens);
    const font = options.font || '18px "Courier New", monospace';
    const whiteSpace = options.whiteSpace || 'pre-wrap';
    const lineHeight = Number(options.lineHeight) || 20;
    const maxWidth = Number(options.maxWidth) || 0;
    const prepared = pretextApi.prepareWithSegments(text, font, { whiteSpace });
    const layout = pretextApi.layoutWithLines(prepared, maxWidth, lineHeight);

    return {
        ...layout,
        font,
        lineHeight,
        maxWidth,
        whiteSpace,
        lines: Array.isArray(layout.lines)
            ? layout.lines.map(line => {
                const startOffset = getAbsoluteOffsetFromPreparedRange(prepared, line.start);
                const endOffset = getAbsoluteOffsetFromPreparedRange(prepared, line.end);
                return {
                    ...line,
                    startOffset,
                    endOffset,
                    fragments: sliceTerminalTokensByOffsets(tokens, startOffset, endOffset)
                };
            })
            : []
    };
}
