import { createHash } from 'node:crypto';

const SOURCES = Object.freeze({
    'chenglou/pretext': 'src/pretext-browser.mjs',
    'cloudflare/workers-sdk': 'worker/',
    'microsoft/playwright': 'tests/',
    'actions/deploy-pages': '.github/workflows/pages.yml',
    'pbakaus/impeccable': 'DESIGN.md',
});
const HISTORY_LIMIT = 500;
const MAX_BYTES = 1024 * 1024;

async function readRelease(repo, fetchRelease) {
    const response = await fetchRelease('https://api.github.com/repos/' + repo + '/releases/latest', {
        redirect: 'error',
        headers: { Accept: 'application/vnd.github+json' },
        signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok || !response.body) throw new Error('Release source unavailable');

    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
        size += chunk.byteLength;
        if (size > MAX_BYTES) throw new Error('Release response exceeds size limit');
        chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export async function collectReleases({
    now, history = [], repos = Object.keys(SOURCES), fetchRelease = fetch,
}) {
    if (!Array.isArray(history) || history.length > HISTORY_LIMIT
        || !history.every(hash => typeof hash === 'string' && /^[a-f0-9]{64}$/.test(hash))) {
        throw new Error('Invalid release history');
    }
    if (!Number.isFinite(Date.parse(now)) || new Set(repos).size !== repos.length
        || !repos.every(repo => Object.hasOwn(SOURCES, repo))) throw new Error('Invalid source configuration');

    const findings = [];
    const unavailable = [];
    const seen = new Set(history);
    for (const repo of repos) {
        try {
            const { id, published_at: publishedAt, tag_name: tag } = await readRelease(repo, fetchRelease);
            const supportedTag = typeof tag === 'string' && (
                /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(tag)
                || (repo === 'cloudflare/workers-sdk' && /^wrangler@[0-9][A-Za-z0-9._-]{0,89}$/.test(tag))
            );
            if (!Number.isSafeInteger(id) || id <= 0 || !supportedTag
                || typeof publishedAt !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(publishedAt)
                || !(Date.parse(publishedAt) <= Date.parse(now))) throw new Error('Invalid release metadata');

            const findingId = repo + ':' + id;
            const hash = createHash('sha256').update(JSON.stringify([findingId, publishedAt, tag])).digest('hex');
            if (seen.has(hash)) continue;
            seen.add(hash);
            findings.push({
                id: findingId, hash, publishedAt, retrievedAt: now,
                source: 'https://github.com/' + repo + '/releases/tag/' + encodeURIComponent(tag),
                summary: repo + ' published ' + tag,
                module: SOURCES[repo],
                recommendedAction: 'Review release notes and compare against the installed version.',
            });
        } catch {
            unavailable.push(repo);
        }
    }
    return { history: [...seen].slice(-HISTORY_LIMIT), findings, unavailable };
}
