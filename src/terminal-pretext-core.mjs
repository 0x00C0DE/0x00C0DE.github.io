import { tokenizeTerminalText } from './terminal-text-layout.mjs';
export { tokenizeTerminalText };

let sharedGraphemeSegmenter = null;

function getGraphemeSegmenter() {
    if (sharedGraphemeSegmenter === null) {
        sharedGraphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    }

    return sharedGraphemeSegmenter;
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

function buildOffsetResolver(segments) {
    const offsets = [0];
    for (const segment of segments) offsets.push(offsets.at(-1) + segment.length);
    const graphemeOffsets = new Map();
    return ({ segmentIndex, graphemeIndex }) => {
        if (!graphemeIndex) return offsets[segmentIndex];
        if (!graphemeOffsets.has(segmentIndex)) {
            const text = segments[segmentIndex];
            graphemeOffsets.set(segmentIndex, [
                ...Array.from(getGraphemeSegmenter().segment(text), part => part.index),
                text.length
            ]);
        }
        return offsets[segmentIndex] + graphemeOffsets.get(segmentIndex)[graphemeIndex];
    };
}

function sliceTerminalTokensByOffsets(tokens, startOffset, endOffset) {
    const fragments = [];
    let low = 0;
    let high = tokens.length;
    while (low < high) {
        const middle = (low + high) >>> 1;
        if (tokens[middle].end <= startOffset) low = middle + 1;
        else high = middle;
    }
    for (let index = low; index < tokens.length && tokens[index].start < endOffset; index += 1) {
        const token = tokens[index];

        const sliceStart = Math.max(startOffset, token.start) - token.start;
        const sliceEnd = Math.min(endOffset, token.end) - token.start;
        const slicedText = token.text.slice(sliceStart, sliceEnd);
        if (!slicedText) {
            continue;
        }

        const baseFragment = { ...token };
        delete baseFragment.start;
        delete baseFragment.end;
        delete baseFragment.text;

        if (token.type === 'link') {
            fragments.push({
                ...baseFragment,
                type: 'link',
                text: slicedText,
                href: token.href,
                newTab: Boolean(token.newTab)
            });
            continue;
        }

        fragments.push({
            ...baseFragment,
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

function assertTerminalPrepareApi(pretextApi) {
    if (!pretextApi || typeof pretextApi.prepareWithSegments !== 'function') {
        throw new Error('pretext api is required');
    }
}

function assertTerminalLayoutApi(pretextApi) {
    if (!pretextApi || typeof pretextApi.layoutWithLines !== 'function') {
        throw new Error('pretext api is required');
    }
}

function assertTerminalEditorialApi(pretextApi) {
    if (!pretextApi || typeof pretextApi.layoutNextLine !== 'function') {
        throw new Error('pretext editorial api is required');
    }
}

function resolveTerminalTokens(options = {}) {
    return Array.isArray(options.tokens)
        ? options.tokens
        : tokenizeTerminalText(options.text || '', options.linkOptions);
}

export function prepareTerminalText(pretextApi, options = {}) {
    assertTerminalPrepareApi(pretextApi);

    const tokens = resolveTerminalTokens(options);
    const text = getTerminalTextFromTokens(tokens);
    const font = options.font || '18px "Courier New", monospace';
    const whiteSpace = options.whiteSpace || 'pre-wrap';
    const wordBreak = typeof options.wordBreak === 'string' && options.wordBreak
        ? options.wordBreak
        : null;
    const preparedOptions = { whiteSpace };
    if (options.canvasOnly) preparedOptions.canvasOnly = true;
    if (wordBreak) {
        preparedOptions.wordBreak = wordBreak;
    }
    const prepared = pretextApi.prepareWithSegments(text, font, preparedOptions);

    return {
        font,
        prepared,
        resolveOffset: buildOffsetResolver(prepared.segments || []),
        text,
        tokens,
        whiteSpace,
        wordBreak: wordBreak || 'normal'
    };
}

export function layoutPreparedTerminalText(pretextApi, preparedTextState, options = {}) {
    assertTerminalLayoutApi(pretextApi);

    if (!preparedTextState || typeof preparedTextState !== 'object') {
        throw new Error('prepared terminal text state is required');
    }

    const tokens = Array.isArray(preparedTextState.tokens) ? preparedTextState.tokens : [];
    const text = typeof preparedTextState.text === 'string' ? preparedTextState.text : '';
    const font = preparedTextState.font || options.font || '18px "Courier New", monospace';
    const whiteSpace = preparedTextState.whiteSpace || options.whiteSpace || 'pre-wrap';
    const lineHeight = Number(options.lineHeight) || 20;
    const maxWidth = Number(options.maxWidth) || 0;
    const prepared = preparedTextState.prepared;
    const layout = pretextApi.layoutWithLines(prepared, maxWidth, lineHeight);

    return {
        ...layout,
        font,
        lineHeight,
        maxWidth,
        whiteSpace,
        lines: Array.isArray(layout.lines)
            ? layout.lines.map(line => {
                const startOffset = preparedTextState.resolveOffset(line.start);
                const endOffset = preparedTextState.resolveOffset(line.end);
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

export function layoutPreparedTerminalEditorialText(pretextApi, preparedTextState, options = {}) {
    assertTerminalEditorialApi(pretextApi);

    if (!preparedTextState || typeof preparedTextState !== 'object') {
        throw new Error('prepared terminal text state is required');
    }

    const tokens = Array.isArray(preparedTextState.tokens) ? preparedTextState.tokens : [];
    const text = typeof preparedTextState.text === 'string' ? preparedTextState.text : '';
    const font = preparedTextState.font || options.font || '18px "Courier New", monospace';
    const whiteSpace = preparedTextState.whiteSpace || options.whiteSpace || 'pre-wrap';
    const lineHeight = Math.max(1, Number(options.lineHeight) || 20);
    const maxWidth = Math.max(0, Number(options.maxWidth) || 0);
    const minSegmentWidth = Math.min(maxWidth, Math.max(24, Number(options.minSegmentWidth) || Math.min(72, Math.max(32, Math.round(maxWidth * 0.18)))));
    const obstacleRects = Array.isArray(options.obstacles)
        ? options.obstacles
            .map(rect => {
                const x = Number(rect?.x) || 0;
                const y = Number(rect?.y) || 0;
                const left = clampNumber(x, 0, maxWidth);
                return {
                    x: left,
                    y: Math.max(0, y),
                    width: clampNumber(x + (Number(rect?.width) || 0), 0, maxWidth) - left,
                    height: Math.max(0, (Number(rect?.height) || 0) + Math.min(0, y))
                };
            })
            .filter(rect => rect.width > 0 && rect.height > 0)
        : [];

    const prepared = preparedTextState.prepared;
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

            const startOffset = preparedTextState.resolveOffset(line.start);
            const endOffset = preparedTextState.resolveOffset(line.end);
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

export function buildTerminalPretextLayout(pretextApi, options = {}) {
    const preparedTextState = prepareTerminalText(pretextApi, options);
    return layoutPreparedTerminalText(pretextApi, preparedTextState, options);
}

export function buildTerminalEditorialLayout(pretextApi, options = {}) {
    const preparedTextState = prepareTerminalText(pretextApi, options);
    return layoutPreparedTerminalEditorialText(pretextApi, preparedTextState, options);
}
