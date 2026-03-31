export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders(env.ALLOWED_ORIGIN)
            });
        }

        if (request.method === 'GET' && url.pathname === '/api/blog/health') {
            return jsonResponse({ ok: true }, 200, env.ALLOWED_ORIGIN);
        }

        if (request.method === 'POST' && url.pathname === '/api/blog/append') {
            return handleAppend(request, env);
        }

        return jsonResponse({ error: 'not found' }, 404, env.ALLOWED_ORIGIN);
    }
};

async function handleAppend(request, env) {
    try {
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const rateCheck = await enforceRateLimit(ip, env);
        if (!rateCheck.allowed) {
            return jsonResponse({ error: 'rate limit exceeded' }, 429, env.ALLOWED_ORIGIN, rateCheck.headers);
        }

        const body = await request.json().catch(() => null);
        const text = typeof body?.text === 'string' ? body.text.trim() : '';
        const turnstileToken = typeof body?.turnstileToken === 'string' ? body.turnstileToken : '';
        const maxPostLength = Number(env.MAX_POST_LENGTH || 500);

        if (!text) {
            return jsonResponse({ error: 'text is required' }, 400, env.ALLOWED_ORIGIN, rateCheck.headers);
        }
        if (text.length > maxPostLength) {
            return jsonResponse({ error: `text must be ${maxPostLength} characters or fewer` }, 400, env.ALLOWED_ORIGIN, rateCheck.headers);
        }
        if (containsControlCharacters(text)) {
            return jsonResponse({ error: 'text contains unsupported control characters' }, 400, env.ALLOWED_ORIGIN, rateCheck.headers);
        }

        if (env.TURNSTILE_SECRET_KEY) {
            const verified = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, turnstileToken, ip);
            if (!verified) {
                return jsonResponse({ error: 'turnstile verification failed' }, 400, env.ALLOWED_ORIGIN, rateCheck.headers);
            }
        }

        const githubFile = await fetchGithubFile(env);
        const nextContent = appendBlogEntry(githubFile.content, text);
        const commit = await updateGithubFile(env, nextContent, githubFile.sha);

        return jsonResponse({
            ok: true,
            commitSha: commit.sha,
            commitUrl: `https://github.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/commit/${commit.sha}`
        }, 201, env.ALLOWED_ORIGIN, rateCheck.headers);
    } catch (error) {
        console.error('append failed', error);
        return jsonResponse({ error: 'failed to append blog entry' }, 500, env.ALLOWED_ORIGIN);
    }
}

function containsControlCharacters(value) {
    return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);
}

async function verifyTurnstile(secret, token, ip) {
    if (!token) {
        return false;
    }

    const body = new URLSearchParams({
        secret,
        response: token,
        remoteip: ip || ''
    });

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body
    });

    if (!response.ok) {
        return false;
    }

    const payload = await response.json();
    return Boolean(payload.success);
}

async function enforceRateLimit(ip, env) {
    const windowMs = Number(env.RATE_LIMIT_WINDOW_MS || 3600000);
    const max = Number(env.RATE_LIMIT_MAX || 10);
    const now = Date.now();
    const bucket = Math.floor(now / windowMs);
    const key = `rate:${ip}:${bucket}`;
    const store = getInMemoryStore();
    const entry = store.get(key) || { count: 0, expiresAt: now + windowMs };

    entry.count += 1;
    store.set(key, entry);

    for (const [storeKey, value] of store.entries()) {
        if (value.expiresAt <= now) {
            store.delete(storeKey);
        }
    }

    return {
        allowed: entry.count <= max,
        headers: {
            'X-RateLimit-Limit': String(max),
            'X-RateLimit-Remaining': String(Math.max(0, max - entry.count)),
            'X-RateLimit-Reset': String(entry.expiresAt)
        }
    };
}

function getInMemoryStore() {
    const globalScope = globalThis;
    if (!globalScope.__BLOG_RATE_LIMITS__) {
        globalScope.__BLOG_RATE_LIMITS__ = new Map();
    }
    return globalScope.__BLOG_RATE_LIMITS__;
}

async function fetchGithubFile(env) {
    const response = await fetch(githubContentsUrl(env), {
        headers: githubHeaders(env)
    });

    if (!response.ok) {
        throw new Error(`github fetch failed with ${response.status}`);
    }

    const payload = await response.json();
    return {
        sha: payload.sha,
        content: decodeBase64(payload.content)
    };
}

async function updateGithubFile(env, content, sha) {
    const response = await fetch(githubContentsUrl(env), {
        method: 'PUT',
        headers: {
            ...githubHeaders(env),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: 'Append blog entry via terminal site',
            content: encodeBase64(content),
            sha,
            branch: env.GITHUB_BRANCH || 'main'
        })
    });

    if (!response.ok) {
        const failureBody = await response.text();
        throw new Error(`github update failed with ${response.status}: ${failureBody}`);
    }

    const payload = await response.json();
    return payload.commit;
}

function appendBlogEntry(currentContent, text) {
    const normalized = currentContent.endsWith('\n') ? currentContent : `${currentContent}\n`;
    const timestamp = new Date().toISOString();
    return `${normalized}\n[${timestamp}]\n${text}\n`;
}

function githubContentsUrl(env) {
    const owner = env.GITHUB_OWNER;
    const repo = env.GITHUB_REPO;
    const path = env.GITHUB_BLOG_PATH || 'BLOG.txt';
    const branch = env.GITHUB_BRANCH || 'main';
    return `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
}

function githubHeaders(env) {
    return {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${env.GITHUB_PAT}`,
        'User-Agent': '0x00C0DE-blog-worker',
        'X-GitHub-Api-Version': '2022-11-28'
    };
}

function jsonResponse(payload, status, origin, extraHeaders = {}) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...corsHeaders(origin),
            ...extraHeaders
        }
    });
}

function corsHeaders(origin) {
    return {
        'Access-Control-Allow-Origin': origin || '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    };
}

function decodeBase64(value) {
    return decodeURIComponent(escape(atob(value.replace(/\n/g, ''))));
}

function encodeBase64(value) {
    return btoa(unescape(encodeURIComponent(value)));
}
