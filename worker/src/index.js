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

        if (request.method === 'GET' && url.pathname === '/api/visitors') {
            return handleVisitorCount(env);
        }

        if (request.method === 'POST' && url.pathname === '/api/visitors/track') {
            return handleVisitorTrack(request, env);
        }

        if (request.method === 'POST' && url.pathname === '/api/visitors/leave') {
            return handleVisitorLeave(request, env);
        }

        if (request.method === 'POST' && url.pathname === '/api/blog/append') {
            return handleAppend(request, env);
        }

        if (request.method === 'POST' && url.pathname === '/api/blog/delete-image') {
            return handleDeleteImage(request, env);
        }

        return jsonResponse({ error: 'not found' }, 404, env.ALLOWED_ORIGIN);
    }
};

export class VisitorCounter {
    constructor(state) {
        this.state = state;
        this.snapshot = null;
        this.loaded = false;
        this.loadingPromise = null;
        this.lastSnapshotFlushAt = 0;
        this.knownVisitorsCache = new Set();
    }

    async fetch(request) {
        const url = new URL(request.url);

        if (request.method === 'GET' && url.pathname === '/count') {
            return this.jsonSuccessResponse(await this.getCountResponse());
        }

        if (request.method === 'POST' && url.pathname === '/track') {
            const body = await request.json().catch(() => null);
            const visitorId = sanitizeVisitorId(body?.visitorId);
            const visitId = sanitizeVisitId(body?.visitId);
            const action = body?.action === 'visit' ? 'visit' : 'heartbeat';

            if (!visitorId || !visitId) {
                return this.jsonErrorResponse('visitorId and visitId are required', 400);
            }

            return this.jsonSuccessResponse(await this.trackVisitor(visitorId, visitId, action));
        }

        if (request.method === 'POST' && url.pathname === '/leave') {
            const body = await request.json().catch(() => null);
            const visitId = sanitizeVisitId(body?.visitId);

            if (!visitId) {
                return this.jsonErrorResponse('visitId is required', 400);
            }

            return this.jsonSuccessResponse(await this.removeVisit(visitId));
        }

        return this.jsonErrorResponse('not found', 404);
    }

    jsonSuccessResponse(stats) {
        return new Response(JSON.stringify({
            ok: true,
            ...stats
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            }
        });
    }

    jsonErrorResponse(error, status) {
        return new Response(JSON.stringify({ error }), {
            status,
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            }
        });
    }

    async getCountResponse() {
        await this.ensureSnapshotLoaded();
        this.pruneActiveSessionsInMemory();

        return {
            visits: this.snapshot.visits,
            uniqueVisitors: this.snapshot.uniqueVisitors,
            onSite: Object.keys(this.snapshot.activeSessions).length
        };
    }

    async trackVisitor(visitorId, visitId, action) {
        await this.ensureSnapshotLoaded();

        const now = Date.now();
        this.pruneActiveSessionsInMemory(now);

        let forceFlush = false;

        if (action === 'visit') {
            this.snapshot.visits += 1;
            forceFlush = true;
        }

        const visitorKey = `visitor:${visitorId}`;
        let alreadySeen = this.knownVisitorsCache.has(visitorId);

        if (!alreadySeen) {
            alreadySeen = Boolean(await this.state.storage.get(visitorKey));
            if (alreadySeen) {
                this.knownVisitorsCache.add(visitorId);
            }
        }

        if (!alreadySeen) {
            this.snapshot.uniqueVisitors += 1;
            this.knownVisitorsCache.add(visitorId);
            await this.state.storage.put(visitorKey, now);
            forceFlush = true;
        }

        const previousSeen = Number(this.snapshot.activeSessions[visitId] || 0);
        this.snapshot.activeSessions[visitId] = now;

        const shouldPersistHeartbeat =
            action === 'heartbeat' &&
            (previousSeen === 0 || now - previousSeen >= HEARTBEAT_PERSIST_INTERVAL_MS) &&
            now - this.lastSnapshotFlushAt >= MIN_SNAPSHOT_FLUSH_INTERVAL_MS;

        if (forceFlush || shouldPersistHeartbeat) {
            await this.flushSnapshot();
        }

        return {
            visits: this.snapshot.visits,
            uniqueVisitors: this.snapshot.uniqueVisitors,
            onSite: Object.keys(this.snapshot.activeSessions).length
        };
    }

    async removeVisit(visitId) {
        await this.ensureSnapshotLoaded();
        this.pruneActiveSessionsInMemory();

        if (this.snapshot.activeSessions[visitId]) {
            delete this.snapshot.activeSessions[visitId];
            await this.flushSnapshot();
        }

        return {
            visits: this.snapshot.visits,
            uniqueVisitors: this.snapshot.uniqueVisitors,
            onSite: Object.keys(this.snapshot.activeSessions).length
        };
    }

    async ensureSnapshotLoaded() {
        if (this.loaded && this.snapshot) {
            return;
        }

        if (this.loadingPromise) {
            await this.loadingPromise;
            return;
        }

        this.loadingPromise = (async () => {
            const snapshot = await this.state.storage.get('snapshot');
            if (snapshot && typeof snapshot === 'object') {
                this.snapshot = normalizeSnapshot(snapshot);
            } else {
                const legacy = await this.readLegacySnapshot();
                this.snapshot = normalizeSnapshot(legacy);
            }
            this.loaded = true;
        })();

        try {
            await this.loadingPromise;
        } finally {
            this.loadingPromise = null;
        }
    }

    async readLegacySnapshot() {
        const stored = await this.state.storage.get([
            'totalVisits',
            'totalUniqueVisitors',
            'totalVisitors',
            'activeSessions'
        ]);

        const legacyTotal = Number(readStoredValue(stored, 'totalVisitors') || 0);
        return {
            visits: Number(readStoredValue(stored, 'totalVisits') || legacyTotal),
            uniqueVisitors: Number(readStoredValue(stored, 'totalUniqueVisitors') || legacyTotal),
            activeSessions: readStoredValue(stored, 'activeSessions') || {}
        };
    }

    pruneActiveSessionsInMemory(now = Date.now()) {
        const nextSessions = {};

        for (const [visitId, lastSeen] of Object.entries(this.snapshot.activeSessions || {})) {
            if (Number(lastSeen) + VISITOR_ONSITE_WINDOW_MS > now) {
                nextSessions[visitId] = Number(lastSeen);
            }
        }

        this.snapshot.activeSessions = nextSessions;
    }

    async flushSnapshot() {
        await this.state.storage.put('snapshot', this.snapshot);
        this.lastSnapshotFlushAt = Date.now();
    }
}

