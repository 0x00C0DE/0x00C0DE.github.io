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

        if (request.method === 'POST' && url.pathname === '/api/blog/upload-chunk') {
            return handleStageImageChunk(request, env);
        }

        if (request.method === 'POST' && url.pathname === '/api/blog/delete-image') {
            return handleDeleteImage(request, env);
        }

        if (request.method === 'POST' && url.pathname === '/api/blog/delete-text') {
            return handleDeleteText(request, env);
        }

        if (request.method === 'POST' && url.pathname === '/api/blog/delete-entry') {
            return handleDeleteEntry(request, env);
        }

        if (request.method === 'POST' && url.pathname === '/api/terminal/su') {
            return handleTerminalSu(request, env);
        }

        if (request.method === 'GET' && url.pathname.startsWith('/api/blog/media/')) {
            return handleHostedBlogMedia(request, env);
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

export class BlogUploadSession {
    constructor(state) {
        this.state = state;
    }

    async fetch(request) {
        const url = new URL(request.url);

        if (request.method === 'POST' && url.pathname === '/stage') {
            const body = await request.json().catch(() => null);
            const totalChunks = Number.parseInt(body?.totalChunks, 10);
            const chunkIndex = Number.parseInt(body?.chunkIndex, 10);
            const chunk = typeof body?.chunk === 'string' ? body.chunk : '';

            if (!Number.isInteger(totalChunks) || totalChunks <= 0 || totalChunks > MAX_STAGED_IMAGE_CHUNKS) {
                return this.jsonErrorResponse('totalChunks must be a positive integer', 400);
            }

            if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= totalChunks) {
                return this.jsonErrorResponse('chunkIndex must be within range', 400);
            }

            if (!chunk) {
                return this.jsonErrorResponse('chunk is required', 400);
            }

            if (chunk.length > MAX_STAGED_IMAGE_CHUNK_LENGTH) {
                return this.jsonErrorResponse(`chunk must be ${MAX_STAGED_IMAGE_CHUNK_LENGTH} characters or fewer`, 400);
            }

            const meta = await this.state.storage.get('meta');
            if (meta && Number(meta.totalChunks) !== totalChunks) {
                return this.jsonErrorResponse('upload chunk count mismatch', 409);
            }

            await this.state.storage.put({
                meta: {
                    totalChunks,
                    updatedAt: Date.now()
                },
                [`chunk:${chunkIndex}`]: chunk
            });

            return this.jsonSuccessResponse({
                staged: true,
                chunkIndex
            });
        }

        if (request.method === 'POST' && url.pathname === '/consume') {
            const meta = await this.state.storage.get('meta');
            const totalChunks = Number(meta?.totalChunks || 0);
            if (!Number.isInteger(totalChunks) || totalChunks <= 0) {
                return this.jsonErrorResponse('staged upload not found', 404);
            }

            const chunkKeys = [];
            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
                chunkKeys.push(`chunk:${chunkIndex}`);
            }

            const storedChunks = await this.state.storage.get(chunkKeys);
            const chunks = [];
            for (const key of chunkKeys) {
                const chunk = readStoredValue(storedChunks, key);
                if (typeof chunk !== 'string' || !chunk) {
                    return this.jsonErrorResponse('staged upload is incomplete', 409);
                }
                chunks.push(chunk);
            }

            await clearBlogUploadSessionStorage(this.state.storage);

            return this.jsonSuccessResponse({
                dataUrl: chunks.join('')
            });
        }

        if (request.method === 'POST' && url.pathname === '/meta') {
            const meta = await this.state.storage.get('meta');
            const totalChunks = Number(meta?.totalChunks || 0);
            if (!Number.isInteger(totalChunks) || totalChunks <= 0) {
                return this.jsonErrorResponse('staged upload not found', 404);
            }

            return this.jsonSuccessResponse({
                totalChunks
            });
        }

        if (request.method === 'POST' && url.pathname === '/chunk') {
            const meta = await this.state.storage.get('meta');
            const totalChunks = Number(meta?.totalChunks || 0);
            if (!Number.isInteger(totalChunks) || totalChunks <= 0) {
                return this.jsonErrorResponse('staged upload not found', 404);
            }

            const body = await request.json().catch(() => null);
            const chunkIndex = Number.parseInt(body?.chunkIndex, 10);
            if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= totalChunks) {
                return this.jsonErrorResponse('chunkIndex must be within range', 400);
            }

            const chunk = await this.state.storage.get(`chunk:${chunkIndex}`);
            if (typeof chunk !== 'string' || !chunk) {
                return this.jsonErrorResponse('staged upload is incomplete', 409);
            }

            return this.jsonSuccessResponse({
                chunk,
                chunkIndex,
                totalChunks
            });
        }

        if (request.method === 'POST' && url.pathname === '/clear') {
            await clearBlogUploadSessionStorage(this.state.storage);
            return this.jsonSuccessResponse({
                cleared: true
            });
        }

        return this.jsonErrorResponse('not found', 404);
    }

    jsonSuccessResponse(payload) {
        return new Response(JSON.stringify({
            ok: true,
            ...payload
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
}

export class R2QuotaGuard {
    constructor(state) {
        this.state = state;
    }

    async fetch(request) {
        const url = new URL(request.url);
        if (request.method !== 'POST') {
            return this.jsonErrorResponse('not found', 404);
        }

        const body = await request.json().catch(() => null);
        if (url.pathname === '/decision') {
            return this.handleDecision(body);
        }

        if (url.pathname === '/record-write') {
            return this.handleRecordWrite(body);
        }

        if (url.pathname === '/record-read') {
            return this.handleRecordRead(body);
        }

        if (url.pathname === '/record-delete') {
            return this.handleRecordDelete(body);
        }

        return this.jsonErrorResponse('not found', 404);
    }

    async handleDecision(body) {
        const now = normalizeGuardTimestamp(body?.now);
        const config = normalizeR2QuotaConfig(body);
        if (!config.enabled) {
            return this.jsonSuccessResponse({
                allowed: true,
                reason: 'guard_disabled'
            });
        }

        const snapshot = await this.getSnapshot(now, config);
        if (!snapshot) {
            return this.jsonSuccessResponse({
                allowed: true,
                reason: 'analytics_unavailable'
            });
        }

        const decision = evaluateR2QuotaDecision(snapshot, config, {
            action: String(body?.action || '').trim().toLowerCase(),
            bytesDelta: normalizeStorageBytes(body?.bytesDelta)
        });
        return this.jsonSuccessResponse(decision);
    }

    async handleRecordWrite(body) {
        const now = normalizeGuardTimestamp(body?.now);
        const storageKey = String(body?.storageKey || '').trim();
        const bytes = normalizeStorageBytes(body?.bytes);
        if (!storageKey || bytes <= 0) {
            return this.jsonErrorResponse('storageKey and bytes are required', 400);
        }

        const snapshot = await this.state.storage.get('snapshot');
        if (snapshot) {
            applyLocalR2Write(snapshot, storageKey, bytes, now);
            await this.state.storage.put('snapshot', snapshot);
        }

        return this.jsonSuccessResponse({ recorded: true });
    }

    async handleRecordRead(body) {
        const now = normalizeGuardTimestamp(body?.now);
        const snapshot = await this.state.storage.get('snapshot');
        if (snapshot) {
            applyLocalR2Read(snapshot, now);
            await this.state.storage.put('snapshot', snapshot);
        }

        return this.jsonSuccessResponse({ recorded: true });
    }

    async handleRecordDelete(body) {
        const now = normalizeGuardTimestamp(body?.now);
        const storageKey = String(body?.storageKey || '').trim();
        const bytes = normalizeStorageBytes(body?.bytes);
        if (!storageKey) {
            return this.jsonErrorResponse('storageKey is required', 400);
        }

        const snapshot = await this.state.storage.get('snapshot');
        if (snapshot) {
            applyLocalR2Delete(snapshot, storageKey, bytes, now);
            await this.state.storage.put('snapshot', snapshot);
        }

        return this.jsonSuccessResponse({ recorded: true });
    }

    async getSnapshot(now, config) {
        const storedSnapshot = await this.state.storage.get('snapshot');
        if (storedSnapshot && !shouldRefreshR2QuotaSnapshot(storedSnapshot, config, now)) {
            return storedSnapshot;
        }

        try {
            const freshSnapshot = await fetchCloudflareR2QuotaSnapshot(config, now);
            await this.state.storage.put('snapshot', freshSnapshot);
            return freshSnapshot;
        } catch (error) {
            console.error('r2 quota analytics fetch failed', error);
            return storedSnapshot || null;
        }
    }

    jsonSuccessResponse(payload) {
        return new Response(JSON.stringify({
            ok: true,
            ...payload
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
}

export class B2QuotaGuard {
    constructor(state) {
        this.state = state;
    }

    async fetch(request) {
        const url = new URL(request.url);
        if (request.method !== 'POST') {
            return this.jsonErrorResponse('not found', 404);
        }

        const body = await request.json().catch(() => null);
        if (url.pathname === '/decision') {
            return this.handleDecision(body);
        }

        if (url.pathname === '/record-write') {
            return this.handleRecordWrite(body);
        }

        if (url.pathname === '/record-read') {
            return this.handleRecordRead(body);
        }

        if (url.pathname === '/record-delete') {
            return this.handleRecordDelete(body);
        }

        return this.jsonErrorResponse('not found', 404);
    }

    async handleDecision(body) {
        const now = normalizeGuardTimestamp(body?.now);
        const config = normalizeB2QuotaConfig(body);
        if (!config.enabled) {
            return this.jsonSuccessResponse({
                allowed: true,
                reason: 'guard_disabled'
            });
        }

        const snapshot = await this.getSnapshot(now, config);
        const decision = evaluateB2QuotaDecision(snapshot, config, {
            action: String(body?.action || '').trim().toLowerCase(),
            bytesDelta: normalizeStorageBytes(body?.bytesDelta)
        });
        return this.jsonSuccessResponse(decision);
    }

    async handleRecordWrite(body) {
        const now = normalizeGuardTimestamp(body?.now);
        const storageKey = String(body?.storageKey || '').trim();
        const bytes = normalizeStorageBytes(body?.bytes);
        if (!storageKey || bytes <= 0) {
            return this.jsonErrorResponse('storageKey and bytes are required', 400);
        }

        const snapshot = await this.getSnapshot(now, normalizeB2QuotaConfig(body));
        applyLocalB2Write(snapshot, storageKey, bytes, now);
        await this.state.storage.put('snapshot', snapshot);
        return this.jsonSuccessResponse({ recorded: true });
    }

    async handleRecordRead(body) {
        const now = normalizeGuardTimestamp(body?.now);
        const snapshot = await this.getSnapshot(now, normalizeB2QuotaConfig(body));
        applyLocalB2Read(snapshot, now);
        await this.state.storage.put('snapshot', snapshot);
        return this.jsonSuccessResponse({ recorded: true });
    }

    async handleRecordDelete(body) {
        const now = normalizeGuardTimestamp(body?.now);
        const storageKey = String(body?.storageKey || '').trim();
        const bytes = normalizeStorageBytes(body?.bytes);
        if (!storageKey) {
            return this.jsonErrorResponse('storageKey is required', 400);
        }

        const snapshot = await this.getSnapshot(now, normalizeB2QuotaConfig(body));
        applyLocalB2Delete(snapshot, storageKey, bytes, now);
        await this.state.storage.put('snapshot', snapshot);
        return this.jsonSuccessResponse({ recorded: true });
    }

    async getSnapshot(now, config) {
        const storedSnapshot = await this.state.storage.get('snapshot');
        const snapshot = normalizeB2QuotaSnapshot(storedSnapshot, now, config.bucketName);
        if (!shouldRefreshB2QuotaSnapshot(snapshot, config, now)) {
            return snapshot;
        }

        try {
            const refreshedSnapshot = await fetchManagedB2QuotaSnapshot(config, now, snapshot);
            await this.state.storage.put('snapshot', refreshedSnapshot);
            return refreshedSnapshot;
        } catch (error) {
            console.error('b2 quota snapshot refresh failed', error);
            return snapshot;
        }
    }

    jsonSuccessResponse(payload) {
        return new Response(JSON.stringify({
            ok: true,
            ...payload
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
}

// Keep the timeout comfortably above the persisted heartbeat cadence so
// active visitors do not disappear if the Durable Object is reloaded
// between storage flushes.
const VISITOR_ONSITE_WINDOW_MS = 8000;
const HEARTBEAT_PERSIST_INTERVAL_MS = 2000;
const MIN_SNAPSHOT_FLUSH_INTERVAL_MS = 1000;
const MAX_IMAGE_DATA_URL_LENGTH = 100000000;
const MAX_IMAGE_ATTACHMENTS = 10;
const MAX_STAGED_IMAGE_CHUNKS = 2048;
const MAX_STAGED_IMAGE_CHUNK_LENGTH = 98304;
const DEFAULT_GITHUB_CONTENTS_MAX_BASE64_BYTES = 95000000;
const LARGE_STAGED_COMPACT_IMAGE_BYTE_LENGTH = 4000000;
const ALLOWED_BLOG_INLINE_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
const ALLOWED_BLOG_POST_MEDIA_MIME_TYPES = new Set([...ALLOWED_BLOG_INLINE_IMAGE_MIME_TYPES, 'video/mp4']);
const BLOG_COMPACT_IMAGE_MIME_TYPES = new Set(['image/gif']);
const BLOG_HOSTED_MEDIA_MIME_TYPES = new Set(['image/gif', 'video/mp4']);
const BLOG_HOSTED_IMAGE_PROVIDERS = new Set(['r2', 'b2']);
const BLOG_Z85_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#';
const BLOG_DEPLOY_PENDING_ERROR = 'site is still deploying previous changes; wait for blog.txt to go live before posting or deleting again';
const DEFAULT_BLOG_MEDIA_BASE_URL = 'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/blog/media';
const B2_AUTHORIZE_ACCOUNT_URL = 'https://api.backblazeb2.com/b2api/v3/b2_authorize_account';
const CLOUDFLARE_API_BASE_URL = 'https://api.cloudflare.com/client/v4';
const DEFAULT_R2_STORAGE_GUARD_GB_MONTH_THRESHOLD = 8;
const DEFAULT_R2_CLASS_A_GUARD_THRESHOLD = 800000;
const DEFAULT_R2_CLASS_B_GUARD_THRESHOLD = 8000000;
const DEFAULT_R2_BILLING_REFRESH_MS = 300000;
const DEFAULT_B2_STORAGE_GUARD_GB_THRESHOLD = 8;
const DEFAULT_B2_CLASS_B_GUARD_THRESHOLD = 2000;
const DEFAULT_B2_CLASS_C_GUARD_THRESHOLD = 2000;
const DEFAULT_B2_USAGE_REFRESH_MS = 300000;
const BYTES_PER_GIGABYTE = 1000 * 1000 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function normalizeGuardTimestamp(value) {
    const normalizedValue = Number(value);
    return Number.isFinite(normalizedValue) && normalizedValue > 0 ? normalizedValue : Date.now();
}

function normalizeStorageBytes(value) {
    const normalizedValue = Number.parseInt(value, 10);
    return Number.isInteger(normalizedValue) && normalizedValue > 0 ? normalizedValue : 0;
}

function normalizePositiveInteger(value, fallback) {
    const normalizedValue = Number.parseInt(value, 10);
    return Number.isInteger(normalizedValue) && normalizedValue > 0 ? normalizedValue : fallback;
}

function normalizePositiveNumber(value, fallback) {
    const normalizedValue = Number(value);
    return Number.isFinite(normalizedValue) && normalizedValue > 0 ? normalizedValue : fallback;
}

function currentMonthWindow(now = Date.now()) {
    const timestamp = normalizeGuardTimestamp(now);
    const currentDate = new Date(timestamp);
    const monthStart = Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), 1);
    const monthEnd = Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 1);
    const monthDayCount = Math.max(1, Math.round((monthEnd - monthStart) / MS_PER_DAY));
    return {
        monthKey: `${currentDate.getUTCFullYear()}-${String(currentDate.getUTCMonth() + 1).padStart(2, '0')}`,
        monthStart,
        monthEnd,
        monthDayCount,
        currentDayKey: new Date(timestamp).toISOString().slice(0, 10)
    };
}

function currentUtcDayKey(now = Date.now()) {
    return new Date(normalizeGuardTimestamp(now)).toISOString().slice(0, 10);
}

function normalizeR2QuotaConfig(value) {
    const window = currentMonthWindow(value?.now);
    const bucketName = String(value?.bucketName || '').trim();
    const accountId = String(value?.accountId || value?.analyticsAccountId || '').trim();
    const billingApiToken = String(value?.billingApiToken || value?.analyticsApiToken || '').trim();
    const storageGbMonthThreshold = normalizePositiveNumber(
        value?.storageGbMonthThreshold,
        DEFAULT_R2_STORAGE_GUARD_GB_MONTH_THRESHOLD
    );
    const classAThreshold = normalizePositiveInteger(value?.classAThreshold, DEFAULT_R2_CLASS_A_GUARD_THRESHOLD);
    const classBThreshold = normalizePositiveInteger(value?.classBThreshold, DEFAULT_R2_CLASS_B_GUARD_THRESHOLD);
    const refreshMs = normalizePositiveInteger(value?.refreshMs, DEFAULT_R2_BILLING_REFRESH_MS);

    return {
        enabled: Boolean(value?.enabled !== false && bucketName && accountId && billingApiToken),
        bucketName,
        accountId,
        billingApiToken,
        storageGbMonthThreshold,
        classAThreshold,
        classBThreshold,
        refreshMs,
        monthKey: window.monthKey,
        monthDayCount: window.monthDayCount,
        currentDayKey: window.currentDayKey,
        monthStart: window.monthStart
    };
}

function normalizeB2QuotaConfig(value) {
    return {
        enabled: Boolean(value?.enabled !== false && String(value?.bucketName || '').trim()),
        bucketName: String(value?.bucketName || '').trim(),
        storageGbThreshold: normalizePositiveNumber(
            value?.storageGbThreshold,
            DEFAULT_B2_STORAGE_GUARD_GB_THRESHOLD
        ),
        classBThreshold: normalizePositiveInteger(
            value?.classBThreshold,
            DEFAULT_B2_CLASS_B_GUARD_THRESHOLD
        ),
        classCThreshold: normalizePositiveInteger(
            value?.classCThreshold,
            DEFAULT_B2_CLASS_C_GUARD_THRESHOLD
        ),
        refreshMs: normalizePositiveInteger(
            value?.refreshMs,
            DEFAULT_B2_USAGE_REFRESH_MS
        ),
        githubOwner: String(value?.githubOwner || '').trim(),
        githubRepo: String(value?.githubRepo || '').trim(),
        githubBranch: String(value?.githubBranch || 'main').trim() || 'main',
        githubBlogPath: String(value?.githubBlogPath || 'blog.txt').trim() || 'blog.txt',
        githubPat: String(value?.githubPat || '').trim()
    };
}

function shouldRefreshR2QuotaSnapshot(snapshot, config, now) {
    if (!snapshot) {
        return true;
    }

    const window = currentMonthWindow(now);
    if (snapshot.monthKey !== window.monthKey) {
        return true;
    }

    const fetchedAt = Number(snapshot.fetchedAt || 0);
    return !Number.isFinite(fetchedAt) || fetchedAt <= 0 || (normalizeGuardTimestamp(now) - fetchedAt) >= config.refreshMs;
}

function shouldRefreshB2QuotaSnapshot(snapshot, config, now) {
    if (!snapshot) {
        return true;
    }

    const currentDay = currentUtcDayKey(now);
    if (snapshot.currentDayKey !== currentDay) {
        return true;
    }

    const fetchedAt = Number(snapshot.fetchedAt || 0);
    return !Number.isFinite(fetchedAt) || fetchedAt <= 0 || (normalizeGuardTimestamp(now) - fetchedAt) >= config.refreshMs;
}

function evaluateR2QuotaDecision(snapshot, config, {
    action,
    bytesDelta = 0
}) {
    const normalizedAction = String(action || '').trim().toLowerCase();
    const normalizedBytesDelta = normalizeStorageBytes(bytesDelta);
    const storageThresholdBytes = storageThresholdBytesPerMonth(config);
    const projectedStorageBytes = normalizedAction === 'write'
        ? Math.max(0, Number(snapshot.currentStorageBytes || 0) + normalizedBytesDelta)
        : Math.max(0, Number(snapshot.currentStorageBytes || 0));

    if (Number(snapshot.storageGbMonthUsed || 0) >= config.storageGbMonthThreshold || projectedStorageBytes >= storageThresholdBytes) {
        return {
            allowed: false,
            reason: 'storage_guardrail',
            snapshot
        };
    }

    if (normalizedAction === 'write' && (Number(snapshot.classAOps || 0) + 1) >= config.classAThreshold) {
        return {
            allowed: false,
            reason: 'class_a_guardrail',
            snapshot
        };
    }

    if (normalizedAction === 'read' && (Number(snapshot.classBOps || 0) + 1) >= config.classBThreshold) {
        return {
            allowed: false,
            reason: 'class_b_guardrail',
            snapshot
        };
    }

    return {
        allowed: true,
        reason: 'ok',
        snapshot
    };
}

function evaluateB2QuotaDecision(snapshot, config, {
    action,
    bytesDelta = 0
}) {
    const normalizedAction = String(action || '').trim().toLowerCase();
    const normalizedBytesDelta = normalizeStorageBytes(bytesDelta);
    const projectedStorageBytes = normalizedAction === 'write'
        ? Math.max(0, Number(snapshot.currentStorageBytes || 0) + normalizedBytesDelta)
        : Math.max(0, Number(snapshot.currentStorageBytes || 0));
    const storageThresholdBytes = normalizePositiveNumber(
        config?.storageGbThreshold,
        DEFAULT_B2_STORAGE_GUARD_GB_THRESHOLD
    ) * BYTES_PER_GIGABYTE;

    if (projectedStorageBytes >= storageThresholdBytes) {
        return {
            allowed: false,
            reason: 'storage_guardrail',
            snapshot
        };
    }

    if (normalizedAction === 'write' && (Number(snapshot.classCOps || 0) + 1) >= config.classCThreshold) {
        return {
            allowed: false,
            reason: 'class_c_guardrail',
            snapshot
        };
    }

    if (normalizedAction === 'read' && (Number(snapshot.classBOps || 0) + 1) >= config.classBThreshold) {
        return {
            allowed: false,
            reason: 'class_b_guardrail',
            snapshot
        };
    }

    if (normalizedAction === 'read' && (Number(snapshot.classCOps || 0) + 1) >= config.classCThreshold) {
        return {
            allowed: false,
            reason: 'class_c_guardrail',
            snapshot
        };
    }

    return {
        allowed: true,
        reason: 'ok',
        snapshot
    };
}

function storageThresholdBytesPerMonth(config) {
    return normalizePositiveNumber(config?.storageGbMonthThreshold, DEFAULT_R2_STORAGE_GUARD_GB_MONTH_THRESHOLD) * BYTES_PER_GIGABYTE;
}

function normalizeB2QuotaSnapshot(snapshot, now, bucketName = '') {
    const currentDay = currentUtcDayKey(now);
    const normalizedObjectSizes = snapshot?.objectSizes && typeof snapshot.objectSizes === 'object'
        ? snapshot.objectSizes
        : {};
    const normalizedSnapshot = {
        currentDayKey: currentDay,
        currentStorageBytes: Math.max(0, Number(snapshot?.currentStorageBytes || 0)),
        classBOps: Math.max(0, Number(snapshot?.classBOps || 0)),
        classCOps: Math.max(0, Number(snapshot?.classCOps || 0)),
        fetchedAt: Number(snapshot?.fetchedAt || 0),
        bucketName: String(snapshot?.bucketName || bucketName || '').trim(),
        objectSizes: normalizedObjectSizes
    };

    if (snapshot?.currentDayKey !== currentDay) {
        normalizedSnapshot.classBOps = 0;
        normalizedSnapshot.classCOps = 0;
        normalizedSnapshot.currentDayKey = currentDay;
    }

    return normalizedSnapshot;
}

function dayIndexWithinMonth(dayKey, monthKey) {
    if (typeof dayKey !== 'string' || typeof monthKey !== 'string' || !dayKey.startsWith(`${monthKey}-`)) {
        return 0;
    }

    const day = Number.parseInt(dayKey.slice(-2), 10);
    return Number.isInteger(day) && day > 0 ? day - 1 : 0;
}

function resetR2QuotaSnapshotForMonth(snapshot, now) {
    const window = currentMonthWindow(now);
    snapshot.monthKey = window.monthKey;
    snapshot.monthDayCount = window.monthDayCount;
    snapshot.currentDayKey = window.currentDayKey;
    snapshot.storageGbMonthUsed = 0;
    snapshot.currentStorageBytes = 0;
    snapshot.completedDayPeakByteSum = 0;
    snapshot.currentDayPeakBytes = 0;
    snapshot.classAOps = 0;
    snapshot.classBOps = 0;
    snapshot.objectSizes = {};
}

function applyLocalR2Write(snapshot, storageKey, bytes, now) {
    if (snapshot.monthKey !== currentMonthWindow(now).monthKey) {
        resetR2QuotaSnapshotForMonth(snapshot, now);
    }

    const currentStorageBytes = Math.max(0, Number(snapshot.currentStorageBytes || 0));
    const previousBytes = normalizeStorageBytes(snapshot.objectSizes?.[storageKey]);
    const nextStorageBytes = Math.max(0, currentStorageBytes - previousBytes + bytes);

    snapshot.currentStorageBytes = nextStorageBytes;
    snapshot.currentDayKey = currentMonthWindow(now).currentDayKey;
    snapshot.currentDayPeakBytes = Math.max(Number(snapshot.currentDayPeakBytes || 0), nextStorageBytes);
    snapshot.classAOps = Math.max(0, Number(snapshot.classAOps || 0)) + 1;
    snapshot.objectSizes = {
        ...(snapshot.objectSizes && typeof snapshot.objectSizes === 'object' ? snapshot.objectSizes : {}),
        [storageKey]: bytes
    };
}

function applyLocalR2Read(snapshot, now) {
    if (snapshot.monthKey !== currentMonthWindow(now).monthKey) {
        resetR2QuotaSnapshotForMonth(snapshot, now);
    }

    snapshot.currentDayKey = currentMonthWindow(now).currentDayKey;
    snapshot.classBOps = Math.max(0, Number(snapshot.classBOps || 0)) + 1;
}

function applyLocalR2Delete(snapshot, storageKey, bytes, now) {
    if (snapshot.monthKey !== currentMonthWindow(now).monthKey) {
        resetR2QuotaSnapshotForMonth(snapshot, now);
    }

    const previousBytes = normalizeStorageBytes(snapshot.objectSizes?.[storageKey]) || bytes;
    snapshot.currentStorageBytes = Math.max(0, Number(snapshot.currentStorageBytes || 0) - previousBytes);
    snapshot.currentDayKey = currentMonthWindow(now).currentDayKey;
    if (snapshot.objectSizes && typeof snapshot.objectSizes === 'object') {
        delete snapshot.objectSizes[storageKey];
    }
}

function applyLocalB2Write(snapshot, storageKey, bytes, now) {
    const normalizedSnapshot = normalizeB2QuotaSnapshot(snapshot, now, snapshot?.bucketName);
    const previousBytes = normalizeStorageBytes(normalizedSnapshot.objectSizes?.[storageKey]);
    const nextStorageBytes = Math.max(
        0,
        Number(normalizedSnapshot.currentStorageBytes || 0) - previousBytes + bytes
    );

    normalizedSnapshot.currentStorageBytes = nextStorageBytes;
    normalizedSnapshot.classCOps = Math.max(0, Number(normalizedSnapshot.classCOps || 0)) + 1;
    normalizedSnapshot.objectSizes = {
        ...normalizedSnapshot.objectSizes,
        [storageKey]: bytes
    };
    Object.assign(snapshot, normalizedSnapshot);
}

function applyLocalB2Read(snapshot, now) {
    const normalizedSnapshot = normalizeB2QuotaSnapshot(snapshot, now, snapshot?.bucketName);
    normalizedSnapshot.classBOps = Math.max(0, Number(normalizedSnapshot.classBOps || 0)) + 1;
    normalizedSnapshot.classCOps = Math.max(0, Number(normalizedSnapshot.classCOps || 0)) + 1;
    Object.assign(snapshot, normalizedSnapshot);
}

function applyLocalB2Delete(snapshot, storageKey, bytes, now) {
    const normalizedSnapshot = normalizeB2QuotaSnapshot(snapshot, now, snapshot?.bucketName);
    const previousBytes = normalizeStorageBytes(normalizedSnapshot.objectSizes?.[storageKey]) || bytes;
    normalizedSnapshot.currentStorageBytes = Math.max(
        0,
        Number(normalizedSnapshot.currentStorageBytes || 0) - previousBytes
    );
    if (normalizedSnapshot.objectSizes && typeof normalizedSnapshot.objectSizes === 'object') {
        delete normalizedSnapshot.objectSizes[storageKey];
    }
    Object.assign(snapshot, normalizedSnapshot);
}

async function fetchManagedB2QuotaSnapshot(config, now, existingSnapshot = null) {
    const timestamp = normalizeGuardTimestamp(now);
    const snapshot = normalizeB2QuotaSnapshot(existingSnapshot, timestamp, config.bucketName);
    if (!config.githubOwner || !config.githubRepo || !config.githubPat) {
        snapshot.fetchedAt = timestamp;
        return snapshot;
    }

    const githubFile = await fetchGithubFile({
        GITHUB_OWNER: config.githubOwner,
        GITHUB_REPO: config.githubRepo,
        GITHUB_BRANCH: config.githubBranch,
        GITHUB_BLOG_PATH: config.githubBlogPath,
        GITHUB_PAT: config.githubPat
    });
    const blogDocument = parseBlogDocument(githubFile.content);
    let currentStorageBytes = 0;
    const objectSizes = {};

    for (const entry of blogDocument.entries) {
        for (const block of entry.blocks) {
            if (
                block?.type === 'image' &&
                block.storageProvider === 'b2' &&
                typeof block.storageKey === 'string' &&
                block.storageKey &&
                normalizeStorageBytes(block.storageBytes) > 0
            ) {
                const blockBytes = normalizeStorageBytes(block.storageBytes);
                currentStorageBytes += blockBytes;
                objectSizes[block.storageKey] = blockBytes;
            }
        }
    }

    snapshot.currentStorageBytes = currentStorageBytes;
    snapshot.objectSizes = objectSizes;
    snapshot.fetchedAt = timestamp;
    return snapshot;
}

async function fetchCloudflareR2QuotaSnapshot(config, now) {
    const timestamp = normalizeGuardTimestamp(now);
    const window = currentMonthWindow(timestamp);
    const requestHeaders = {
        Authorization: `Bearer ${config.billingApiToken}`,
        'Content-Type': 'application/json'
    };
    const billingUsageUrl = `${CLOUDFLARE_API_BASE_URL}/accounts/${encodeURIComponent(config.accountId)}/billing/usage/paygo`;
    const r2MetricsUrl = `${CLOUDFLARE_API_BASE_URL}/accounts/${encodeURIComponent(config.accountId)}/r2/metrics`;

    const [billingUsageResponse, r2MetricsResponse] = await Promise.all([
        fetch(billingUsageUrl, {
            headers: requestHeaders
        }),
        fetch(r2MetricsUrl, {
            headers: requestHeaders
        })
    ]);

    if (!billingUsageResponse.ok) {
        throw new Error(`cloudflare billing usage failed with ${billingUsageResponse.status}`);
    }

    if (!r2MetricsResponse.ok) {
        throw new Error(`cloudflare r2 metrics failed with ${r2MetricsResponse.status}`);
    }

    const billingUsagePayload = await billingUsageResponse.json();
    if (Array.isArray(billingUsagePayload?.errors) && billingUsagePayload.errors.length > 0) {
        throw new Error(`cloudflare billing usage returned errors: ${billingUsagePayload.errors[0]?.message || 'unknown error'}`);
    }

    const r2MetricsPayload = await r2MetricsResponse.json();
    if (Array.isArray(r2MetricsPayload?.errors) && r2MetricsPayload.errors.length > 0) {
        throw new Error(`cloudflare r2 metrics returned errors: ${r2MetricsPayload.errors[0]?.message || 'unknown error'}`);
    }

    const billingRecords = Array.isArray(billingUsagePayload?.result)
        ? billingUsagePayload.result
        : (Array.isArray(billingUsagePayload) ? billingUsagePayload : []);
    const billingTotals = extractR2BillingTotals(billingRecords, window);
    const currentStorageBytes = extractR2MetricsCurrentStorageBytes(r2MetricsPayload?.result);

    return {
        monthKey: window.monthKey,
        monthDayCount: window.monthDayCount,
        currentDayKey: window.currentDayKey,
        storageGbMonthUsed: billingTotals.storageGbMonthUsed,
        currentStorageBytes,
        completedDayPeakByteSum: 0,
        currentDayPeakBytes: currentStorageBytes,
        classAOps: billingTotals.classAOps,
        classBOps: billingTotals.classBOps,
        fetchedAt: timestamp,
        bucketName: config.bucketName,
        objectSizes: {}
    };
}

function normalizeBillingText(value) {
    return String(value || '').trim().toLowerCase();
}

function selectBillingUsageQuantity(record) {
    const quantities = [
        Number(record?.CumulatedPricingQuantity),
        Number(record?.PricingQuantity),
        Number(record?.ConsumedQuantity)
    ].filter(value => Number.isFinite(value) && value >= 0);
    return quantities.length > 0 ? Math.max(...quantities) : 0;
}

function convertBillingOperationQuantity(quantity, unit) {
    const normalizedUnit = normalizeBillingText(unit);
    if (normalizedUnit.includes('billion')) {
        return quantity * 1000000000;
    }
    if (normalizedUnit.includes('million')) {
        return quantity * 1000000;
    }
    if (normalizedUnit.includes('thousand')) {
        return quantity * 1000;
    }
    return quantity;
}

function convertBillingStorageQuantityToGbMonth(quantity, unit) {
    const normalizedUnit = normalizeBillingText(unit);
    if (normalizedUnit.includes('tb')) {
        return quantity * 1000;
    }
    if (normalizedUnit.includes('gb')) {
        return quantity;
    }
    if (normalizedUnit.includes('mb')) {
        return quantity / 1000;
    }
    if (normalizedUnit.includes('kb')) {
        return quantity / 1000000;
    }
    if (normalizedUnit.includes('byte')) {
        return quantity / BYTES_PER_GIGABYTE;
    }
    return quantity;
}

function billingRecordBelongsToMonth(record, window) {
    const candidateDates = [
        record?.BillingPeriodStart,
        record?.ChargePeriodStart,
        record?.ChargePeriodEnd
    ];

    return candidateDates.some(value => String(value || '').slice(0, 7) === window.monthKey);
}

function extractR2BillingTotals(records, window) {
    let storageGbMonthUsed = 0;
    let classAOps = 0;
    let classBOps = 0;

    for (const record of Array.isArray(records) ? records : []) {
        if (!billingRecordBelongsToMonth(record, window)) {
            continue;
        }

        const serviceName = normalizeBillingText(record?.ServiceName);
        const consumedUnit = normalizeBillingText(record?.ConsumedUnit);
        if (!serviceName.includes('r2')) {
            continue;
        }

        const quantity = selectBillingUsageQuantity(record);
        if (quantity <= 0) {
            continue;
        }

        if (serviceName.includes('class a') || consumedUnit.includes('class a')) {
            classAOps = Math.max(classAOps, convertBillingOperationQuantity(quantity, consumedUnit));
            continue;
        }

        if (serviceName.includes('class b') || consumedUnit.includes('class b')) {
            classBOps = Math.max(classBOps, convertBillingOperationQuantity(quantity, consumedUnit));
            continue;
        }

        if (serviceName.includes('storage') || consumedUnit.includes('month') || consumedUnit.includes('storage')) {
            storageGbMonthUsed = Math.max(storageGbMonthUsed, convertBillingStorageQuantityToGbMonth(quantity, consumedUnit));
        }
    }

    return {
        storageGbMonthUsed,
        classAOps,
        classBOps
    };
}

function extractR2MetricsCurrentStorageBytes(result) {
    const metrics = result && typeof result === 'object' ? result : {};
    let totalBytes = 0;

    for (const storageClassKey of ['standard', 'infrequentAccess']) {
        const storageClass = metrics?.[storageClassKey];
        if (!storageClass || typeof storageClass !== 'object') {
            continue;
        }

        for (const stateKey of ['published', 'uploaded']) {
            const stateMetrics = storageClass?.[stateKey];
            if (!stateMetrics || typeof stateMetrics !== 'object') {
                continue;
            }

            totalBytes += Math.max(0, Number(stateMetrics.payloadSize || 0));
            totalBytes += Math.max(0, Number(stateMetrics.metadataSize || 0));
        }
    }

    return totalBytes;
}

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

async function handleStageImageChunk(request, env) {
    try {
        if (!env.BLOG_UPLOAD_SESSION) {
            return jsonResponse({ error: 'blog upload session binding not configured' }, 500, env.ALLOWED_ORIGIN);
        }

        const body = await request.json().catch(() => null);
        const uploadId = sanitizeUploadToken(body?.uploadId);
        if (!uploadId) {
            return jsonResponse({ error: 'uploadId is required' }, 400, env.ALLOWED_ORIGIN);
        }

        const stub = getBlogUploadSessionStub(env, uploadId);
        const response = await stub.fetch('https://blog-upload-session/stage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                chunkIndex: body?.chunkIndex,
                totalChunks: body?.totalChunks,
                chunk: body?.chunk
            })
        });

        return proxyJsonResponse(response, env.ALLOWED_ORIGIN);
    } catch (error) {
        console.error('stage image chunk failed', error);
        return jsonResponse({ error: 'unable to stage image upload right now' }, 500, env.ALLOWED_ORIGIN);
    }
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
        const normalizedBlocks = await normalizeAppendContentBlocks({
            contentBlocks,
            text,
            imageDataUrl,
            maxPostLength,
            maxImageDataUrlLength,
            env
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

        const hasLargeStagedCompactImage = normalizedBlocks.blocks.some(block =>
            block?.type === 'image' &&
            block.imageEncoding === 'z85' &&
            block.stagedUploadToken &&
            Number(block.byteLength || 0) >= LARGE_STAGED_COMPACT_IMAGE_BYTE_LENGTH
        );

        const commit = hasLargeStagedCompactImage
            ? await appendBlogEntryViaStream(env, githubFile.content, normalizedBlocks.blocks)
            : await updateGithubFile(env, appendBlogEntry(githubFile.content, normalizedBlocks.blocks), githubFile.sha);

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

async function handleTerminalSu(request, env) {
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
        const target = String(body?.target || '').trim().toLowerCase();
        const password = typeof body?.password === 'string' ? body.password : '';

        if (target !== 'godlike') {
            return jsonResponse({ error: 'unsupported su target' }, 400, env.ALLOWED_ORIGIN, rateCheck.headers);
        }

        if (!timingSafeStringEqual(password, env.BLOG_IMAGE_DELETE_PASSWORD)) {
            return jsonResponse({ error: 'invalid password' }, 403, env.ALLOWED_ORIGIN, rateCheck.headers);
        }

        return jsonResponse({
            ok: true,
            user: 'godlike'
        }, 200, env.ALLOWED_ORIGIN, rateCheck.headers);
    } catch (error) {
        console.error('terminal su failed', error);
        return jsonResponse({ error: 'failed to authenticate terminal user' }, 500, env.ALLOWED_ORIGIN);
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
        const imageUrl = normalizeImageUrl(body?.imageUrl);
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
            !imageUrl &&
            !entryTimestamp
        ) {
            return jsonResponse({ error: 'imageBlockIndex, imageKey, imageDataUrl, imageUrl, or entryTimestamp is required' }, 400, env.ALLOWED_ORIGIN, rateCheck.headers);
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
            targetImageUrl: imageUrl,
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

        if (removal.removedBlock) {
            try {
                await cleanupHostedImageBlock(env, removal.removedBlock);
            } catch (error) {
                console.error('hosted image cleanup failed', error);
            }
        }

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

async function handleDeleteText(request, env) {
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
        const entryTimestamp = normalizeBlogEntryTimestamp(body?.entryTimestamp);
        const entryTextBlockIndex = Number.isInteger(body?.entryTextBlockIndex)
            ? body.entryTextBlockIndex
            : Number.parseInt(body?.entryTextBlockIndex, 10);
        const textKey = typeof body?.textKey === 'string' ? body.textKey.trim() : '';
        const previousImageKey = typeof body?.previousImageKey === 'string' ? body.previousImageKey.trim() : '';
        const nextImageKey = typeof body?.nextImageKey === 'string' ? body.nextImageKey.trim() : '';

        if (!timingSafeStringEqual(password, env.BLOG_IMAGE_DELETE_PASSWORD)) {
            return jsonResponse({ error: 'invalid password' }, 403, env.ALLOWED_ORIGIN, rateCheck.headers);
        }

        if (
            !entryTimestamp
            || (
                (!Number.isInteger(entryTextBlockIndex) || entryTextBlockIndex < 0)
                && !textKey
            )
        ) {
            return jsonResponse({ error: 'entryTimestamp and entryTextBlockIndex or textKey are required' }, 400, env.ALLOWED_ORIGIN, rateCheck.headers);
        }

        const githubFile = await fetchGithubFile(env);
        const deploymentStatus = await ensurePublishedBlogIsCurrent(env, githubFile.content);
        if (!deploymentStatus.ok) {
            return jsonResponse({ error: deploymentStatus.error }, 409, env.ALLOWED_ORIGIN, rateCheck.headers);
        }

        const removal = removeTextBlock(githubFile.content, {
            targetEntryTimestamp: entryTimestamp,
            targetTextBlockIndex: Number.isInteger(entryTextBlockIndex) && entryTextBlockIndex >= 0
                ? entryTextBlockIndex
                : null,
            targetTextKey: textKey,
            targetPreviousImageKey: previousImageKey,
            targetNextImageKey: nextImageKey
        });
        if (!removal.removed) {
            return jsonResponse({ error: 'text block not found in blog.txt' }, 404, env.ALLOWED_ORIGIN, rateCheck.headers);
        }

        const commit = await updateGithubFile(
            env,
            removal.content,
            githubFile.sha,
            'Delete blog text block via terminal site'
        );

        return jsonResponse({
            ok: true,
            commitSha: commit.sha,
            commitUrl: `https://github.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/commit/${commit.sha}`
        }, 200, env.ALLOWED_ORIGIN, rateCheck.headers);
    } catch (error) {
        console.error('delete text failed', error);
        return jsonResponse({ error: 'failed to delete blog text block' }, 500, env.ALLOWED_ORIGIN);
    }
}

async function handleDeleteEntry(request, env) {
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
        const entryTimestamp = normalizeBlogEntryTimestamp(body?.entryTimestamp);

        if (!timingSafeStringEqual(password, env.BLOG_IMAGE_DELETE_PASSWORD)) {
            return jsonResponse({ error: 'invalid password' }, 403, env.ALLOWED_ORIGIN, rateCheck.headers);
        }

        if (!entryTimestamp) {
            return jsonResponse({ error: 'entryTimestamp is required' }, 400, env.ALLOWED_ORIGIN, rateCheck.headers);
        }

        const githubFile = await fetchGithubFile(env);
        const deploymentStatus = await ensurePublishedBlogIsCurrent(env, githubFile.content);
        if (!deploymentStatus.ok) {
            return jsonResponse({ error: deploymentStatus.error }, 409, env.ALLOWED_ORIGIN, rateCheck.headers);
        }

        const removal = removeBlogEntry(githubFile.content, {
            targetEntryTimestamp: entryTimestamp
        });
        if (!removal.removed) {
            return jsonResponse({ error: 'entry not found in blog.txt' }, 404, env.ALLOWED_ORIGIN, rateCheck.headers);
        }

        const commit = await updateGithubFile(
            env,
            removal.content,
            githubFile.sha,
            'Delete blog entry via terminal site'
        );

        if (removal.removedEntry) {
            for (const block of removal.removedEntry.blocks) {
                if (block.type !== 'image' || !block.imageUrl) {
                    continue;
                }

                try {
                    await cleanupHostedImageBlock(env, block);
                } catch (error) {
                    console.error('hosted image cleanup failed', error);
                }
            }
        }

        return jsonResponse({
            ok: true,
            commitSha: commit.sha,
            commitUrl: `https://github.com/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/commit/${commit.sha}`
        }, 200, env.ALLOWED_ORIGIN, rateCheck.headers);
    } catch (error) {
        console.error('delete entry failed', error);
        return jsonResponse({ error: 'failed to delete blog entry' }, 500, env.ALLOWED_ORIGIN);
    }
}

async function handleHostedBlogMedia(request, env) {
    try {
        const url = new URL(request.url);
        const pathSegments = url.pathname.replace(/^\/+|\/+$/g, '').split('/');
        if (pathSegments.length < 5) {
            return new Response('not found', {
                status: 404,
                headers: corsHeaders(env.ALLOWED_ORIGIN)
            });
        }

        const provider = normalizeHostedImageProvider(pathSegments[3]);
        if (!provider) {
            return new Response('not found', {
                status: 404,
                headers: corsHeaders(env.ALLOWED_ORIGIN)
            });
        }

        if (provider === 'r2') {
            const storageKey = decodeBase64Url(pathSegments[4] || '');
            if (!storageKey || !env.BLOG_GIF_R2_BUCKET) {
                return new Response('not found', {
                    status: 404,
                    headers: corsHeaders(env.ALLOWED_ORIGIN)
                });
            }

            const decision = await getR2QuotaDecision(env, 'read');
            if (!decision.allowed) {
                return new Response('r2 media temporarily unavailable', {
                    status: 503,
                    headers: {
                        'Cache-Control': 'no-store',
                        ...corsHeaders(env.ALLOWED_ORIGIN)
                    }
                });
            }

            const object = await env.BLOG_GIF_R2_BUCKET.get(storageKey);
            await recordR2ReadUsage(env);
            if (!object) {
                return new Response('not found', {
                    status: 404,
                    headers: corsHeaders(env.ALLOWED_ORIGIN)
                });
            }

              return new Response(await object.arrayBuffer(), {
                  status: 200,
                  headers: {
                      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
                      'Cache-Control': 'public, max-age=31536000, immutable',
                      ...corsHeaders(env.ALLOWED_ORIGIN)
                  }
            });
        }

        const fileId = decodeURIComponent(pathSegments[4] || '').trim();
        if (!fileId) {
            return new Response('not found', {
                status: 404,
                headers: corsHeaders(env.ALLOWED_ORIGIN)
            });
        }

        const b2Decision = await getB2QuotaDecision(env, 'read');
        if (!b2Decision.allowed) {
            return new Response('b2 media temporarily unavailable', {
                status: 503,
                headers: {
                    'Cache-Control': 'no-store',
                    ...corsHeaders(env.ALLOWED_ORIGIN)
                }
            });
        }

        const b2Response = await downloadPrivateB2FileById(env, fileId);
        if (!b2Response.ok) {
            return new Response('not found', {
                status: b2Response.status === 404 ? 404 : 502,
                headers: corsHeaders(env.ALLOWED_ORIGIN)
            });
        }

        await recordB2ReadUsage(env);

          return new Response(await b2Response.arrayBuffer(), {
              status: 200,
              headers: {
                  'Content-Type': b2Response.headers.get('Content-Type') || 'application/octet-stream',
                  'Cache-Control': 'public, max-age=31536000, immutable',
                  ...corsHeaders(env.ALLOWED_ORIGIN)
              }
        });
    } catch (error) {
        console.error('hosted blog media failed', error);
        return new Response('unable to load media', {
            status: 500,
            headers: corsHeaders(env.ALLOWED_ORIGIN)
        });
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
    if (!ALLOWED_BLOG_POST_MEDIA_MIME_TYPES.has(mimeType)) {
        return {
            ok: false,
            error: 'imageDataUrl must be png, jpg, jpeg, webp, gif, or mp4'
        };
    }

    return { ok: true };
}

function validateCompactImagePayload({ mimeType, byteLength, encodedPayload, requirePayload = true }) {
    const normalizedMimeType = String(mimeType || '').trim().toLowerCase();
    const normalizedByteLength = Number.parseInt(byteLength, 10);
    const normalizedEncodedPayload = typeof encodedPayload === 'string'
        ? encodedPayload.trim()
        : '';

    if (!BLOG_COMPACT_IMAGE_MIME_TYPES.has(normalizedMimeType)) {
        return {
            ok: false,
            error: 'compact image payload must be gif'
        };
    }

    if (!Number.isInteger(normalizedByteLength) || normalizedByteLength <= 0) {
        return {
            ok: false,
            error: 'compact image payload must include a positive byteLength'
        };
    }

    if (!normalizedEncodedPayload && !requirePayload) {
        return {
            ok: true,
            mimeType: normalizedMimeType,
            byteLength: normalizedByteLength,
            encodedPayload: ''
        };
    }

    if (!normalizedEncodedPayload || normalizedEncodedPayload.length % 5 !== 0) {
        return {
            ok: false,
            error: 'compact image payload must include a valid encodedPayload'
        };
    }

    if (!/^[0-9a-zA-Z.\-:+=\^!/*?&<>()\[\]{}@%$#]+$/.test(normalizedEncodedPayload)) {
        return {
            ok: false,
            error: 'compact image payload contains unsupported characters'
        };
    }

    return {
        ok: true,
        mimeType: normalizedMimeType,
        byteLength: normalizedByteLength,
        encodedPayload: normalizedEncodedPayload
    };
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

function normalizeImageUrl(value) {
    try {
        const parsed = new URL(String(value || '').trim());
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return '';
        }
        return parsed.toString();
    } catch {
        return '';
    }
}

function normalizeHostedImageProvider(value) {
    const normalizedValue = String(value || '').trim().toLowerCase();
    return BLOG_HOSTED_IMAGE_PROVIDERS.has(normalizedValue) ? normalizedValue : '';
}

function parseImageDataUrlParts(value) {
    const match = /^data:([^;]+);base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(String(value || '').trim());
    if (!match) {
        return null;
    }

    return {
        mimeType: match[1].toLowerCase(),
        base64Payload: match[2].replace(/\s+/g, '')
    };
}

function toComparableImageValue(value) {
    const normalizedDataUrl = normalizeImageDataUrl(value);
    if (normalizedDataUrl) {
        return normalizedDataUrl;
    }

    const normalizedValue = String(value || '').trim();
    return normalizedValue || '';
}

function createBlogStableBlockKey(value) {
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) {
        return '';
    }

    let hash = 2166136261;
    for (let index = 0; index < normalizedValue.length; index += 1) {
        hash ^= normalizedValue.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return `${normalizedValue.length}:${(hash >>> 0).toString(16)}`;
}

export function createBlogImageKey(value) {
    const comparableValue = toComparableImageValue(value);
    return createBlogStableBlockKey(comparableValue);
}

export function createBlogTextBlockKey(lines) {
    const normalizedLines = Array.isArray(lines)
        ? lines.map(line => String(line ?? ''))
        : String(lines || '').replace(/\r\n/g, '\n').split('\n');
    return createBlogStableBlockKey(normalizedLines.join('\n'));
}

function decodeBase64ToBytes(value) {
    const binary = atob(String(value || '').replace(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
}

function encodeBytesToZ85(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
        return '';
    }

    const paddedLength = Math.ceil(bytes.length / 4) * 4;
    const padded = new Uint8Array(paddedLength);
    padded.set(bytes);
    const segments = [];
    let segment = [];

    for (let index = 0; index < padded.length; index += 4) {
        let value =
            (padded[index] * 16777216) +
            ((padded[index + 1] || 0) << 16) +
            ((padded[index + 2] || 0) << 8) +
            (padded[index + 3] || 0);
        const chunk = new Array(5);

        for (let characterIndex = 4; characterIndex >= 0; characterIndex -= 1) {
            chunk[characterIndex] = BLOG_Z85_ALPHABET[value % 85];
            value = Math.floor(value / 85);
        }

        segment.push(chunk.join(''));
        if (segment.length >= 4096) {
            segments.push(segment.join(''));
            segment = [];
        }
    }

    if (segment.length > 0) {
        segments.push(segment.join(''));
    }

    return segments.join('');
}

function createCompactImageBlock(imageDataUrl) {
    const parts = parseImageDataUrlParts(imageDataUrl);
    if (!parts || !BLOG_COMPACT_IMAGE_MIME_TYPES.has(parts.mimeType)) {
        return {
            type: 'image',
            imageDataUrl: normalizeImageDataUrl(imageDataUrl)
        };
    }

    const imageBytes = decodeBase64ToBytes(parts.base64Payload);
    return {
        type: 'image',
        imageEncoding: 'z85',
        mimeType: parts.mimeType,
        byteLength: imageBytes.length,
        encodedPayload: encodeBytesToZ85(imageBytes)
    };
}

function createHostedImageBlock({
    imageUrl,
    mimeType = 'image/gif',
    storageProvider,
    storageKey,
    storageFileId = '',
    storageBytes = 0
}) {
    const normalizedImageUrl = normalizeImageUrl(imageUrl);
    const normalizedMimeType = String(mimeType || '').trim().toLowerCase();
    const normalizedStorageProvider = normalizeHostedImageProvider(storageProvider);
    const normalizedStorageKey = String(storageKey || '').trim();
    const normalizedStorageFileId = String(storageFileId || '').trim();
    const normalizedStorageBytes = normalizeStorageBytes(storageBytes);
    const fallbackMimeType = normalizedMimeType || 'image/gif';

    if (
        !normalizedImageUrl ||
        !normalizedStorageProvider ||
        !normalizedStorageKey ||
        !BLOG_HOSTED_MEDIA_MIME_TYPES.has(fallbackMimeType)
    ) {
        return null;
    }

    return {
        type: 'image',
        imageUrl: normalizedImageUrl,
        mimeType: fallbackMimeType,
        storageProvider: normalizedStorageProvider,
        storageKey: normalizedStorageKey,
        ...(normalizedStorageFileId ? { storageFileId: normalizedStorageFileId } : {}),
        ...(normalizedStorageBytes > 0 ? { storageBytes: normalizedStorageBytes } : {})
    };
}

function createStoredImageComparisonValue(block) {
    if (!block || block.type !== 'image') {
        return '';
    }

    if (typeof block.imageUrl === 'string' && block.imageUrl) {
        return block.imageUrl;
    }

    if (typeof block.imageDataUrl === 'string' && block.imageDataUrl) {
        return block.imageDataUrl;
    }

    if (block.imageEncoding === 'z85' && typeof block.encodedPayload === 'string' && block.encodedPayload) {
        return `z85:${String(block.mimeType || '').toLowerCase()}:${block.encodedPayload}`;
    }

    return '';
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

async function normalizeAppendContentBlocks({ contentBlocks, text, imageDataUrl, maxPostLength, maxImageDataUrlLength, env }) {
    if (contentBlocks) {
        const validated = validateContentBlocks(contentBlocks, maxPostLength, maxImageDataUrlLength);
        if (!validated.ok) {
            return validated;
        }
        return resolveStagedImageBlocks(validated.blocks, maxImageDataUrlLength, env);
    }

    const blocks = [];
    if (text) {
        blocks.push({ type: 'text', text });
    }
    if (imageDataUrl) {
        blocks.push({ type: 'image', imageDataUrl });
    }

    const validated = validateContentBlocks(blocks, maxPostLength, maxImageDataUrlLength);
    if (!validated.ok) {
        return validated;
    }
    return resolveStagedImageBlocks(validated.blocks, maxImageDataUrlLength, env);
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
                    error: `no more than ${MAX_IMAGE_ATTACHMENTS} media attachments are allowed per entry`
                };
            }

            if (block.imageEncoding === 'z85') {
                const compactValidation = validateCompactImagePayload({
                    mimeType: block.mimeType,
                    byteLength: block.byteLength,
                    encodedPayload: block.encodedPayload,
                    requirePayload: !sanitizeUploadToken(block.stagedUploadToken)
                });
                if (!compactValidation.ok) {
                    return compactValidation;
                }

                const stagedUploadToken = sanitizeUploadToken(block.stagedUploadToken);
                if (stagedUploadToken) {
                    normalized.push({
                        type: 'image',
                        stagedUploadToken,
                        imageEncoding: 'z85',
                        mimeType: compactValidation.mimeType,
                        byteLength: compactValidation.byteLength
                    });
                    continue;
                }

                normalized.push({
                    type: 'image',
                    imageEncoding: 'z85',
                    mimeType: compactValidation.mimeType,
                    byteLength: compactValidation.byteLength,
                    encodedPayload: compactValidation.encodedPayload
                });
                continue;
            }

            const stagedUploadToken = sanitizeUploadToken(block.stagedUploadToken);
            if (stagedUploadToken) {
                normalized.push({
                    type: 'image',
                    stagedUploadToken
                });
                continue;
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

async function resolveStagedImageBlocks(blocks, maxImageDataUrlLength, env) {
    const resolvedBlocks = [];

    for (const block of blocks) {
        if (block.type !== 'image' || !block.stagedUploadToken) {
            resolvedBlocks.push(block);
            continue;
        }

        if (block.imageEncoding === 'z85') {
            if (Number(block.byteLength || 0) >= LARGE_STAGED_COMPACT_IMAGE_BYTE_LENGTH) {
                resolvedBlocks.push(block);
                continue;
            }

            const stagedUpload = await consumeStagedImageUpload(env, block.stagedUploadToken);
            if (!stagedUpload.ok) {
                return stagedUpload;
            }

            const compactValidation = validateCompactImagePayload({
                mimeType: block.mimeType,
                byteLength: block.byteLength,
                encodedPayload: stagedUpload.dataUrl
            });
            if (!compactValidation.ok) {
                return compactValidation;
            }

            resolvedBlocks.push({
                type: 'image',
                imageEncoding: 'z85',
                mimeType: compactValidation.mimeType,
                byteLength: compactValidation.byteLength,
                encodedPayload: compactValidation.encodedPayload
            });
            continue;
        }

        const stagedUpload = await consumeStagedImageUpload(env, block.stagedUploadToken);
        if (!stagedUpload.ok) {
            return stagedUpload;
        }

          const imageValidation = validateImageDataUrl(stagedUpload.dataUrl, maxImageDataUrlLength);
          if (!imageValidation.ok) {
              return {
                  ok: false,
                  error: imageValidation.error
              };
          }

          const stagedImageParts = parseImageDataUrlParts(stagedUpload.dataUrl);
          const hostedMediaBlock = await uploadHostedBlogMediaToStorage(stagedUpload.dataUrl, env);
          if (stagedImageParts?.mimeType === 'video/mp4') {
              if (!hostedMediaBlock) {
                  return {
                      ok: false,
                      error: 'mp4 hosted media temporarily unavailable'
                  };
              }
              resolvedBlocks.push(hostedMediaBlock);
              continue;
          }

          if (!hostedMediaBlock && stagedImageParts?.mimeType === 'image/gif' && canStoreHostedBlogMedia(env)) {
              return {
                  ok: false,
                  error: 'gif hosted media temporarily unavailable'
              };
          }
          resolvedBlocks.push(hostedMediaBlock || createCompactImageBlock(stagedUpload.dataUrl));
      }

    const finalizedBlocks = [];
    for (const block of resolvedBlocks) {
        if (block.type !== 'image' || !block.imageDataUrl) {
            finalizedBlocks.push(block);
            continue;
          }

          const imageParts = parseImageDataUrlParts(block.imageDataUrl);
          const hostedMediaBlock = await uploadHostedBlogMediaToStorage(block.imageDataUrl, env);
          if (imageParts?.mimeType === 'video/mp4') {
              if (!hostedMediaBlock) {
                  return {
                      ok: false,
                      error: 'mp4 hosted media temporarily unavailable'
                  };
              }
              finalizedBlocks.push(hostedMediaBlock);
              continue;
          }

          if (!hostedMediaBlock && imageParts?.mimeType === 'image/gif' && canStoreHostedBlogMedia(env)) {
              return {
                  ok: false,
                  error: 'gif hosted media temporarily unavailable'
              };
          }
          finalizedBlocks.push(hostedMediaBlock || createCompactImageBlock(block.imageDataUrl));
      }

    return {
        ok: true,
        blocks: finalizedBlocks
    };
}

async function consumeStagedImageUpload(env, uploadToken) {
    if (!env.BLOG_UPLOAD_SESSION) {
        return {
            ok: false,
            error: 'staged upload binding not configured'
        };
    }

    const stub = getBlogUploadSessionStub(env, uploadToken);
    const response = await stub.fetch('https://blog-upload-session/consume', {
        method: 'POST'
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || typeof payload?.dataUrl !== 'string') {
        return {
            ok: false,
            error: payload?.error || 'unable to complete staged image upload'
        };
    }

    return {
        ok: true,
        dataUrl: payload.dataUrl
    };
}

async function fetchStagedUploadMeta(env, uploadToken) {
    const stub = getBlogUploadSessionStub(env, uploadToken);
    const response = await stub.fetch('https://blog-upload-session/meta', {
        method: 'POST'
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !Number.isInteger(payload?.totalChunks) || payload.totalChunks <= 0) {
        throw new Error(payload?.error || 'unable to inspect staged image upload');
    }

    return {
        totalChunks: payload.totalChunks
    };
}

async function fetchStagedUploadChunk(env, uploadToken, chunkIndex) {
    const stub = getBlogUploadSessionStub(env, uploadToken);
    const response = await stub.fetch('https://blog-upload-session/chunk', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            chunkIndex
        })
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || typeof payload?.chunk !== 'string') {
        throw new Error(payload?.error || `unable to read staged upload chunk ${chunkIndex}`);
    }

    return payload.chunk;
}

async function clearStagedUpload(env, uploadToken) {
    const stub = getBlogUploadSessionStub(env, uploadToken);
    await stub.fetch('https://blog-upload-session/clear', {
        method: 'POST'
    });
}

function canStoreHostedBlogMedia(env) {
    return Boolean(env.BLOG_GIF_R2_BUCKET || (env.B2_APPLICATION_KEY_ID && env.B2_APPLICATION_KEY && env.B2_BUCKET_ID));
}

function canUseR2Guardrails(env) {
    return Boolean(
        env.R2_QUOTA_GUARD &&
        env.BLOG_GIF_R2_BUCKET &&
        env.BLOG_GIF_R2_BUCKET_NAME &&
        env.CLOUDFLARE_ACCOUNT_ID &&
        env.CLOUDFLARE_BILLING_API_TOKEN
    );
}

function canUseB2Guardrails(env) {
    return Boolean(
        env.B2_QUOTA_GUARD &&
        env.B2_BUCKET_NAME
    );
}

function r2QuotaGuardRequestBody(env, action, bytesDelta = 0) {
    return {
        enabled: canUseR2Guardrails(env),
        action,
        bytesDelta: normalizeStorageBytes(bytesDelta),
        bucketName: String(env.BLOG_GIF_R2_BUCKET_NAME || '').trim(),
        accountId: String(env.CLOUDFLARE_ACCOUNT_ID || '').trim(),
        billingApiToken: String(env.CLOUDFLARE_BILLING_API_TOKEN || '').trim(),
        storageGbMonthThreshold: Number(env.R2_STORAGE_GUARD_GB_MONTH_THRESHOLD || DEFAULT_R2_STORAGE_GUARD_GB_MONTH_THRESHOLD),
        classAThreshold: Number(env.R2_CLASS_A_GUARD_THRESHOLD || DEFAULT_R2_CLASS_A_GUARD_THRESHOLD),
        classBThreshold: Number(env.R2_CLASS_B_GUARD_THRESHOLD || DEFAULT_R2_CLASS_B_GUARD_THRESHOLD),
        refreshMs: Number(env.R2_BILLING_REFRESH_MS || env.R2_ANALYTICS_REFRESH_MS || DEFAULT_R2_BILLING_REFRESH_MS),
        now: Date.now()
    };
}

function b2QuotaGuardRequestBody(env, action, bytesDelta = 0) {
    return {
        enabled: canUseB2Guardrails(env),
        action,
        bytesDelta: normalizeStorageBytes(bytesDelta),
        bucketName: String(env.B2_BUCKET_NAME || '').trim(),
        storageGbThreshold: Number(env.B2_STORAGE_GUARD_GB_THRESHOLD || DEFAULT_B2_STORAGE_GUARD_GB_THRESHOLD),
        classBThreshold: Number(env.B2_CLASS_B_GUARD_THRESHOLD || DEFAULT_B2_CLASS_B_GUARD_THRESHOLD),
        classCThreshold: Number(env.B2_CLASS_C_GUARD_THRESHOLD || DEFAULT_B2_CLASS_C_GUARD_THRESHOLD),
        refreshMs: Number(env.B2_USAGE_REFRESH_MS || DEFAULT_B2_USAGE_REFRESH_MS),
        githubOwner: String(env.GITHUB_OWNER || '').trim(),
        githubRepo: String(env.GITHUB_REPO || '').trim(),
        githubBranch: String(env.GITHUB_BRANCH || 'main').trim() || 'main',
        githubBlogPath: String(env.GITHUB_BLOG_PATH || 'blog.txt').trim() || 'blog.txt',
        githubPat: String(env.GITHUB_PAT || '').trim(),
        now: Date.now()
    };
}

async function getR2QuotaDecision(env, action, bytesDelta = 0) {
    if (!canUseR2Guardrails(env)) {
        return {
            allowed: true,
            reason: 'guard_disabled'
        };
    }

    const response = await getR2QuotaGuardStub(env).fetch('https://r2-quota/decision', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(r2QuotaGuardRequestBody(env, action, bytesDelta))
    });
    if (!response.ok) {
        return {
            allowed: true,
            reason: 'analytics_unavailable'
        };
    }

    const payload = await response.json().catch(() => null);
    return payload && typeof payload.allowed === 'boolean'
        ? payload
        : {
            allowed: true,
            reason: 'analytics_unavailable'
        };
}

async function getB2QuotaDecision(env, action, bytesDelta = 0) {
    if (!canUseB2Guardrails(env)) {
        return {
            allowed: true,
            reason: 'guard_disabled'
        };
    }

    const response = await getB2QuotaGuardStub(env).fetch('https://b2-quota/decision', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(b2QuotaGuardRequestBody(env, action, bytesDelta))
    });
    if (!response.ok) {
        return {
            allowed: true,
            reason: 'quota_unavailable'
        };
    }

    const payload = await response.json().catch(() => null);
    return payload && typeof payload.allowed === 'boolean'
        ? payload
        : {
            allowed: true,
            reason: 'quota_unavailable'
        };
}

async function recordR2WriteUsage(env, storageKey, bytes) {
    if (!canUseR2Guardrails(env) || !storageKey || normalizeStorageBytes(bytes) <= 0) {
        return;
    }

    await getR2QuotaGuardStub(env).fetch('https://r2-quota/record-write', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            storageKey,
            bytes,
            now: Date.now()
        })
    });
}

async function recordB2WriteUsage(env, storageKey, bytes) {
    if (!canUseB2Guardrails(env) || !storageKey || normalizeStorageBytes(bytes) <= 0) {
        return;
    }

    await getB2QuotaGuardStub(env).fetch('https://b2-quota/record-write', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ...b2QuotaGuardRequestBody(env, 'write', bytes),
            storageKey,
            bytes,
            now: Date.now()
        })
    });
}

async function recordR2ReadUsage(env) {
    if (!canUseR2Guardrails(env)) {
        return;
    }

    await getR2QuotaGuardStub(env).fetch('https://r2-quota/record-read', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            now: Date.now()
        })
    });
}

async function recordB2ReadUsage(env) {
    if (!canUseB2Guardrails(env)) {
        return;
    }

    await getB2QuotaGuardStub(env).fetch('https://b2-quota/record-read', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ...b2QuotaGuardRequestBody(env, 'read'),
            now: Date.now()
        })
    });
}

async function recordR2DeleteUsage(env, storageKey, bytes = 0) {
    if (!canUseR2Guardrails(env) || !storageKey) {
        return;
    }

    await getR2QuotaGuardStub(env).fetch('https://r2-quota/record-delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            storageKey,
            bytes,
            now: Date.now()
        })
    });
}

async function recordB2DeleteUsage(env, storageKey, bytes = 0) {
    if (!canUseB2Guardrails(env) || !storageKey) {
        return;
    }

    await getB2QuotaGuardStub(env).fetch('https://b2-quota/record-delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ...b2QuotaGuardRequestBody(env, 'delete', bytes),
            storageKey,
            bytes,
            now: Date.now()
        })
    });
}

function blogMediaBaseUrl(env) {
    return String(env.BLOG_MEDIA_BASE_URL || DEFAULT_BLOG_MEDIA_BASE_URL).trim().replace(/\/+$/g, '');
}

function encodeBase64Url(value) {
    return encodeBase64(value)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function decodeBase64Url(value) {
    const normalizedValue = String(value || '').trim().replace(/-/g, '+').replace(/_/g, '/');
    if (!normalizedValue) {
        return '';
    }

    const paddingLength = (4 - (normalizedValue.length % 4)) % 4;
    return decodeBase64(`${normalizedValue}${'='.repeat(paddingLength)}`);
}

async function sha1Hex(bytes) {
    const digest = await crypto.subtle.digest('SHA-1', bytes);
    return Array.from(new Uint8Array(digest))
        .map(value => value.toString(16).padStart(2, '0'))
        .join('');
}

function parseImageBytesFromDataUrl(imageDataUrl) {
    const parts = parseImageDataUrlParts(imageDataUrl);
    if (!parts) {
        return null;
    }

    return {
        mimeType: parts.mimeType,
        bytes: decodeBase64ToBytes(parts.base64Payload)
    };
}

function createHostedBlogMediaStorageKey(mimeType) {
    const normalizedMimeType = String(mimeType || '').trim().toLowerCase();
    const extension = normalizedMimeType === 'video/mp4' ? 'mp4' : 'gif';
    const directory = normalizedMimeType === 'video/mp4' ? 'blog-videos' : 'blog-gifs';
    return `${directory}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}.${extension}`;
}

function buildHostedBlogMediaUrl(env, storageProvider, storageKey, storageFileId = '') {
    const baseUrl = blogMediaBaseUrl(env);
    if (storageProvider === 'r2') {
        return `${baseUrl}/r2/${encodeBase64Url(storageKey)}`;
    }

    return `${baseUrl}/b2/${encodeURIComponent(storageFileId)}`;
}

async function uploadHostedBlogMediaToStorage(imageDataUrl, env) {
    const imageBytes = parseImageBytesFromDataUrl(imageDataUrl);
    if (!imageBytes || !BLOG_HOSTED_MEDIA_MIME_TYPES.has(imageBytes.mimeType) || !canStoreHostedBlogMedia(env)) {
        return null;
    }

    const storageKey = createHostedBlogMediaStorageKey(imageBytes.mimeType);

    if (env.BLOG_GIF_R2_BUCKET) {
        const decision = await getR2QuotaDecision(env, 'write', imageBytes.bytes.byteLength);
        if (decision.allowed) {
            try {
                await env.BLOG_GIF_R2_BUCKET.put(storageKey, imageBytes.bytes, {
                    httpMetadata: {
                        contentType: imageBytes.mimeType
                    }
                });
                await recordR2WriteUsage(env, storageKey, imageBytes.bytes.byteLength);

                return createHostedImageBlock({
                    imageUrl: buildHostedBlogMediaUrl(env, 'r2', storageKey),
                    mimeType: imageBytes.mimeType,
                    storageProvider: 'r2',
                    storageKey,
                    storageBytes: imageBytes.bytes.byteLength
                });
            } catch (error) {
                console.warn('R2 media upload failed, falling back to B2', error);
            }
        } else {
            console.warn(`R2 media upload guardrail active (${decision.reason}), falling back to B2`);
        }
    }

    if (!env.B2_APPLICATION_KEY_ID || !env.B2_APPLICATION_KEY || !env.B2_BUCKET_ID) {
        return null;
    }

    const b2Decision = await getB2QuotaDecision(env, 'write', imageBytes.bytes.byteLength);
    if (!b2Decision.allowed) {
        console.warn(`B2 media upload guardrail active (${b2Decision.reason}), refusing hosted media upload`);
        return null;
    }

    const uploadedFile = await uploadHostedBlogMediaToPrivateB2(env, storageKey, imageBytes.bytes, imageBytes.mimeType);
    await recordB2WriteUsage(env, uploadedFile.fileName, imageBytes.bytes.byteLength);
    return createHostedImageBlock({
        imageUrl: buildHostedBlogMediaUrl(env, 'b2', uploadedFile.fileName, uploadedFile.fileId),
        mimeType: imageBytes.mimeType,
        storageProvider: 'b2',
        storageKey: uploadedFile.fileName,
        storageFileId: uploadedFile.fileId,
        storageBytes: imageBytes.bytes.byteLength
    });
}

async function cleanupHostedImageBlock(env, block) {
    if (!block || block.type !== 'image') {
        return;
    }

    if (block.storageProvider === 'r2' && env.BLOG_GIF_R2_BUCKET && block.storageKey) {
        await env.BLOG_GIF_R2_BUCKET.delete(block.storageKey);
        await recordR2DeleteUsage(env, block.storageKey, block.storageBytes);
        return;
    }

    if (block.storageProvider === 'b2' && block.storageFileId && block.storageKey) {
        await deletePrivateB2File(env, block.storageFileId, block.storageKey);
        await recordB2DeleteUsage(env, block.storageKey, block.storageBytes);
    }
}

async function authorizeB2Account(env) {
    const basicToken = btoa(`${env.B2_APPLICATION_KEY_ID}:${env.B2_APPLICATION_KEY}`);
    const response = await fetch(B2_AUTHORIZE_ACCOUNT_URL, {
        headers: {
            Authorization: `Basic ${basicToken}`
        }
    });

    if (!response.ok) {
        throw new Error(`b2 authorize failed with ${response.status}`);
    }

    const payload = await response.json();
    if (!payload?.apiUrl || !payload?.downloadUrl || !payload?.authorizationToken) {
        throw new Error('b2 authorize response missing required fields');
    }

    return payload;
}

async function uploadHostedBlogMediaToPrivateB2(env, storageKey, bytes, mimeType) {
    const authorization = await authorizeB2Account(env);
    const uploadUrlResponse = await fetch(`${authorization.apiUrl}/b2api/v3/b2_get_upload_url`, {
        method: 'POST',
        headers: {
            Authorization: authorization.authorizationToken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            bucketId: env.B2_BUCKET_ID
        })
    });

    if (!uploadUrlResponse.ok) {
        throw new Error(`b2 get upload url failed with ${uploadUrlResponse.status}`);
    }

    const uploadUrlPayload = await uploadUrlResponse.json();
    const sha1 = await sha1Hex(bytes);
    const uploadResponse = await fetch(uploadUrlPayload.uploadUrl, {
        method: 'POST',
        headers: {
            Authorization: uploadUrlPayload.authorizationToken,
            'Content-Type': mimeType,
            'X-Bz-File-Name': storageKey,
            'X-Bz-Content-Sha1': sha1
        },
        body: bytes
    });

    if (!uploadResponse.ok) {
        throw new Error(`b2 upload failed with ${uploadResponse.status}`);
    }

    const uploadPayload = await uploadResponse.json();
    if (!uploadPayload?.fileId || !uploadPayload?.fileName) {
        throw new Error('b2 upload response missing file metadata');
    }

    return {
        fileId: uploadPayload.fileId,
        fileName: uploadPayload.fileName
    };
}

async function downloadPrivateB2FileById(env, fileId) {
    const authorization = await authorizeB2Account(env);
    return fetch(`${authorization.downloadUrl}/b2api/v3/b2_download_file_by_id?fileId=${encodeURIComponent(fileId)}`, {
        headers: {
            Authorization: authorization.authorizationToken
        }
    });
}

async function deletePrivateB2File(env, fileId, fileName) {
    const authorization = await authorizeB2Account(env);
    const response = await fetch(`${authorization.apiUrl}/b2api/v3/b2_delete_file_version`, {
        method: 'POST',
        headers: {
            Authorization: authorization.authorizationToken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            fileId,
            fileName
        })
    });

    if (!response.ok) {
        throw new Error(`b2 delete failed with ${response.status}`);
    }
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

function sanitizeUploadToken(value) {
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

async function clearBlogUploadSessionStorage(storage) {
    const stored = await storage.list();
    for (const key of stored.keys()) {
        await storage.delete(key);
    }
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
    if (shouldUseGithubGitDataApi(content, env)) {
        return updateGithubFileViaGitDataApi(env, content, message);
    }

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

async function updateGithubFileViaGitDataApi(env, content, message) {
    const headCommitSha = await fetchGithubBranchHeadSha(env);
    const headCommit = await fetchGithubCommit(env, headCommitSha);
    const blobSha = await createGithubBlob(env, content);
    const treeSha = await createGithubTree(env, headCommit.treeSha, blobSha);
    const commitSha = await createGithubCommit(env, message, treeSha, headCommitSha);
    await updateGithubBranchHead(env, commitSha);
    return { sha: commitSha };
}

async function appendBlogEntryViaStream(env, currentContent, contentBlocks, message = 'Append blog entry via terminal site') {
    const headCommitSha = await fetchGithubBranchHeadSha(env);
    const headCommit = await fetchGithubCommit(env, headCommitSha);
    const blobSha = await createGithubBlobFromAppendStream(env, currentContent, contentBlocks);
    const treeSha = await createGithubTree(env, headCommit.treeSha, blobSha);
    const commitSha = await createGithubCommit(env, message, treeSha, headCommitSha);
    await updateGithubBranchHead(env, commitSha);
    return { sha: commitSha };
}

async function createGithubBlobFromAppendStream(env, currentContent, contentBlocks, timestamp = new Date().toISOString()) {
    const response = await fetch(githubBlobsUrl(env), {
        method: 'POST',
        headers: {
            ...githubHeaders(env),
            'Content-Type': 'application/json'
        },
        body: createGithubBlobAppendRequestBodyStream(env, currentContent, contentBlocks, timestamp)
    });

    if (!response.ok) {
        const failureBody = await response.text();
        throw new Error(`github blob create failed with ${response.status}: ${failureBody}`);
    }

    const payload = await response.json();
    if (typeof payload?.sha !== 'string' || !payload.sha) {
        throw new Error('github blob create response did not include a blob sha');
    }

    return payload.sha;
}

function createGithubBlobAppendRequestBodyStream(env, currentContent, contentBlocks, timestamp) {
    const encoder = new TextEncoder();
    const entryTimestampLine = toBlogEntryTimestampLine(timestamp);
    const prefixPieces = [];
    const normalizedCurrentContent = normalizeComparableBlogContent(currentContent);

    if (normalizedCurrentContent) {
        prefixPieces.push(normalizedCurrentContent);
        if (!normalizedCurrentContent.endsWith('\n')) {
            prefixPieces.push('\n');
        }
        if (!normalizedCurrentContent.endsWith('\n\n')) {
            prefixPieces.push('\n');
        }
    }

    prefixPieces.push(entryTimestampLine, '\n');

    return new ReadableStream({
        async start(controller) {
            controller.enqueue(encoder.encode('{"content":"'));

            for (const piece of prefixPieces) {
                controller.enqueue(encoder.encode(escapeJsonString(piece)));
            }

            for (let index = 0; index < contentBlocks.length; index += 1) {
                const block = contentBlocks[index];

                if (block.type === 'text') {
                    const lines = Array.isArray(block.lines)
                        ? block.lines
                        : String(block.text || '').replace(/\r\n/g, '\n').split('\n');
                    const textContent = `${lines.join('\n')}\n`;
                    controller.enqueue(encoder.encode(escapeJsonString(textContent)));
                    continue;
                }

                if (block.type === 'image' && block.imageEncoding === 'z85' && block.stagedUploadToken) {
                    controller.enqueue(encoder.encode(escapeJsonString(`[image-z85]\nmime:${block.mimeType}\nbytes:${block.byteLength}\n`)));
                    const meta = await fetchStagedUploadMeta(env, block.stagedUploadToken);
                    for (let chunkIndex = 0; chunkIndex < meta.totalChunks; chunkIndex += 1) {
                        const chunk = await fetchStagedUploadChunk(env, block.stagedUploadToken, chunkIndex);
                        controller.enqueue(encoder.encode(escapeJsonString(chunk)));
                    }
                    controller.enqueue(encoder.encode(escapeJsonString('\n[/image-z85]\n')));
                    await clearStagedUpload(env, block.stagedUploadToken);
                    continue;
                }

                if (block.type === 'image' && block.imageEncoding === 'z85') {
                    controller.enqueue(encoder.encode(escapeJsonString(`[image-z85]\nmime:${block.mimeType}\nbytes:${block.byteLength}\n${block.encodedPayload}\n[/image-z85]\n`)));
                    continue;
                }

                if (block.type === 'image' && block.imageDataUrl) {
                    controller.enqueue(encoder.encode(escapeJsonString(`[image-base64]\n${block.imageDataUrl}\n[/image-base64]\n`)));
                }
            }

            controller.enqueue(encoder.encode('","encoding":"utf-8"}'));
            controller.close();
        }
    });
}

function escapeJsonString(value) {
    return String(value || '')
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\u0008/g, '\\b')
        .replace(/\u000C/g, '\\f')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}

function shouldUseGithubGitDataApi(content, env) {
    const contentBytes = new Blob([String(content || '')]).size;
    const projectedBase64Bytes = Math.ceil(contentBytes / 3) * 4;
    const limit = Number(env.GITHUB_CONTENTS_MAX_BASE64_BYTES || DEFAULT_GITHUB_CONTENTS_MAX_BASE64_BYTES);
    return projectedBase64Bytes >= limit;
}

async function fetchGithubBranchHeadSha(env) {
    const response = await fetch(githubGetRefUrl(env), {
        headers: githubHeaders(env)
    });

    if (!response.ok) {
        throw new Error(`github ref fetch failed with ${response.status}`);
    }

    const payload = await response.json();
    const commitSha = typeof payload?.object?.sha === 'string' ? payload.object.sha : '';
    if (!commitSha) {
        throw new Error('github ref response did not include a commit sha');
    }

    return commitSha;
}

async function fetchGithubCommit(env, sha) {
    const response = await fetch(githubCommitUrl(env, sha), {
        headers: githubHeaders(env)
    });

    if (!response.ok) {
        throw new Error(`github commit fetch failed with ${response.status}`);
    }

    const payload = await response.json();
    const treeSha = typeof payload?.tree?.sha === 'string' ? payload.tree.sha : '';
    if (!treeSha) {
        throw new Error('github commit response did not include a tree sha');
    }

    return {
        sha,
        treeSha
    };
}

async function createGithubBlob(env, content) {
    const response = await fetch(githubBlobsUrl(env), {
        method: 'POST',
        headers: {
            ...githubHeaders(env),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            content,
            encoding: 'utf-8'
        })
    });

    if (!response.ok) {
        const failureBody = await response.text();
        throw new Error(`github blob create failed with ${response.status}: ${failureBody}`);
    }

    const payload = await response.json();
    if (typeof payload?.sha !== 'string' || !payload.sha) {
        throw new Error('github blob create response did not include a blob sha');
    }

    return payload.sha;
}

async function createGithubTree(env, baseTreeSha, blobSha) {
    const response = await fetch(githubTreesUrl(env), {
        method: 'POST',
        headers: {
            ...githubHeaders(env),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            base_tree: baseTreeSha,
            tree: [
                {
                    path: githubFilePath(env),
                    mode: '100644',
                    type: 'blob',
                    sha: blobSha
                }
            ]
        })
    });

    if (!response.ok) {
        const failureBody = await response.text();
        throw new Error(`github tree create failed with ${response.status}: ${failureBody}`);
    }

    const payload = await response.json();
    if (typeof payload?.sha !== 'string' || !payload.sha) {
        throw new Error('github tree create response did not include a tree sha');
    }

    return payload.sha;
}

async function createGithubCommit(env, message, treeSha, parentSha) {
    const response = await fetch(githubCommitsUrl(env), {
        method: 'POST',
        headers: {
            ...githubHeaders(env),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message,
            tree: treeSha,
            parents: [parentSha]
        })
    });

    if (!response.ok) {
        const failureBody = await response.text();
        throw new Error(`github commit create failed with ${response.status}: ${failureBody}`);
    }

    const payload = await response.json();
    if (typeof payload?.sha !== 'string' || !payload.sha) {
        throw new Error('github commit create response did not include a commit sha');
    }

    return payload.sha;
}

async function updateGithubBranchHead(env, commitSha) {
    const response = await fetch(githubRefUrl(env), {
        method: 'PATCH',
        headers: {
            ...githubHeaders(env),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            sha: commitSha,
            force: false
        })
    });

    if (!response.ok) {
        const failureBody = await response.text();
        throw new Error(`github ref update failed with ${response.status}: ${failureBody}`);
    }
}

export function appendBlogEntry(currentContent, contentBlocks, timestamp = new Date().toISOString()) {
    const blogDocument = parseBlogDocument(currentContent);
    blogDocument.entries.push({
        timestampLine: toBlogEntryTimestampLine(timestamp),
        blocks: normalizeBlogEntryBlocks(contentBlocks)
    });
    return serializeBlogDocument(blogDocument);
}

export function removeBlogEntry(currentContent, {
    targetEntryTimestamp = ''
} = {}) {
    const blogDocument = parseBlogDocument(currentContent);
    const normalizedTargetEntryTimestamp = normalizeBlogEntryTimestamp(targetEntryTimestamp);
    if (!normalizedTargetEntryTimestamp) {
        return {
            removed: false,
            content: currentContent,
            removedEntry: null
        };
    }

    const entryIndex = blogDocument.entries.findIndex(entry => entry.timestampLine === normalizedTargetEntryTimestamp);
    if (entryIndex < 0) {
        return {
            removed: false,
            content: currentContent,
            removedEntry: null
        };
    }

    const [removedEntry] = blogDocument.entries.splice(entryIndex, 1);
    return {
        removed: true,
        content: serializeBlogDocument(blogDocument),
        removedEntry: removedEntry || null
    };
}

export function removeTextBlock(currentContent, {
    targetEntryTimestamp = '',
    targetTextBlockIndex = null,
    targetTextKey = '',
    targetPreviousImageKey = '',
    targetNextImageKey = ''
} = {}) {
    const blogDocument = parseBlogDocument(currentContent);
    const target = findTextBlockTarget(blogDocument.entries, {
        targetEntryTimestamp,
        targetTextBlockIndex,
        targetTextKey,
        targetPreviousImageKey,
        targetNextImageKey
    });

    if (!target) {
        return {
            removed: false,
            content: currentContent,
            removedBlock: null
        };
    }

    const entry = blogDocument.entries[target.entryIndex];
    const [removedBlock] = entry.blocks.splice(target.blockIndex, 1);
    if (entry.blocks.length === 0) {
        blogDocument.entries.splice(target.entryIndex, 1);
    }

    return {
        removed: true,
        content: serializeBlogDocument(blogDocument),
        removedBlock: removedBlock || null
    };
}

export function removeImageBlock(currentContent, {
    targetImageBlockIndex = null,
    targetImageKey = '',
    targetImageDataUrl = '',
    targetImageUrl = '',
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
        targetImageUrl,
        targetEntryTimestamp,
        targetEntryImageIndex,
        targetPreviousTextLine,
        targetNextTextLine
    });

    if (!target) {
        return {
            removed: false,
            content: currentContent,
            removedBlock: null
        };
    }

    const [removedBlock] = blogDocument.entries[target.entryIndex].blocks.splice(target.blockIndex, 1);
    return {
        removed: true,
        content: serializeBlogDocument(blogDocument),
        removedBlock: removedBlock || null
    };
}

function findTextBlockTarget(entries, {
    targetEntryTimestamp,
    targetTextBlockIndex,
    targetTextKey,
    targetPreviousImageKey,
    targetNextImageKey
}) {
    const normalizedTargetEntryTimestamp = normalizeBlogEntryTimestamp(targetEntryTimestamp);
    const normalizedTargetTextBlockIndex = Number.isInteger(targetTextBlockIndex)
        ? targetTextBlockIndex
        : Number.parseInt(targetTextBlockIndex, 10);
    const normalizedTargetTextKey = String(targetTextKey || '').trim();
    const normalizedTargetPreviousImageKey = String(targetPreviousImageKey || '').trim();
    const normalizedTargetNextImageKey = String(targetNextImageKey || '').trim();
    if (!normalizedTargetEntryTimestamp) {
        return null;
    }

    const entryIndex = entries.findIndex(entry => entry.timestampLine === normalizedTargetEntryTimestamp);
    if (entryIndex < 0) {
        return null;
    }

    const match = findTextBlockInEntry(entries[entryIndex], {
        targetTextBlockIndex: normalizedTargetTextBlockIndex,
        targetTextKey: normalizedTargetTextKey,
        targetPreviousImageKey: normalizedTargetPreviousImageKey,
        targetNextImageKey: normalizedTargetNextImageKey
    });
    if (!match) {
        return null;
    }

    return {
        entryIndex,
        blockIndex: match.blockIndex
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
        if (line !== '[image-base64]' && line !== '[image-z85]' && line !== '[image-url]') {
            textLines.push(line);
            continue;
        }

        flushTextLines();

        const imageLines = [];
        const isCompactImageBlock = line === '[image-z85]';
        const isHostedImageBlock = line === '[image-url]';
        const closingMarker = isCompactImageBlock
            ? '[/image-z85]'
            : isHostedImageBlock
                ? '[/image-url]'
                : '[/image-base64]';
        index += 1;
        while (index < entryLines.length && entryLines[index] !== closingMarker) {
            imageLines.push(entryLines[index]);
            index += 1;
        }

        if (index < entryLines.length && entryLines[index] === closingMarker) {
            if (isCompactImageBlock) {
                const compactImageBlock = parseCompactImageBlockLines(imageLines);
                if (compactImageBlock) {
                    blocks.push(compactImageBlock);
                    continue;
                }

                textLines.push('[image-z85]', ...imageLines, '[/image-z85]');
                continue;
            }

            if (isHostedImageBlock) {
                const hostedImageBlock = parseHostedImageBlockLines(imageLines);
                if (hostedImageBlock) {
                    blocks.push(hostedImageBlock);
                    continue;
                }

                textLines.push('[image-url]', ...imageLines, '[/image-url]');
                continue;
            }

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

        textLines.push(line, ...imageLines);
    }

    flushTextLines();
    return blocks;
}

function parseHostedImageBlockLines(imageLines) {
    if (!Array.isArray(imageLines) || imageLines.length < 4) {
        return null;
    }

    const blockData = {};
    for (const line of imageLines) {
        const match = /^([a-z-]+):([\s\S]+)$/i.exec(String(line || '').trim());
        if (!match) {
            return null;
        }

        blockData[match[1].toLowerCase()] = match[2].trim();
    }

    return createHostedImageBlock({
        imageUrl: blockData.src,
        mimeType: blockData.mime,
        storageProvider: blockData.provider,
        storageKey: blockData['storage-key'],
        storageFileId: blockData['storage-file-id'],
        storageBytes: blockData['storage-bytes']
    });
}

function parseCompactImageBlockLines(imageLines) {
    if (!Array.isArray(imageLines) || imageLines.length < 3) {
        return null;
    }

    const mimeTypeLine = String(imageLines[0] || '').trim();
    const byteLengthLine = String(imageLines[1] || '').trim();
    const mimeTypeMatch = /^mime:(.+)$/i.exec(mimeTypeLine);
    const byteLengthMatch = /^bytes:(\d+)$/i.exec(byteLengthLine);
    const encodedPayload = imageLines.slice(2).join('').trim();

    if (!mimeTypeMatch || !byteLengthMatch || !encodedPayload) {
        return null;
    }

    const mimeType = mimeTypeMatch[1].trim().toLowerCase();
    const byteLength = Number.parseInt(byteLengthMatch[1], 10);
      if (!BLOG_COMPACT_IMAGE_MIME_TYPES.has(mimeType) || !Number.isInteger(byteLength) || byteLength <= 0) {
          return null;
      }

    if (!/^[0-9a-zA-Z.\-:+=\^!/*?&<>()\[\]{}@%$#]+$/.test(encodedPayload)) {
        return null;
    }

    return {
        type: 'image',
        imageEncoding: 'z85',
        mimeType,
        byteLength,
        encodedPayload
    };
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
            if (block.imageUrl) {
                const hostedImageBlock = createHostedImageBlock({
                    imageUrl: block.imageUrl,
                    mimeType: block.mimeType,
                    storageProvider: block.storageProvider,
                    storageKey: block.storageKey,
                    storageFileId: block.storageFileId,
                    storageBytes: block.storageBytes
                });
                if (!hostedImageBlock) {
                    continue;
                }

                blocks.push(hostedImageBlock);
                continue;
            }

            if (block.imageEncoding === 'z85') {
                const mimeType = String(block.mimeType || '').trim().toLowerCase();
                const byteLength = Number.parseInt(block.byteLength, 10);
                const encodedPayload = typeof block.encodedPayload === 'string'
                    ? block.encodedPayload.trim()
                    : '';
                const stagedUploadToken = sanitizeUploadToken(block.stagedUploadToken);
                  if (!BLOG_COMPACT_IMAGE_MIME_TYPES.has(mimeType) || !Number.isInteger(byteLength) || byteLength <= 0 || (!encodedPayload && !stagedUploadToken)) {
                      continue;
                  }

                blocks.push({
                    type: 'image',
                    imageEncoding: 'z85',
                    mimeType,
                    byteLength,
                    ...(encodedPayload ? { encodedPayload } : {}),
                    ...(stagedUploadToken ? { stagedUploadToken } : {})
                });
                continue;
            }

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
                if (block.imageUrl) {
                    lines.push('[image-url]');
                    lines.push(`src:${block.imageUrl}`);
                    lines.push(`mime:${String(block.mimeType || 'image/gif').toLowerCase()}`);
                    lines.push(`provider:${block.storageProvider}`);
                    lines.push(`storage-key:${block.storageKey}`);
                if (block.storageFileId) {
                    lines.push(`storage-file-id:${block.storageFileId}`);
                }
                if (block.storageBytes) {
                    lines.push(`storage-bytes:${Number(block.storageBytes || 0)}`);
                }
                lines.push('[/image-url]');
                continue;
            }

                if (block.imageEncoding === 'z85') {
                    lines.push('[image-z85]');
                    lines.push(`mime:${String(block.mimeType || '').toLowerCase()}`);
                    lines.push(`bytes:${Number(block.byteLength || 0)}`);
                    lines.push(block.encodedPayload);
                    lines.push('[/image-z85]');
                    continue;
                }

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

function findTextBlockInEntry(entry, {
    targetTextBlockIndex,
    targetTextKey,
    targetPreviousImageKey,
    targetNextImageKey
}) {
    const textBlocks = [];
    let previousImageKey = '';

    for (let blockIndex = 0; blockIndex < entry.blocks.length; blockIndex += 1) {
        const block = entry.blocks[blockIndex];
        if (block.type === 'image') {
            previousImageKey = createBlogImageKey(createStoredImageComparisonValue(block));
            continue;
        }

        if (block.type !== 'text') {
            continue;
        }

        textBlocks.push({
            blockIndex,
            nextImageKey: findNextImageKeyInEntry(entry.blocks, blockIndex),
            previousImageKey,
            textIndex: textBlocks.length,
            textKey: createBlogTextBlockKey(block.lines)
        });
    }

    if (targetTextKey) {
        return selectExactTextBlockMatch(textBlocks.filter(block => block.textKey === targetTextKey), {
            targetTextBlockIndex,
            targetPreviousImageKey,
            targetNextImageKey
        });
    }

    if (Number.isInteger(targetTextBlockIndex) && targetTextBlockIndex >= 0) {
        return selectExactTextBlockMatch(textBlocks.filter(block => block.textIndex === targetTextBlockIndex), {
            targetTextBlockIndex,
            targetPreviousImageKey,
            targetNextImageKey
        });
    }

    return selectContextualTextBlockMatch(textBlocks, {
        targetTextBlockIndex,
        targetPreviousImageKey,
        targetNextImageKey
    });
}

function findNextImageKeyInEntry(entryBlocks, startBlockIndex) {
    for (let blockIndex = startBlockIndex + 1; blockIndex < entryBlocks.length; blockIndex += 1) {
        const block = entryBlocks[blockIndex];
        if (block.type === 'image') {
            return createBlogImageKey(createStoredImageComparisonValue(block));
        }
    }

    return '';
}

function selectExactTextBlockMatch(textBlocks, {
    targetTextBlockIndex,
    targetPreviousImageKey,
    targetNextImageKey
}) {
    if (textBlocks.length === 0) {
        return null;
    }

    let candidates = textBlocks;

    if (targetPreviousImageKey) {
        candidates = candidates.filter(block => block.previousImageKey === targetPreviousImageKey);
        if (candidates.length === 0) {
            return null;
        }
    }

    if (targetNextImageKey) {
        candidates = candidates.filter(block => block.nextImageKey === targetNextImageKey);
        if (candidates.length === 0) {
            return null;
        }
    }

    if (Number.isInteger(targetTextBlockIndex) && targetTextBlockIndex >= 0) {
        return candidates.find(block => block.textIndex === targetTextBlockIndex) || null;
    }

    return candidates.length === 1 ? candidates[0] : null;
}

function selectContextualTextBlockMatch(textBlocks, {
    targetTextBlockIndex,
    targetPreviousImageKey,
    targetNextImageKey
}) {
    let candidates = textBlocks;

    if (targetPreviousImageKey) {
        candidates = candidates.filter(block => block.previousImageKey === targetPreviousImageKey);
        if (candidates.length === 0) {
            return null;
        }
    }

    if (targetNextImageKey) {
        candidates = candidates.filter(block => block.nextImageKey === targetNextImageKey);
        if (candidates.length === 0) {
            return null;
        }
    }

    if (Number.isInteger(targetTextBlockIndex) && targetTextBlockIndex >= 0) {
        return candidates.find(block => block.textIndex === targetTextBlockIndex) || null;
    }

    if (targetPreviousImageKey || targetNextImageKey) {
        return candidates[0] || null;
    }

    return candidates.length === 1 ? candidates[0] : null;
}

function findImageBlockTarget(entries, {
    targetImageBlockIndex,
    targetImageKey,
    targetImageDataUrl,
    targetImageUrl,
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
    const normalizedTargetImageUrl = normalizeImageUrl(targetImageUrl);
    const normalizedTargetPreviousTextLine = String(targetPreviousTextLine || '').trim();
    const normalizedTargetNextTextLine = String(targetNextTextLine || '').trim();

    if (normalizedTargetEntryTimestamp) {
        const entryIndex = entries.findIndex(entry => entry.timestampLine === normalizedTargetEntryTimestamp);
        if (entryIndex >= 0) {
            const match = findImageBlockInEntry(entries[entryIndex], {
                targetImageKey,
                targetImageDataUrl: normalizedTargetImageDataUrl,
                targetImageUrl: normalizedTargetImageUrl,
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
        targetImageDataUrl: normalizedTargetImageDataUrl,
        targetImageUrl: normalizedTargetImageUrl
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
    targetImageUrl,
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
            imageUrl: block.imageUrl,
            imageKey: createBlogImageKey(createStoredImageComparisonValue(block)),
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

    if (targetImageUrl) {
        return selectExactImageBlockMatch(imageBlocks.filter(block => block.imageUrl === targetImageUrl), {
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

function findImageBlockAcrossEntries(entries, { targetImageKey, targetImageDataUrl, targetImageUrl }) {
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

            if (targetImageUrl && block.imageUrl === targetImageUrl) {
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

            if (targetImageKey && createBlogImageKey(createStoredImageComparisonValue(block)) === targetImageKey) {
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
    const path = githubFilePath(env);
    const branch = env.GITHUB_BRANCH || 'main';
    return `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
}

function githubFilePath(env) {
    return String(env.GITHUB_BLOG_PATH || 'blog.txt').trim().replace(/^\/+/g, '') || 'blog.txt';
}

function publishedBlogUrl(env) {
    const origin = String(env.ALLOWED_ORIGIN || '').trim().replace(/\/+$/g, '');
    const path = githubFilePath(env);
    if (!origin || !/^https?:\/\//i.test(origin)) {
        return '';
    }

    return `${origin}/${path}?t=${Date.now()}`;
}

function githubBlobUrl(env, sha) {
    return `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/blobs/${encodeURIComponent(sha)}`;
}

function githubBlobsUrl(env) {
    return `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/blobs`;
}

function githubTreesUrl(env) {
    return `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/trees`;
}

function githubCommitsUrl(env) {
    return `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/commits`;
}

function githubCommitUrl(env, sha) {
    return `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/commits/${encodeURIComponent(sha)}`;
}

function githubRefUrl(env) {
    return `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/refs/heads/${encodeURIComponent(env.GITHUB_BRANCH || 'main')}`;
}

function githubGetRefUrl(env) {
    return `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/ref/heads/${encodeURIComponent(env.GITHUB_BRANCH || 'main')}`;
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

function getBlogUploadSessionStub(env, uploadId) {
    const id = env.BLOG_UPLOAD_SESSION.idFromName(`upload:${uploadId}`);
    return env.BLOG_UPLOAD_SESSION.get(id);
}

function getR2QuotaGuardStub(env) {
    const id = env.R2_QUOTA_GUARD.idFromName('r2-monthly-guard');
    return env.R2_QUOTA_GUARD.get(id);
}

function getB2QuotaGuardStub(env) {
    const id = env.B2_QUOTA_GUARD.idFromName('b2-daily-guard');
    return env.B2_QUOTA_GUARD.get(id);
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
