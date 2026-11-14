const windows = ['daily', 'weekly', 'monthly'];
const rules = [
    [/\b(?:sitemaps?|search engine optimization|web indexing)\b/i, 'sitemap.xml',
        'Help search engines discover the portfolio routes with a generated sitemap.',
        'Validate sitemap XML and check the deployed project index URL.'],
    [/\b(?:keyboard navigation|accessibility|screen readers?)\b/i, 'index.html',
        'Evaluate keyboard and screen-reader access to terminal commands.',
        'Verify focus order and command entry with keyboard-only browser tests.'],
    [/\b(?:charts?|data visualization|time.series visualization)\b/i, 'pages/bitcoin.html',
        'Evaluate chart inspection or rendering techniques on the existing Bitcoin workspace.',
        'Compare keyboard and touch inspection against existing chart behavior.'],
    [/\b(?:canvas|text layout|word wrapping)\b/i, 'src/terminal-canvas-core.mjs',
        'Evaluate text wrapping or rendering improvements for the Canvas terminal.',
        'Compare wrapping and frame time at desktop and mobile widths.'],
    [/\b(?:static site search|full.text search|client.side search)\b/i, 'pages/projects.html',
        'Evaluate client-side filtering for portfolio projects and descriptions.',
        'Verify direct links, keyboard filtering, and empty search results.'],
    [/\b(?:web best practices|web platform guidance)\b/i, 'pages/projects.html',
        'Evaluate native navigation for the canvas project index.',
        'Verify that keyboard users can reach and open pinned project links.',
        'native-project-navigation'],
    [/\b(?:rss|atom feed|feed reader)\b/i, 'content/feed.xml',
        'Compare subscription and reader compatibility with the existing Atom feed.',
        'Identify a concrete reader failure or missing capability before proposing a change.'],
];

const readmeLimit = 32_000;
const readmeBatchSize = 8;

async function fetchReadme(name, fetchPage) {
    const base = 'https://raw.githubusercontent.com/' + name + '/HEAD/';
    const options = { redirect: 'error', signal: AbortSignal.timeout(12_000) };
    try {
        let response = await fetchPage(new URL('README.md', base), options);
        for (const directory of ['.github/', 'docs/']) {
            if (response.status !== 404) break;
            await response.body?.cancel();
            response = await fetchPage(new URL(directory + 'README.md', base), options);
        }
        if (!response.ok || !response.body) {
            await response.body?.cancel();
            return { status: 'unavailable' };
        }
        const chunks = [];
        let remaining = readmeLimit;
        let truncated = false;
        for await (const chunk of response.body) {
            chunks.push(chunk.subarray(0, remaining));
            if (chunk.byteLength > remaining) {
                truncated = true;
                break;
            }
            remaining -= chunk.byteLength;
        }
        const text = Buffer.concat(chunks).toString('utf8').trim();
        return text ? { status: truncated ? 'truncated' : 'available', text } : { status: 'unavailable' };
    } catch {
        return { status: 'unavailable' };
    }
}

async function fetchTrending(window, fetchPage) {
    const url = new URL('https://github.com/trending');
    url.searchParams.set('since', window);
    const response = await fetchPage(url, { redirect: 'error', signal: AbortSignal.timeout(12_000) });
    if (!response.ok || !response.body) throw new Error('Trending unavailable');
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body) {
        bytes += chunk.byteLength;
        if (bytes > 2_000_000) throw new Error('Trending response exceeded size limit');
        chunks.push(chunk);
    }
    const html = Buffer.concat(chunks).toString('utf8');
    const repositories = [];
    for (const [, article] of html.matchAll(/<article\b[^>]*class="[^"]*\bBox-row\b[^"]*"[^>]*>([\s\S]*?)<\/article>/gi)) {
        const heading = /<h2\b[^>]*>([\s\S]*?)<\/h2>/i.exec(article)?.[1] ?? '';
        const name = /<a\s[^>]*\bhref="\/([a-z0-9-]{1,39}\/[a-z0-9_.-]{1,100})"/i.exec(heading)?.[1];
        if (!name || /\/\.{1,2}$/.test(name)) continue;
        const description = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(article)?.[1]
            ?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').slice(0, 500) ?? '';
        const rule = rules.find(([pattern]) => pattern.test(description));
        const fit = rule ? { surface: rule[1], use: rule[2], verification: rule[3] } : null;
        if (rule?.[4]) fit.capability = rule[4];
        repositories.push({ name, description: description.trim(), fit });
    }
    if (!repositories.length) throw new Error('Trending repository markup missing');
    return repositories;
}

export async function discoverTrending(fetchPage = fetch) {
    const results = await Promise.allSettled(windows.map(window => fetchTrending(window, fetchPage)));
    const byName = new Map();
    const unavailable = [];
    results.forEach((result, index) => {
        const window = windows[index];
        if (result.status === 'rejected') {
            unavailable.push(window);
            return;
        }
        result.value.forEach(({ name, description, fit }, rank) => {
            const key = name.toLowerCase();
            if (!byName.has(key)) byName.set(key, { name, description, fit, ranks: {} });
            byName.get(key).ranks[window] ??= rank + 1;
        });
    });
    const repositories = [...byName.values()];
    for (let offset = 0; offset < repositories.length; offset += readmeBatchSize) {
        await Promise.all(repositories.slice(offset, offset + readmeBatchSize).map(async repo => {
            repo.readme = await fetchReadme(repo.name, fetchPage);
        }));
    }
    return { repositories, unavailable };
}
