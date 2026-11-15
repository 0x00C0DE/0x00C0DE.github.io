export function pageText(items, number) {
    const lines = [];
    for (const item of items) {
        if (!item.str?.trim()) continue;
        const y = item.transform[5];
        const previous = lines.at(-1);
        if (previous && Math.abs(previous.y - y) < 1) previous.text += item.str;
        else lines.push({ text: item.str, y });
    }
    let offset = 0;
    for (const line of lines) {
        line.text = line.text.trim().replace(/\s+/g, ' ');
        line.start = offset;
        offset += line.text.length + 1;
    }
    return { number, lines, text: lines.map(line => line.text).join(' ') };
}

export function findPassages(pages, query) {
    const needle = query.trim().replace(/\s+/g, ' ').toLowerCase();
    if (!needle) return [];
    const matches = [];
    for (const page of pages) {
        const text = page.text.toLowerCase();
        let start = text.indexOf(needle);
        while (start !== -1) {
            const end = start + needle.length;
            const from = page.lines.findIndex(line => line.start + line.text.length > start);
            const to = page.lines.findLastIndex(line => line.start < end);
            matches.push({ page, start, end, from, to });
            start = text.indexOf(needle, end);
        }
    }
    return matches;
}
