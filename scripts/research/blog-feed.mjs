import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { createReadStream } from 'node:fs';

export const feedLink = '<link rel="alternate" type="application/atom+xml" title="0x00C0DE Blog" href="/content/feed.xml">';
const site = 'https://0x00c0de.github.io';
const timestampLine = /^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\]$/;
const attachmentLine = /^\[image-(base64|z85|url)\]$/;

export function activateFeed(html, report, revision) {
    if (!revision || report?.revision !== revision || !Array.isArray(report.featureCandidates)
        || !report.featureCandidates.some(candidate => candidate?.id === 'public-blog-feed')
        || /application\/(rss|atom)\+xml/i.test(html)) return html;
    return html.replace(/<\/head>/i, '    ' + feedLink + '\n</head>');
}

function xml(text) {
    const escapes = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
    return text.replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '')
        .replace(/[&<>"']/g, character => escapes[character]);
}

function* linesFromText(text) {
    yield* text.split(/\r?\n/);
}

async function parseFeed(lines) {
    const entries = new Map();
    let current;
    let closing;
    for await (const line of lines) {
        if (closing) {
            if (line === closing) closing = undefined;
            continue;
        }
        const timestamp = timestampLine.exec(line)?.[1];
        if (timestamp && Number.isFinite(Date.parse(timestamp))) {
            current = { timestamp, text: '' };
            entries.set(timestamp, current);
            if (entries.size > 20) entries.delete(entries.keys().next().value);
            continue;
        }
        const attachment = attachmentLine.exec(line)?.[1];
        if (attachment) {
            closing = '[/image-' + attachment + ']';
            continue;
        }
        if (current && current.text.length < 2000) {
            current.text += (line.replace(/^\[text-escaped\]/, '') + '\n').slice(0, 2000 - current.text.length);
        }
    }
    return [...entries.values()].sort((left, right) => Date.parse(right.timestamp) - Date.parse(left.timestamp));
}

function serialize(entries) {
    const items = entries.map(({ timestamp, text }) => {
        const summary = text.trim();
        const title = summary.split('\n')[0].slice(0, 100) || 'Blog entry';
        return '  <entry><id>' + site + '/content/blog.txt#' + timestamp + '</id><title>' + xml(title)
            + '</title><updated>' + timestamp + '</updated><link href="' + site
            + '/content/blog.txt"/><summary type="text">' + xml(summary) + '</summary></entry>';
    });
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<feed xmlns="http://www.w3.org/2005/Atom">',
        '  <id>' + site + '/content/feed.xml</id>',
        '  <title>0x00C0DE Blog</title>',
        '  <link rel="self" href="' + site + '/content/feed.xml"/>',
        '  <link href="' + site + '/content/blog.txt"/>',
        '  <updated>' + (entries[0]?.timestamp ?? '1970-01-01T00:00:00Z') + '</updated>',
        '  <author><name>0x00C0DE</name></author>',
        ...items,
        '</feed>',
        '',
    ].join('\n');
}

export async function renderFeed(text) {
    return serialize(await parseFeed(linesFromText(text)));
}

export async function renderFeedFile(path) {
    const input = createReadStream(path, { encoding: 'utf8' });
    try {
        return serialize(await parseFeed(createInterface({ input, crlfDelay: Infinity })));
    } finally {
        input.destroy();
    }
}

export async function readActivation(reportPath, homePath, revision) {
    const [html, report] = await Promise.all([readFile(homePath, 'utf8'), readFile(reportPath, 'utf8')]);
    return activateFeed(html, JSON.parse(report), revision);
}