export class RateLimiter {
    constructor(state) {
        this.state = state;
    }

    async fetch(request) {
        const url = new URL(request.url);

        if (request.method !== 'POST' || url.pathname !== '/consume') {
            return new Response(JSON.stringify({ error: 'not found' }), {
                status: 404,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        const body = await request.json().catch(() => null);
        const windowMs = Number(body?.windowMs || 3600000);
        const max = Number(body?.max || 10);
        const now = Date.now();
        const bucket = Math.floor(now / windowMs);
        const expiresAt = (bucket + 1) * windowMs;

        const stored = await this.state.storage.get(['bucket', 'count', 'expiresAt']);
        const activeBucket = Number(readStoredValue(stored, 'bucket'));
        let count = Number(readStoredValue(stored, 'count') || 0);

        if (activeBucket !== bucket) {
            count = 0;
        }

        count += 1;

        await this.state.storage.put({
            bucket,
            count,
            expiresAt
        });

        return new Response(JSON.stringify({
            allowed: count <= max,
            headers: {
                'X-RateLimit-Limit': String(max),
                'X-RateLimit-Remaining': String(Math.max(0, max - count)),
                'X-RateLimit-Reset': String(expiresAt)
            }
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json; charset=utf-8'
            }
        });
    }
}

// Keep the timeout comfortably above the persisted heartbeat cadence so
// active visitors do not disappear if the Durable Object is reloaded
// between storage flushes.
const VISITOR_ONSITE_WINDOW_MS = 8000;
const HEARTBEAT_PERSIST_INTERVAL_MS = 2000;
const MIN_SNAPSHOT_FLUSH_INTERVAL_MS = 1000;
const MAX_IMAGE_DATA_URL_LENGTH = 100000000;
const MAX_IMAGE_ATTACHMENTS = 4;
const ALLOWED_BLOG_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
const BLOG_DEPLOY_PENDING_ERROR = 'site is still deploying previous changes; wait for blog.txt to go live before posting or deleting again';

function normalizeSnapshot(snapshot) {
    return {
        visits: Number(snapshot?.visits || 0),
        uniqueVisitors: Number(snapshot?.uniqueVisitors || 0),
        activeSessions: snapshot?.activeSessions && typeof snapshot.activeSessions === 'object'
            ? snapshot.activeSessions
            : {}
    };
}

async function handleVisitorCount(env) {
    if (!env.VISITOR_COUNTER) {
        return jsonResponse({ error: 'visitor counter binding not configured' }, 500, env.ALLOWED_ORIGIN);
    }

    const stub = getVisitorCounterStub(env);
    const response = await stub.fetch('https://visitor-counter/count');
    return proxyJsonResponse(response, env.ALLOWED_ORIGIN);
}

async function handleVisitorTrack(request, env) {
    if (!env.VISITOR_COUNTER) {
        return jsonResponse({ error: 'visitor counter binding not configured' }, 500, env.ALLOWED_ORIGIN);
    }

    const body = await request.text();
    const stub = getVisitorCounterStub(env);
    const response = await stub.fetch('https://visitor-counter/track', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body
    });
    return proxyJsonResponse(response, env.ALLOWED_ORIGIN);
}

async function handleVisitorLeave(request, env) {
    if (!env.VISITOR_COUNTER) {
        return jsonResponse({ error: 'visitor counter binding not configured' }, 500, env.ALLOWED_ORIGIN);
    }

    const body = await request.text();
    const stub = getVisitorCounterStub(env);
    const response = await stub.fetch('https://visitor-counter/leave', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body
    });
    return proxyJsonResponse(response, env.ALLOWED_ORIGIN);
}

async function handleAppend(request, env) {
    try {
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const rateCheck = await enforceRateLimit(ip, env);
        if (!rateCheck.allowed) {
            return jsonResponse({ error: 'rate limit exceeded' }, 429, env.ALLOWED_ORIGIN, rateCheck.headers);
        }

        const body = await request.json().catch(() => null);
        const text = typeof body?.text === 'string' ? body.text.trim() : '';
        const imageDataUrl = typeof body?.imageDataUrl === 'string' ? body.imageDataUrl.trim() : '';
        const contentBlocks = Array.isArray(body?.contentBlocks) ? body.contentBlocks : null;
        const turnstileToken = typeof body?.turnstileToken === 'string' ? body.turnstileToken : '';
        const maxPostLength = Number(env.MAX_POST_LENGTH || 500);
        const maxImageDataUrlLength = Number(env.MAX_IMAGE_DATA_URL_LENGTH || MAX_IMAGE_DATA_URL_LENGTH);
        const normalizedBlocks = normalizeAppendContentBlocks({
            contentBlocks,
            text,
            imageDataUrl,
            maxPostLength,
            maxImageDataUrlLength
        });

        if (!normalizedBlocks.ok) {
            return jsonResponse({ error: normalizedBlocks.error }, 400, env.ALLOWED_ORIGIN, rateCheck.headers);
        }

        if (env.TURNSTILE_SECRET_KEY) {
            const verified = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, turnstileToken, ip);
            if (!verified) {
                return jsonResponse({ error: 'turnstile verification failed' }, 400, env.ALLOWED_ORIGIN, rateCheck.headers);
            }
        }

        const githubFile = await fetchGithubFile(env);
        const deploymentStatus = await ensurePublishedBlogIsCurrent(env, githubFile.content);
        if (!deploymentStatus.ok) {
            return jsonResponse({ error: deploymentStatus.error }, 409, env.ALLOWED_ORIGIN, rateCheck.headers);
        }

        const nextContent = appendBlogEntry(githubFile.content, normalizedBlocks.blocks);
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

async function handleDeleteImage(request, env) {
    try {
        const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
        const rateCheck = await enforceRateLimit(ip, env);
        if (!rateCheck.allowed) {
            return jsonResponse({ error: 'rate limit exceeded' }, 429, env.ALLOWED_ORIGIN, rateCheck.headers);
        }

        if (!env.BLOG_IMAGE_DELETE_PASSWORD) {
            return jsonResponse({ error: 'delete password is not configured' }, 500, env.ALLOWED_ORIGIN, rateCheck.headers);
        }

        const body = await request.json().catch(() => null);
        const password = typeof body?.password === 'string' ? body.password : '';
        const imageKey = typeof body?.imageKey === 'string' ? body.imageKey.trim() : '';
        const imageDataUrl = normalizeImageDataUrl(body?.imageDataUrl);
        const entryTimestamp = normalizeBlogEntryTimestamp(body?.entryTimestamp);
        const entryImageIndex = Number.isInteger(body?.entryImageIndex) ? body.entryImageIndex : Number.parseInt(body?.entryImageIndex, 10);
        const imageBlockIndex = Number.isInteger(body?.imageBlockIndex) ? body.imageBlockIndex : Number.parseInt(body?.imageBlockIndex, 10);
        const previousTextLine = typeof body?.previousTextLine === 'string' ? body.previousTextLine.trim() : '';
        const nextTextLine = typeof body?.nextTextLine === 'string' ? body.nextTextLine.trim() : '';

        if (!timingSafeStringEqual(password, env.BLOG_IMAGE_DELETE_PASSWORD)) {
            return jsonResponse({ error: 'invalid password' }, 403, env.ALLOWED_ORIGIN, rateCheck.headers);
        }

        if (
            (!Number.isInteger(imageBlockIndex) || imageBlockIndex < 0) &&
            !imageKey &&
            !imageDataUrl &&
            !entryTimestamp
        ) {
            return jsonResponse({ error: 'imageBlockIndex, imageKey, imageDataUrl, or entryTimestamp is required' }, 400, env.ALLOWED_ORIGIN, rateCheck.headers);
        }

        const githubFile = await fetchGithubFile(env);
        const deploymentStatus = await ensurePublishedBlogIsCurrent(env, githubFile.content);
        if (!deploymentStatus.ok) {
            return jsonResponse({ error: deploymentStatus.error }, 409, env.ALLOWED_ORIGIN, rateCheck.headers);
        }

        const removal = removeImageBlock(githubFile.content, {
            targetImageBlockIndex: Number.isInteger(imageBlockIndex) && imageBlockIndex >= 0 ? imageBlockIndex : null,
            targetImageKey: imageKey,
            targetImageDataUrl: imageDataUrl,
            targetEntryTimestamp: entryTimestamp,
            targetEntryImageIndex: Number.isInteger(entryImageIndex) && entryImageIndex >= 0 ? entryImageIndex : null,
            targetPreviousTextLine: previousTextLine,
            targetNextTextLine: nextTextLine
        });
        if (!removal.removed) {
            return jsonResponse({ error: 'image not found in blog.txt' }, 404, env.ALLOWED_ORIGIN, rateCheck.headers);
        }

        const commit = await updateGithubFile(
            env,
            removal.content,
            githubFile.sha,
            'Delete blog image via terminal site'
        );

        return jsonResponse({
            ok: true,
            commitSha: commit.sha,
            commitUrl: `https://github.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/commit/${commit.sha}`
        }, 200, env.ALLOWED_ORIGIN, rateCheck.headers);
    } catch (error) {
        console.error('delete image failed', error);
        return jsonResponse({ error: 'failed to delete blog image' }, 500, env.ALLOWED_ORIGIN);
    }
}

function containsControlCharacters(value) {
    return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value);
}

function validateImageDataUrl(value, maxLength) {
    const normalizedValue = normalizeImageDataUrl(value);
    if (!normalizedValue) {
        return {
            ok: false,
            error: 'imageDataUrl must be a valid base64 image data URL'
        };
    }

    if (normalizedValue.length > maxLength) {
        return {
            ok: false,
            error: `imageDataUrl must be ${maxLength} characters or fewer`
        };
    }

    const match = /^data:([^;]+);base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(normalizedValue);
    if (!match) {
        return {
            ok: false,
            error: 'imageDataUrl must be a valid base64 image data URL'
        };
    }

    const mimeType = match[1].toLowerCase();
    if (!ALLOWED_BLOG_IMAGE_MIME_TYPES.has(mimeType)) {
        return {
            ok: false,
            error: 'imageDataUrl must be png, jpg, jpeg, webp, or gif'
        };
    }

    return { ok: true };
}

function normalizeImageDataUrl(value) {
    const match = /^data:([^;]+);base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(String(value || '').trim());
    if (!match) {
        return '';
    }

    const mimeType = match[1].toLowerCase();
    const base64Payload = match[2].replace(/\s+/g, '');
    return `data:${mimeType};base64,${base64Payload}`;
}

export function createBlogImageKey(dataUrl) {
    const normalizedDataUrl = normalizeImageDataUrl(dataUrl);
    if (!normalizedDataUrl) {
        return '';
    }

    let hash = 2166136261;
    for (let index = 0; index < normalizedDataUrl.length; index += 1) {
        hash ^= normalizedDataUrl.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return `${normalizedDataUrl.length}:${(hash >>> 0).toString(16)}`;
}

function timingSafeStringEqual(left, right) {
    if (typeof left !== 'string' || typeof right !== 'string') {
        return false;
    }

    const encoder = new TextEncoder();
    const leftBytes = encoder.encode(left);
    const rightBytes = encoder.encode(right);
    const maxLength = Math.max(leftBytes.length, rightBytes.length);
    let mismatch = leftBytes.length ^ rightBytes.length;

    for (let index = 0; index < maxLength; index += 1) {
        mismatch |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
    }

    return mismatch === 0;
}

function normalizeAppendContentBlocks({ contentBlocks, text, imageDataUrl, maxPostLength, maxImageDataUrlLength }) {
    if (contentBlocks) {
        return validateContentBlocks(contentBlocks, maxPostLength, maxImageDataUrlLength);
    }

    const blocks = [];
    if (text) {
        blocks.push({ type: 'text', text });
    }
    if (imageDataUrl) {
        blocks.push({ type: 'image', imageDataUrl });
    }

    return validateContentBlocks(blocks, maxPostLength, maxImageDataUrlLength);
}

function validateContentBlocks(contentBlocks, maxPostLength, maxImageDataUrlLength) {
    if (!Array.isArray(contentBlocks) || contentBlocks.length === 0) {
        return {
            ok: false,
            error: 'text or imageDataUrl is required'
        };
    }

    const normalized = [];
    let totalTextLength = 0;
    let imageCount = 0;

    for (const block of contentBlocks) {
        if (!block || typeof block !== 'object') {
            return {
                ok: false,
                error: 'contentBlocks must contain valid objects'
            };
        }

        if (block.type === 'text') {
            const normalizedText = typeof block.text === 'string'
                ? block.text.replace(/\s+/g, ' ').trim()
                : '';

            if (!normalizedText) {
                continue;
            }

            totalTextLength += normalizedText.length;
            if (totalTextLength > maxPostLength) {
                return {
                    ok: false,
                    error: `text must be ${maxPostLength} characters or fewer`
                };
            }

            if (containsControlCharacters(normalizedText)) {
                return {
                    ok: false,
                    error: 'text contains unsupported control characters'
                };
            }

            normalized.push({
                type: 'text',
                text: normalizedText
            });
            continue;
        }

        if (block.type === 'image') {
            imageCount += 1;
            if (imageCount > MAX_IMAGE_ATTACHMENTS) {
                return {
                    ok: false,
                    error: `no more than ${MAX_IMAGE_ATTACHMENTS} images are allowed per entry`
                };
            }

            const imageValidation = validateImageDataUrl(String(block.imageDataUrl || '').trim(), maxImageDataUrlLength);
            if (!imageValidation.ok) {
                return {
                    ok: false,
                    error: imageValidation.error
                };
            }

            normalized.push({
                type: 'image',
                imageDataUrl: String(block.imageDataUrl || '').trim()
            });
            continue;
        }

        return {
            ok: false,
            error: 'contentBlocks contains an unsupported block type'
        };
    }

    if (normalized.length === 0) {
        return {
            ok: false,
            error: 'text or imageDataUrl is required'
        };
    }

    return {
        ok: true,
        blocks: normalized
    };
}

function sanitizeVisitorId(value) {
    if (typeof value !== 'string') {
        return '';
    }

    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 128) {
        return '';
    }

    return trimmed.replace(/[^a-zA-Z0-9:_-]/g, '');
}

function sanitizeVisitId(value) {
    if (typeof value !== 'string') {
        return '';
    }

    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 128) {
        return '';
    }

