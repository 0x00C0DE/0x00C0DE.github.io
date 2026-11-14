const TERMINAL_LINK_PATTERN = /\bhttps?:\/\/[^\s<]+|\bproject-[a-z0-9-]+\.html\b|\bprojects\.html\b|\bresume-intro\.html\b|\bresume\.pdf\b|\b[A-Za-z0-9-]+\.txt\b/gi;

// Map a bare terminal filename onto the reorganized site layout (pages in
// /pages, downloadable assets in /assets). Site is served from the domain
// root, so absolute paths resolve correctly from any page.
function resolveTerminalFileHref(name) {
    if (/\.pdf$/i.test(name)) {
        return `/assets/${name}`;
    }
    if (/\.html$/i.test(name)) {
        return `/pages/${name}`;
    }
    return name;
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
        href: resolveTerminalFileHref(tokenText),
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


const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export function measureTerminalText(tokens, measure) {
    return tokens.flatMap(fragment => (fragment.text.match(/\r\n|[\r\n]|[^\S\r\n]+|[^\s]+/gu) || []).map(text => ({
        fragment,
        newline: /^[\r\n]/.test(text),
        text,
        width: /^[\r\n]/.test(text) ? 0 : measure(text)
    })));
}

function availableSegments(width, y, lineHeight, obstacles, minimum) {
    const occupied = obstacles.filter(rect => rect.y < y + lineHeight && rect.y + rect.height > y)
        .sort((a, b) => a.x - b.x);
    const segments = [];
    let left = 0;
    for (const rect of occupied) {
        const right = Math.min(width, rect.x);
        if (right - left >= minimum) {
            segments.push({ x: left, width: right - left });
        }
        left = Math.max(left, rect.x + rect.width);
    }
    if (width - left >= minimum) {
        segments.push({ x: left, width: width - left });
    }
    return segments;
}

export function layoutTerminalText(pieces, { width, lineHeight, obstacles = [], minSegmentWidth = 1, measure }) {
    const lines = [];
    const minimum = Math.min(width, minSegmentWidth);
    let index = 0;
    let offset = 0;
    let y = 0;
    let trailingNewline = false;

    while (index < pieces.length) {
        const segments = availableSegments(width, y, lineHeight, obstacles, minimum);
        for (const segment of segments) {
            const plans = [];
            let used = 0;
            trailingNewline = false;
            while (index < pieces.length) {
                const piece = pieces[index];
                if (piece.newline) {
                    index += 1;
                    trailingNewline = true;
                    break;
                }

                let text = piece.text.slice(offset);
                let measured = offset ? measure(text) : piece.width;
                if (measured > segment.width - used) {
                    if (plans.length) break;
                    // Keep a word intact if it fits on an unobstructed row.
                    if (segment.width < width && measured <= width) break;
                    let end = 0;
                    for (const part of graphemes.segment(text)) {
                        const next = part.index + part.segment.length;
                        if (end && measure(text.slice(0, next)) > segment.width) break;
                        if (!end && segment.width < width && measure(part.segment) > segment.width) break;
                        end = next;
                    }
                    if (!end) break;
                    text = text.slice(0, end);
                    measured = measure(text);
                }

                const previous = plans.at(-1);
                if (previous?.fragment === piece.fragment) {
                    previous.text += text;
                    previous.width += measured;
                } else {
                    plans.push({ fragment: piece.fragment, text, width: measured, x: used });
                }
                used += measured;
                offset += text.length;
                if (offset === piece.text.length) {
                    index += 1;
                    offset = 0;
                } else {
                    break;
                }
            }

            if (plans.length || trailingNewline) lines.push({ x: segment.x, y, plans });
            if (trailingNewline || index === pieces.length) break;
        }
        y += lineHeight;
    }

    if (trailingNewline || !lines.length) lines.push({ x: 0, y, plans: [] });
    return lines;
}
