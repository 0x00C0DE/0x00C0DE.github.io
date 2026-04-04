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

function compareLayoutCursor(left, right) {
    const leftSegmentIndex = Number(left?.segmentIndex) || 0;
    const rightSegmentIndex = Number(right?.segmentIndex) || 0;

    if (leftSegmentIndex !== rightSegmentIndex) {
        return leftSegmentIndex - rightSegmentIndex;
    }

    return (Number(left?.graphemeIndex) || 0) - (Number(right?.graphemeIndex) || 0);
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

function clampNumber(value, minimum, maximum) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return minimum;
    }

    return Math.min(maximum, Math.max(minimum, numericValue));
}

function mergeOccupiedRanges(ranges) {
    const merged = [];
    const sortedRanges = ranges
        .filter(range => Number.isFinite(range?.left) && Number.isFinite(range?.right) && range.right > range.left)
        .sort((left, right) => left.left - right.left);

    sortedRanges.forEach(range => {
        const previous = merged[merged.length - 1];
        if (!previous || range.left > previous.right) {
            merged.push({ ...range });
            return;
        }

        previous.right = Math.max(previous.right, range.right);
    });

    return merged;
}

function buildAvailableRowSegments(maxWidth, rowTop, lineHeight, obstacleRects, minSegmentWidth) {
    const rowBottom = rowTop + lineHeight;
    const occupiedRanges = mergeOccupiedRanges(
        obstacleRects
            .filter(rect => rect.y < rowBottom && rect.y + rect.height > rowTop)
            .map(rect => ({
                left: clampNumber(rect.x, 0, maxWidth),
                right: clampNumber(rect.x + rect.width, 0, maxWidth)
            }))
    );

    const availableSegments = [];
    let cursor = 0;

    occupiedRanges.forEach(range => {
        if (range.left - cursor >= minSegmentWidth) {
            availableSegments.push({
                x: cursor,
                width: range.left - cursor
            });
        }
        cursor = Math.max(cursor, range.right);
    });

    if (maxWidth - cursor >= minSegmentWidth) {
        availableSegments.push({
            x: cursor,
            width: maxWidth - cursor
        });
    }

    return availableSegments;
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

export function buildTerminalEditorialLayout(pretextApi, options = {}) {
    if (!pretextApi || typeof pretextApi.prepareWithSegments !== 'function' || typeof pretextApi.layoutNextLine !== 'function') {
        throw new Error('pretext editorial api is required');
    }

    const tokens = Array.isArray(options.tokens)
        ? options.tokens
        : tokenizeTerminalText(options.text || '', options.linkOptions);
    const text = getTerminalTextFromTokens(tokens);
    const font = options.font || '18px "Courier New", monospace';
    const whiteSpace = options.whiteSpace || 'pre-wrap';
    const lineHeight = Math.max(1, Number(options.lineHeight) || 20);
    const maxWidth = Math.max(0, Number(options.maxWidth) || 0);
    const minSegmentWidth = Math.max(24, Number(options.minSegmentWidth) || Math.min(72, Math.max(32, Math.round(maxWidth * 0.18))));
    const obstacleRects = Array.isArray(options.obstacles)
        ? options.obstacles
            .map(rect => ({
                x: clampNumber(rect?.x, 0, maxWidth),
                y: Math.max(0, Number(rect?.y) || 0),
                width: Math.max(0, Math.min(maxWidth, Number(rect?.width) || 0)),
                height: Math.max(0, Number(rect?.height) || 0)
            }))
            .filter(rect => rect.width > 0 && rect.height > 0)
        : [];

    const prepared = pretextApi.prepareWithSegments(text, font, { whiteSpace });
    if (!prepared || !Array.isArray(prepared.widths) || prepared.widths.length === 0) {
        const obstacleBottom = obstacleRects.reduce((currentMax, rect) => Math.max(currentMax, rect.y + rect.height), 0);
        return {
            font,
            height: obstacleBottom,
            lineCount: 0,
            lines: [],
            maxWidth,
            obstacleRects,
            prepared,
            text,
            textHeight: 0,
            whiteSpace
        };
    }

    const lines = [];
    let cursor = {
        segmentIndex: 0,
        graphemeIndex: 0
    };
    let rowTop = 0;
    let guard = 0;

    while (guard < 10000) {
        const availableSegments = buildAvailableRowSegments(maxWidth, rowTop, lineHeight, obstacleRects, minSegmentWidth);
        if (availableSegments.length === 0) {
            rowTop += lineHeight;
            guard += 1;
            continue;
        }

        let placedLineOnRow = false;
        for (const segment of availableSegments) {
            const line = pretextApi.layoutNextLine(prepared, cursor, segment.width);
            if (line === null) {
                const textBottom = lines.length > 0
                    ? lines[lines.length - 1].y + lineHeight
                    : 0;
                const obstacleBottom = obstacleRects.reduce((currentMax, rect) => Math.max(currentMax, rect.y + rect.height), 0);
                return {
                    font,
                    height: Math.max(textBottom, obstacleBottom),
                    lineCount: lines.length,
                    lines,
                    maxWidth,
                    obstacleRects,
                    prepared,
                    text,
                    textHeight: textBottom,
                    whiteSpace
                };
            }

            if (compareLayoutCursor(line.end, cursor) <= 0) {
                continue;
            }

            const startOffset = getAbsoluteOffsetFromPreparedRange(prepared, line.start);
            const endOffset = getAbsoluteOffsetFromPreparedRange(prepared, line.end);
            lines.push({
                ...line,
                x: segment.x,
                y: rowTop,
                startOffset,
                endOffset,
                fragments: sliceTerminalTokensByOffsets(tokens, startOffset, endOffset)
            });
            cursor = line.end;
            placedLineOnRow = true;
        }

        rowTop += lineHeight;
        guard += 1;

        if (!placedLineOnRow) {
            const obstacleBottom = obstacleRects.reduce((currentMax, rect) => Math.max(currentMax, rect.y + rect.height), 0);
            return {
                font,
                height: Math.max(rowTop, obstacleBottom),
                lineCount: lines.length,
                lines,
                maxWidth,
                obstacleRects,
                prepared,
                text,
                textHeight: lines.length > 0
                    ? lines[lines.length - 1].y + lineHeight
                    : 0,
                whiteSpace
            };
        }
    }

    throw new Error('unable to resolve terminal editorial layout');
}