    return trimmed.replace(/[^a-zA-Z0-9:_-]/g, '');
}

function readStoredValue(stored, key) {
    if (stored && typeof stored.get === 'function') {
        return stored.get(key);
    }
    return stored ? stored[key] : undefined;
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
    if (!env.RATE_LIMITER) {
        throw new Error('rate limiter binding not configured');
    }

    const windowMs = Number(env.RATE_LIMIT_WINDOW_MS || 3600000);
    const max = Number(env.RATE_LIMIT_MAX || 10);
    const stub = getRateLimiterStub(env, ip);
    const response = await stub.fetch('https://rate-limiter/consume', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            windowMs,
            max
        })
    });

    if (!response.ok) {
        throw new Error(`rate limiter failed with ${response.status}`);
    }

    return response.json();
}

async function fetchGithubFile(env) {
    const response = await fetch(githubContentsUrl(env), {
        headers: githubHeaders(env)
    });

    if (!response.ok) {
        throw new Error(`github fetch failed with ${response.status}`);
    }

    const payload = await response.json();
    const payloadEncoding = typeof payload.encoding === 'string' ? payload.encoding.toLowerCase() : 'base64';
    if (typeof payload.content === 'string' && payload.content.trim() && payloadEncoding === 'base64') {
        return {
            sha: payload.sha,
            content: decodeBase64(payload.content)
        };
    }

    if (typeof payload.sha === 'string' && payload.sha) {
        const blobContent = await fetchGithubBlob(env, payload.sha);
        return {
            sha: payload.sha,
            content: blobContent
        };
    }

    throw new Error('github contents response did not include readable file content');
}

