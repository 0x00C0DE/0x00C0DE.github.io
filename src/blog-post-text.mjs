const UNSUPPORTED_TEXT = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069\uD800-\uDFFF]/u;

export function normalizeBlogPostText(value, maximumLength, { multiline = false } = {}) {
    if (typeof value !== 'string') return { error: 'text must be a string' };
    if (!Number.isSafeInteger(maximumLength) || maximumLength < 0 || value.length > maximumLength) {
        return { error: 'text exceeds the allowed length' };
    }
    if (UNSUPPORTED_TEXT.test(value)) return { error: 'text contains unsupported control characters' };
    const text = multiline ? value.replace(/\r\n?/g, '\n').trim() : value.replace(/\s+/g, ' ').trim();
    return { text };
}

export function normalizeBlogPostTextBlocks(blocks, maximumLength) {
    const normalized = [];
    let remaining = maximumLength;
    for (const block of blocks) {
        if (block?.type !== 'text') {
            normalized.push(block);
            continue;
        }
        const result = normalizeBlogPostText(block.text, remaining);
        if (result.error) return result;
        remaining -= block.text.length;
        if (result.text) normalized.push({ type: 'text', text: result.text });
    }
    return { blocks: normalized };
}

export function encodeBlogTextLine(line) {
    const trimmed = line.trim();
    return /^(?:\[\/?image-(?:base64|z85|url)\])$/i.test(trimmed)
        || line.startsWith('[text-escaped]')
        || /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z]$/.test(trimmed)
        ? '[text-escaped]' + line
        : line;
}
