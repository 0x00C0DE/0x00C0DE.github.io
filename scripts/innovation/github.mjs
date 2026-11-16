const origin = 'https://api.github.com';
export const validName = /^[a-z0-9][a-z0-9-]{0,38}\/(?!\.{1,2}$)[\w.-]{1,100}$/i;
export const validTopic = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function githubClient({ requests, token, fetcher = fetch, signal }) {
    let remaining = requests;
    let limited = false;

    async function get(path) {
        if (limited) throw new Error('GitHub rate limit reached');
        if (remaining <= 0) throw new Error('GitHub request budget exhausted');
        remaining--;
        const timeout = AbortSignal.timeout(8000);
        const response = await fetcher(new URL(path, origin), {
            redirect: 'error',
            signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
            headers: {
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                ...(token && { Authorization: 'Bearer ' + token }),
            },
        });
        limited = response.status === 429 || response.headers.has('retry-after')
            || response.headers.get('x-ratelimit-remaining') === '0';
        if (!response.ok) {
            await response.body?.cancel();
            throw new Error(limited ? 'GitHub rate limit reached' : 'GitHub HTTP ' + response.status);
        }
        const chunks = [];
        let bytes = 0;
        for await (const chunk of response.body ?? []) {
            bytes += chunk.length;
            if (bytes > 1_500_000) throw new Error('GitHub response exceeded size limit');
            chunks.push(chunk);
        }
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    }

    function metadata(item) {
        if (!item || !validName.test(item.full_name ?? '') || item.private || item.disabled || item.archived) return null;
        return {
            name: item.full_name,
            providerId: Number.isSafeInteger(item.id) ? item.id : null,
            description: typeof item.description === 'string' ? item.description.slice(0, 400) : '',
            revision: item.pushed_at,
            stars: Number.isSafeInteger(item.stargazers_count) ? item.stargazers_count : null,
            license: item.license?.spdx_id ?? null,
            language: item.language ?? null,
            topics: (Array.isArray(item.topics) ? item.topics : []).filter(topic =>
                typeof topic === 'string' && topic.length <= 50 && validTopic.test(topic)).slice(0, 20),
        };
    }

    return {
        async search(query) {
            const params = new URLSearchParams({ q: query, per_page: '12', sort: 'updated' });
            const result = await get('/search/repositories?' + params);
            if (!Array.isArray(result.items)) throw new Error('Invalid GitHub search response');
            return result.items.map(metadata).filter(Boolean);
        },
        async inspect(name) {
            if (!validName.test(name) || name.split('/').some(segment => /^\.\.?$/.test(segment))) {
                throw new Error('Invalid repository name');
            }
            const result = await get('/repos/' + name + '/readme');
            return decodeEvidence(result);
        },
        async inspectSource(name) {
            if (!validName.test(name)) return null;
            for (const path of ['package.json', 'Cargo.toml', 'pyproject.toml']) {
                try {
                    return decodeEvidence(await get('/repos/' + name + '/contents/' + path));
                } catch (error) {
                    if (error.message !== 'GitHub HTTP 404') throw error;
                }
            }
            return null;
        },
        async metadata(name) {
            if (!validName.test(name)) return null;
            return metadata(await get('/repos/' + name));
        },
    };
}

function decodeEvidence(result) {
    if (result.encoding !== 'base64' || typeof result.content !== 'string') {
        throw new Error('GitHub document has no inline content');
    }
    return { path: String(result.path ?? 'README.md').slice(0, 180),
        text: Buffer.from(result.content, 'base64').subarray(0, 8000).toString('utf8') };
}