async function ensurePublishedBlogIsCurrent(env, githubContent) {
    const blogUrl = publishedBlogUrl(env);
    if (!blogUrl) {
        return { ok: true };
    }

    try {
        const response = await fetch(blogUrl, {
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        if (!response.ok) {
            return {
                ok: false,
                error: BLOG_DEPLOY_PENDING_ERROR
            };
        }

        const publishedContent = await response.text();
        return {
            ok: normalizeComparableBlogContent(publishedContent) === normalizeComparableBlogContent(githubContent),
            error: BLOG_DEPLOY_PENDING_ERROR
        };
    } catch (error) {
        console.warn('published blog verification failed', error);
        return {
            ok: false,
            error: BLOG_DEPLOY_PENDING_ERROR
        };
    }
}

async function fetchGithubBlob(env, sha) {
    const response = await fetch(githubBlobUrl(env, sha), {
        headers: githubHeaders(env)
    });

    if (!response.ok) {
        throw new Error(`github blob fetch failed with ${response.status}`);
    }

    const payload = await response.json();
    if (typeof payload.content !== 'string' || payload.encoding !== 'base64') {
        throw new Error('github blob response did not include base64 content');
    }

    return decodeBase64(payload.content);
}

async function updateGithubFile(env, content, sha, message = 'Append blog entry via terminal site') {
    const response = await fetch(githubContentsUrl(env), {
        method: 'PUT',
        headers: {
            ...githubHeaders(env),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message,
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

export function appendBlogEntry(currentContent, contentBlocks, timestamp = new Date().toISOString()) {
    const blogDocument = parseBlogDocument(currentContent);
    blogDocument.entries.push({
        timestampLine: toBlogEntryTimestampLine(timestamp),
        blocks: normalizeBlogEntryBlocks(contentBlocks)
    });
    return serializeBlogDocument(blogDocument);
}

export function removeImageBlock(currentContent, {
    targetImageBlockIndex = null,
    targetImageKey = '',
    targetImageDataUrl = '',
    targetEntryTimestamp = '',
    targetEntryImageIndex = null,
    targetPreviousTextLine = '',
    targetNextTextLine = ''
} = {}) {
    const blogDocument = parseBlogDocument(currentContent);
    const target = findImageBlockTarget(blogDocument.entries, {
        targetImageBlockIndex,
        targetImageKey,
        targetImageDataUrl,
        targetEntryTimestamp,
        targetEntryImageIndex,
        targetPreviousTextLine,
        targetNextTextLine
    });

    if (!target) {
        return {
            removed: false,
            content: currentContent
        };
    }

    blogDocument.entries[target.entryIndex].blocks.splice(target.blockIndex, 1);
    return {
        removed: true,
        content: serializeBlogDocument(blogDocument)
    };
}

function parseBlogDocument(currentContent) {
    const lines = String(currentContent || '').replace(/\r\n/g, '\n').split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }

    const introLines = [];
    const entries = [];
    let index = 0;

    while (index < lines.length && !isBlogEntryTimestampLine(lines[index])) {
        introLines.push(lines[index]);
        index += 1;
    }

    while (index < lines.length) {
        if (!isBlogEntryTimestampLine(lines[index])) {
            if (entries.length === 0) {
                introLines.push(lines[index]);
            } else {
                const lastEntry = entries[entries.length - 1];
                const lastBlock = lastEntry.blocks[lastEntry.blocks.length - 1];
                if (!lastBlock || lastBlock.type !== 'text') {
                    lastEntry.blocks.push({
                        type: 'text',
                        lines: [lines[index]]
                    });
                } else {
                    lastBlock.lines.push(lines[index]);
                }
            }
            index += 1;
            continue;
        }

        const timestampLine = normalizeBlogEntryTimestamp(lines[index]);
        index += 1;

        const entryLines = [];
        while (index < lines.length && !isBlogEntryTimestampLine(lines[index])) {
            entryLines.push(lines[index]);
            index += 1;
        }

        while (entryLines.length > 0 && entryLines[entryLines.length - 1] === '') {
            entryLines.pop();
        }

        entries.push({
            timestampLine,
            blocks: parseBlogEntryBlocks(entryLines)
        });
    }

    return {
        introLines,
        entries
    };
}

function parseBlogEntryBlocks(entryLines) {
    const blocks = [];
    let textLines = [];

    const flushTextLines = () => {
        if (textLines.length === 0) {
            return;
        }

        blocks.push({
            type: 'text',
            lines: textLines
        });
        textLines = [];
    };

    for (let index = 0; index < entryLines.length; index += 1) {
        const line = entryLines[index];
        if (line !== '[image-base64]') {
            textLines.push(line);
            continue;
        }

        flushTextLines();

        const imageLines = [];
        index += 1;
        while (index < entryLines.length && entryLines[index] !== '[/image-base64]') {
            imageLines.push(entryLines[index]);
            index += 1;
        }

        if (index < entryLines.length && entryLines[index] === '[/image-base64]') {
            const imageDataUrl = normalizeImageDataUrl(imageLines.join(''));
            if (imageDataUrl) {
                blocks.push({
                    type: 'image',
                    imageDataUrl
                });
                continue;
            }

            textLines.push('[image-base64]', ...imageLines, '[/image-base64]');
            continue;
        }

        textLines.push('[image-base64]', ...imageLines);
    }

    flushTextLines();
    return blocks;
}

function normalizeBlogEntryBlocks(contentBlocks) {
    const blocks = [];

    for (const block of contentBlocks) {
        if (block.type === 'text') {
            const lines = String(block.text || '').replace(/\r\n/g, '\n').split('\n');
            if (lines.length > 0) {
                blocks.push({
                    type: 'text',
                    lines
                });
            }
            continue;
        }

        if (block.type === 'image') {
            const imageDataUrl = normalizeImageDataUrl(block.imageDataUrl);
            if (!imageDataUrl) {
                continue;
            }

            blocks.push({
                type: 'image',
                imageDataUrl
            });
        }
    }

    return blocks;
}

function serializeBlogDocument(blogDocument) {
    const lines = [...blogDocument.introLines];

    if (blogDocument.entries.length > 0 && lines.length > 0 && lines[lines.length - 1] !== '') {
        lines.push('');
    }

    for (let entryIndex = 0; entryIndex < blogDocument.entries.length; entryIndex += 1) {
        const entry = blogDocument.entries[entryIndex];
        lines.push(entry.timestampLine);

        for (const block of entry.blocks) {
            if (block.type === 'text') {
                lines.push(...block.lines);
                continue;
            }

            if (block.type === 'image') {
                lines.push('[image-base64]');
                lines.push(block.imageDataUrl);
                lines.push('[/image-base64]');
            }
        }

        if (entryIndex < blogDocument.entries.length - 1) {
            lines.push('');
        }
    }

    return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}

function findImageBlockTarget(entries, {
    targetImageBlockIndex,
    targetImageKey,
    targetImageDataUrl,
    targetEntryTimestamp,
    targetEntryImageIndex,
    targetPreviousTextLine,
    targetNextTextLine
}) {
    const normalizedTargetEntryTimestamp = normalizeBlogEntryTimestamp(targetEntryTimestamp);
    const normalizedTargetEntryImageIndex = Number.isInteger(targetEntryImageIndex)
        ? targetEntryImageIndex
        : Number.parseInt(targetEntryImageIndex, 10);
    const normalizedTargetImageDataUrl = normalizeImageDataUrl(targetImageDataUrl);
    const normalizedTargetPreviousTextLine = String(targetPreviousTextLine || '').trim();
    const normalizedTargetNextTextLine = String(targetNextTextLine || '').trim();

    if (normalizedTargetEntryTimestamp) {
        const entryIndex = entries.findIndex(entry => entry.timestampLine === normalizedTargetEntryTimestamp);
        if (entryIndex >= 0) {
            const match = findImageBlockInEntry(entries[entryIndex], {
                targetImageKey,
                targetImageDataUrl: normalizedTargetImageDataUrl,
                targetEntryImageIndex: normalizedTargetEntryImageIndex,
                targetPreviousTextLine: normalizedTargetPreviousTextLine,
                targetNextTextLine: normalizedTargetNextTextLine
            });
            if (match) {
                return {
                    entryIndex,
                    blockIndex: match.blockIndex
                };
            }
        }

        return null;
    }

    const globalMatch = findImageBlockAcrossEntries(entries, {
        targetImageKey,
        targetImageDataUrl: normalizedTargetImageDataUrl
    });
    if (globalMatch) {
        return globalMatch;
    }

    if (Number.isInteger(targetImageBlockIndex) && targetImageBlockIndex >= 0) {
        const match = findImageBlockByGlobalIndex(entries, targetImageBlockIndex);
        if (match) {
            return match;
        }
    }

    return null;
}

function findImageBlockInEntry(entry, {
    targetImageKey,
    targetImageDataUrl,
    targetEntryImageIndex,
    targetPreviousTextLine,
    targetNextTextLine
}) {
    const imageBlocks = [];
    let lastNonEmptyTextLine = '';

    for (let blockIndex = 0; blockIndex < entry.blocks.length; blockIndex += 1) {
        const block = entry.blocks[blockIndex];
        if (block.type === 'text') {
            for (const line of block.lines) {
                if (String(line || '').trim()) {
                    lastNonEmptyTextLine = String(line);
                }
            }
            continue;
        }

        if (block.type !== 'image') {
            continue;
        }

        imageBlocks.push({
            blockIndex,
            imageIndex: imageBlocks.length,
            imageDataUrl: block.imageDataUrl,
            imageKey: createBlogImageKey(block.imageDataUrl),
            previousTextLine: lastNonEmptyTextLine,
            nextTextLine: findNextNonEmptyTextLineInEntry(entry.blocks, blockIndex)
        });
    }

    if (targetImageDataUrl) {
        return selectExactImageBlockMatch(imageBlocks.filter(block => block.imageDataUrl === targetImageDataUrl), {
            targetEntryImageIndex,
            targetPreviousTextLine,
            targetNextTextLine
        });
    }

    if (targetImageKey) {
        const keyMatch = selectExactImageBlockMatch(imageBlocks.filter(block => block.imageKey === targetImageKey), {
            targetEntryImageIndex,
            targetPreviousTextLine,
            targetNextTextLine
        });
        if (keyMatch) {
            return keyMatch;
        }
    }

    return selectContextualImageBlockMatch(imageBlocks, {
        targetEntryImageIndex,
        targetPreviousTextLine,
        targetNextTextLine
    });
}

function findNextNonEmptyTextLineInEntry(entryBlocks, startBlockIndex) {
    for (let blockIndex = startBlockIndex + 1; blockIndex < entryBlocks.length; blockIndex += 1) {
        const block = entryBlocks[blockIndex];
        if (block.type !== 'text') {
            continue;
        }

        for (const line of block.lines) {
            if (String(line || '').trim()) {
                return String(line);
            }
        }
    }

    return '';
}

function selectExactImageBlockMatch(imageBlocks, {
    targetEntryImageIndex,
    targetPreviousTextLine,
    targetNextTextLine
}) {
    if (imageBlocks.length === 0) {
        return null;
    }

    let candidates = imageBlocks;

    if (targetPreviousTextLine) {
        candidates = candidates.filter(block => block.previousTextLine.trim() === targetPreviousTextLine);
        if (candidates.length === 0) {
            return null;
        }
    }

    if (targetNextTextLine) {
        candidates = candidates.filter(block => block.nextTextLine.trim() === targetNextTextLine);
        if (candidates.length === 0) {
            return null;
        }
    }

    if (Number.isInteger(targetEntryImageIndex) && targetEntryImageIndex >= 0) {
        return candidates.find(block => block.imageIndex === targetEntryImageIndex) || null;
    }

    return candidates.length === 1 ? candidates[0] : null;
}

function selectContextualImageBlockMatch(imageBlocks, {
    targetEntryImageIndex,
    targetPreviousTextLine,
    targetNextTextLine
}) {
    let candidates = imageBlocks;

    if (targetPreviousTextLine) {
        candidates = candidates.filter(block => block.previousTextLine.trim() === targetPreviousTextLine);
        if (candidates.length === 0) {
            return null;
        }
    }

    if (targetNextTextLine) {
        candidates = candidates.filter(block => block.nextTextLine.trim() === targetNextTextLine);
        if (candidates.length === 0) {
            return null;
        }
    }

    if (Number.isInteger(targetEntryImageIndex) && targetEntryImageIndex >= 0) {
        return candidates.find(block => block.imageIndex === targetEntryImageIndex) || null;
    }

    if (targetPreviousTextLine || targetNextTextLine) {
        return candidates[0] || null;
    }

    return candidates.length === 1 ? candidates[0] : null;
}

function findImageBlockByGlobalIndex(entries, targetImageBlockIndex) {
    let globalImageIndex = 0;

    for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
        const entry = entries[entryIndex];

        for (let blockIndex = 0; blockIndex < entry.blocks.length; blockIndex += 1) {
            const block = entry.blocks[blockIndex];
            if (block.type !== 'image') {
                continue;
            }

            if (globalImageIndex === targetImageBlockIndex) {
                return {
                    entryIndex,
                    blockIndex
                };
            }

            globalImageIndex += 1;
        }
    }

    return null;
}

function findImageBlockAcrossEntries(entries, { targetImageKey, targetImageDataUrl }) {
    for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
        const entry = entries[entryIndex];

        for (let blockIndex = 0; blockIndex < entry.blocks.length; blockIndex += 1) {
            const block = entry.blocks[blockIndex];
            if (block.type !== 'image') {
                continue;
            }

            if (targetImageDataUrl && block.imageDataUrl === targetImageDataUrl) {
                return {
                    entryIndex,
                    blockIndex
                };
            }

            if (targetImageKey && createBlogImageKey(block.imageDataUrl) === targetImageKey) {
                return {
                    entryIndex,
                    blockIndex
                };
            }
        }
    }

    return null;
}

function toBlogEntryTimestampLine(value) {
    const normalized = String(value || new Date().toISOString()).trim();
    return isBlogEntryTimestampLine(normalized) ? normalized : `[${normalized}]`;
}

function normalizeBlogEntryTimestamp(value) {
    const normalized = String(value || '').trim();
    return isBlogEntryTimestampLine(normalized) ? normalized : '';
}

function isBlogEntryTimestampLine(line) {
    return /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z]$/.test(String(line || '').trim());
}

function githubContentsUrl(env) {
    const owner = env.GITHUB_OWNER;
    const repo = env.GITHUB_REPO;
    const path = env.GITHUB_BLOG_PATH || 'blog.txt';
    const branch = env.GITHUB_BRANCH || 'main';
    return `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
}

function publishedBlogUrl(env) {
    const origin = String(env.ALLOWED_ORIGIN || '').trim().replace(/\/+$/g, '');
    const path = String(env.GITHUB_BLOG_PATH || 'blog.txt').trim().replace(/^\/+/g, '');
    if (!origin || !/^https?:\/\//i.test(origin)) {
        return '';
    }

    return `${origin}/${path}?t=${Date.now()}`;
}

function githubBlobUrl(env, sha) {
    return `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/blobs/${encodeURIComponent(sha)}`;
}

function githubHeaders(env) {
    return {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${env.GITHUB_PAT}`,
        'User-Agent': '0x00C0DE-blog-worker',
        'X-GitHub-Api-Version': '2022-11-28'
    };
}

function getVisitorCounterStub(env) {
    const id = env.VISITOR_COUNTER.idFromName('0x00c0de-total-visitors');
    return env.VISITOR_COUNTER.get(id);
}

function getRateLimiterStub(env, ip) {
    const id = env.RATE_LIMITER.idFromName(`rate:${ip}`);
    return env.RATE_LIMITER.get(id);
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

async function proxyJsonResponse(response, origin) {
    const payload = await response.text();
    return new Response(payload, {
        status: response.status,
        headers: {
            'Content-Type': response.headers.get('Content-Type') || 'application/json; charset=utf-8',
            ...corsHeaders(origin)
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

function normalizeComparableBlogContent(value) {
    return String(value || '').replace(/\r\n/g, '\n');
}
