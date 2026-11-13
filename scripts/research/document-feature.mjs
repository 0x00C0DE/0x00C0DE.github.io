import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const entries = new Map([
    ['blog-feed', {
        present: /\/content\/feed\.xml\b/i,
        bullet: '- [Blog Atom feed](https://0x00c0de.github.io/content/feed.xml) subscribes readers to recent public blog entries.',
    }],
    ['sitemap', {
        present: /\/sitemap\.xml\b/i,
        bullet: '- [Sitemap](https://0x00c0de.github.io/sitemap.xml) lists public portfolio and project routes for search engines.',
    }],
]);

export function documentFeature(readme, feature) {
    const entry = entries.get(feature);
    if (!entry) throw new Error('Missing README documentation for feature: ' + feature);
    if (entry.present.test(readme)) return readme;
    const heading = /^## Scheduled research preflight[ \t]*\r?$/m.exec(readme);
    if (!heading) throw new Error('Missing README scheduled research section');
    const eol = readme.includes('\r\n') ? '\r\n' : '\n';
    const start = heading.index + heading[0].length;
    const following = /^## /m.exec(readme.slice(start));
    const end = following ? start + following.index : readme.length;
    const section = readme.slice(start, end);
    const contentEnd = start + section.trimEnd().length;
    const separator = /(?:^|\r?\n)- [^\r\n]+$/.test(section.trimEnd()) ? eol : eol + eol;
    return readme.slice(0, contentEnd) + separator + entry.bullet
        + (readme.slice(contentEnd) || eol);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const path = new URL('../../README.md', import.meta.url);
    const current = await readFile(path, 'utf8');
    const updated = process.argv.slice(2).reduce(documentFeature, current);
    if (updated !== current) await writeFile(path, updated);
}
