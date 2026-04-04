import test from 'node:test';
import assert from 'node:assert/strict';

import blogWorker, { BlogUploadSession, VisitorCounter, appendBlogEntry, createBlogImageKey, removeImageBlock } from './index.js';

class FakeStorage {
    constructor() {
        this.data = new Map();
    }

    async get(key) {
        if (Array.isArray(key)) {
            const result = {};
            for (const item of key) {
                result[item] = this.data.get(item);
            }
            return result;
        }

        return this.data.get(key);
    }

    async put(key, value) {
        if (typeof key === 'object' && key !== null) {
            for (const [entryKey, entryValue] of Object.entries(key)) {
                this.data.set(entryKey, entryValue);
            }
            return;
        }
        this.data.set(key, value);
    }

    async delete(key) {
        this.data.delete(key);
    }

    async list({ prefix } = {}) {
        const result = new Map();
        for (const [key, value] of this.data.entries()) {
            if (!prefix || key.startsWith(prefix)) {
                result.set(key, value);
            }
        }
        return result;
    }
}

class FakeR2Bucket {
    constructor() {
        this.objects = new Map();
        this.failPut = null;
    }

    async put(key, value, options = {}) {
        if (this.failPut) {
            throw this.failPut;
        }

        const body = await new Response(value).arrayBuffer();
        this.objects.set(key, {
            body: new Uint8Array(body),
            httpMetadata: options.httpMetadata || {},
            customMetadata: options.customMetadata || {}
        });
        return {
            key
        };
    }

    async get(key) {
        const stored = this.objects.get(key);
        if (!stored) {
            return null;
        }

        return {
            httpMetadata: stored.httpMetadata,
            customMetadata: stored.customMetadata,
            async arrayBuffer() {
                return stored.body.buffer.slice(
                    stored.body.byteOffset,
                    stored.body.byteOffset + stored.body.byteLength
                );
            }
        };
    }

    async delete(key) {
        this.objects.delete(key);
    }
}

function createCounter() {
    const storage = new FakeStorage();
    return {
        counter: new VisitorCounter({ storage }),
        storage
    };
}

function createUploadSessionBinding() {
    const sessions = new Map();
    return {
        idFromName(name) {
            return name;
        },
        get(id) {
            if (!sessions.has(id)) {
                const session = new BlogUploadSession({ storage: new FakeStorage() });
                sessions.set(id, {
                    async fetch(url, options) {
                        return session.fetch(new Request(url, options));
                    }
                });
            }
            return sessions.get(id);
        }
    };
}

function createUploadSessionBindingWithMapReads() {
    const sessions = new Map();
    return {
        idFromName(name) {
            return name;
        },
        get(id) {
            if (!sessions.has(id)) {
                const storage = new FakeStorage();
                const originalGet = storage.get.bind(storage);
                storage.get = async key => {
                    if (Array.isArray(key)) {
                        const result = new Map();
                        for (const item of key) {
                            result.set(item, storage.data.get(item));
                        }
                        return result;
                    }
                    return originalGet(key);
                };

                const session = new BlogUploadSession({ storage });
                sessions.set(id, {
                    async fetch(url, options) {
                        return session.fetch(new Request(url, options));
                    }
                });
            }
            return sessions.get(id);
        }
    };
}

function createThrowingUploadSessionBinding() {
    return {
        idFromName(name) {
            return name;
        },
        get() {
            return {
                async fetch() {
                    throw new Error('simulated durable object staging failure');
                }
            };
        }
    };
}

function createAlwaysAllowRateLimiter() {
    return {
        idFromName(name) {
            return name;
        },
        get() {
            return {
                async fetch() {
                    return new Response(JSON.stringify({
                        allowed: true
                    }), {
                        status: 200,
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8'
                        }
                    });
                }
            };
        }
    };
}

test('trackVisitor persists totals and increments visits only on "visit" action', async () => {
    const { counter, storage } = createCounter();

    const firstVisit = await counter.trackVisitor('visitor-1', 'visit-1', 'visit');
    assert.deepEqual(firstVisit, { visits: 1, uniqueVisitors: 1, onSite: 1 });

    const heartbeat = await counter.trackVisitor('visitor-1', 'visit-1', 'heartbeat');
    assert.deepEqual(heartbeat, { visits: 1, uniqueVisitors: 1, onSite: 1 });

    const snapshot = await storage.get('snapshot');
    assert.equal(snapshot.visits, 1);
    assert.equal(snapshot.uniqueVisitors, 1);
    assert.equal(typeof snapshot.activeSessions['visit-1'], 'number');
});

test('unique visitor count does not increase for repeat visitor ids', async () => {
    const { counter } = createCounter();

    await counter.trackVisitor('visitor-1', 'visit-a', 'visit');
    const repeat = await counter.trackVisitor('visitor-1', 'visit-b', 'visit');

    assert.equal(repeat.visits, 2);
    assert.equal(repeat.uniqueVisitors, 1);
    assert.equal(repeat.onSite, 2);
});

test('removeVisit drops an active session and preserves historical totals', async () => {
    const { counter } = createCounter();

    await counter.trackVisitor('visitor-1', 'visit-a', 'visit');
    await counter.trackVisitor('visitor-2', 'visit-b', 'visit');

    const afterLeave = await counter.removeVisit('visit-a');
    assert.deepEqual(afterLeave, { visits: 2, uniqueVisitors: 2, onSite: 1 });
});

test('removeImageBlock prefers image key when the index is stale', () => {
    const imageA = 'data:image/png;base64,AAAA';
    const imageB = 'data:image/png;base64,BBBB';
    const currentContent = [
        '[2026-04-02T10:17:04.041Z]',
        'first image',
        '[image-base64]',
        imageA,
        '[/image-base64]',
        '',
        '[2026-04-02T10:19:04.041Z]',
        'second image',
        '[image-base64]',
        imageB,
        '[/image-base64]',
        ''
    ].join('\n');

    const removal = removeImageBlock(currentContent, {
        targetImageBlockIndex: 0,
        targetImageKey: createBlogImageKey(imageB)
    });

    assert.equal(removal.removed, true);
    assert.match(removal.content, /first image/);
    assert.match(removal.content, /second image/);
    assert.match(removal.content, /\[image-base64\]\ndata:image\/png;base64,AAAA\n\[\/image-base64\]/);
    assert.doesNotMatch(removal.content, /data:image\/png;base64,BBBB/);
    assert.ok(removal.content.endsWith('\n'));
});

test('removeImageBlock falls back to imageBlockIndex when imageKey is missing', () => {
    const imageA = 'data:image/png;base64,AAAA';
    const imageB = 'data:image/png;base64,BBBB';
    const currentContent = [
        '[2026-04-02T10:17:04.041Z]',
        'first image',
        '[image-base64]',
        imageA,
        '[/image-base64]',
        '',
        '[2026-04-02T10:19:04.041Z]',
        'second image',
        '[image-base64]',
        imageB,
        '[/image-base64]',
        ''
    ].join('\n');

    const removal = removeImageBlock(currentContent, {
        targetImageBlockIndex: 1
    });

    assert.equal(removal.removed, true);
    assert.match(removal.content, /first image/);
    assert.match(removal.content, /second image/);
    assert.match(removal.content, /\[image-base64\]\ndata:image\/png;base64,AAAA\n\[\/image-base64\]/);
    assert.doesNotMatch(removal.content, /data:image\/png;base64,BBBB/);
});

test('removeImageBlock can remove the matching entry image when index and key are stale', () => {
    const sharedImage = 'data:image/png;base64,AAAA';
    const currentContent = [
        '[2026-04-02T10:17:04.041Z]',
        'first image post',
        '[image-base64]',
        sharedImage,
        '[/image-base64]',
        '',
        '[2026-04-02T10:19:04.041Z]',
        'second image post',
        '[image-base64]',
        sharedImage,
        '[/image-base64]',
        ''
    ].join('\n');

    const removal = removeImageBlock(currentContent, {
        targetImageBlockIndex: 99,
        targetImageKey: 'stale-key',
        targetImageDataUrl: sharedImage,
        targetEntryTimestamp: '[2026-04-02T10:19:04.041Z]'
    });

    assert.equal(removal.removed, true);
    assert.match(removal.content, /\[2026-04-02T10:17:04\.041Z\][\s\S]*data:image\/png;base64,AAAA/);
    assert.match(removal.content, /second image post/);
    assert.doesNotMatch(removal.content, /\[2026-04-02T10:19:04\.041Z\]\nsecond image post\n\[image-base64\][\s\S]*?\[\/image-base64\]/);
    assert.match(removal.content, /\[2026-04-02T10:19:04\.041Z\]\nsecond image post\n$/);
});

test('removeImageBlock can target the correct image block within an entry by timestamp and entry image index', () => {
    const imageA = 'data:image/png;base64,AAAA';
    const imageB = 'data:image/png;base64,BBBB';
    const currentContent = [
        '[2026-04-02T10:17:04.041Z]',
        'multi image post',
        '[image-base64]',
        imageA,
        '[/image-base64]',
        'between images',
        '[image-base64]',
        imageB,
        '[/image-base64]',
        ''
    ].join('\n');

    const removal = removeImageBlock(currentContent, {
        targetImageBlockIndex: 99,
        targetImageKey: 'stale-key',
        targetEntryTimestamp: '[2026-04-02T10:17:04.041Z]',
        targetEntryImageIndex: 1
    });

    assert.equal(removal.removed, true);
    assert.match(removal.content, /multi image post/);
    assert.match(removal.content, /\[image-base64\]\ndata:image\/png;base64,AAAA\n\[\/image-base64\]/);
    assert.doesNotMatch(removal.content, /data:image\/png;base64,BBBB/);
});

test('removeImageBlock can remove the image block that follows a specific text line within an entry', () => {
    const imageA = 'data:image/png;base64,AAAA';
    const imageB = 'data:image/png;base64,BBBB';
    const imageC = 'data:image/png;base64,CCCC';
    const currentContent = [
        '[2026-04-02T10:17:04.041Z]',
        'testing image post',
        '[image-base64]',
        imageA,
        '[/image-base64]',
        'test2',
        '[image-base64]',
        imageB,
        '[/image-base64]',
        '[image-base64]',
        imageC,
        '[/image-base64]',
        ''
    ].join('\n');

    const removal = removeImageBlock(currentContent, {
        targetEntryTimestamp: '[2026-04-02T10:17:04.041Z]',
        targetPreviousTextLine: 'test2'
    });

    assert.equal(removal.removed, true);
    assert.match(removal.content, /\[image-base64\]\ndata:image\/png;base64,AAAA\n\[\/image-base64\]/);
    assert.match(removal.content, /test2/);
    assert.match(removal.content, /\[image-base64\]\ndata:image\/png;base64,CCCC\n\[\/image-base64\]/);
    assert.doesNotMatch(removal.content, /data:image\/png;base64,BBBB/);
});

test('removeImageBlock prefers image key for compact gif blocks when the index is stale', () => {
    const currentContent = [
        '[2026-04-02T10:17:04.041Z]',
        'first gif',
        '[image-z85]',
        'mime:image/gif',
        'bytes:8',
        'HELLOGIF',
        '[/image-z85]',
        '',
        '[2026-04-02T10:19:04.041Z]',
        'second gif',
        '[image-z85]',
        'mime:image/gif',
        'bytes:8',
        'BYEGIF!!',
        '[/image-z85]',
        ''
    ].join('\n');

    const removal = removeImageBlock(currentContent, {
        targetImageBlockIndex: 0,
        targetImageKey: createBlogImageKey('z85:image/gif:BYEGIF!!')
    });

    assert.equal(removal.removed, true);
    assert.match(removal.content, /\[image-z85\]\nmime:image\/gif\nbytes:8\nHELLOGIF\n\[\/image-z85\]/);
    assert.doesNotMatch(removal.content, /BYEGIF!!/);
});

test('removeImageBlock prefers image key for hosted image url blocks when the index is stale', () => {
    const mediaUrlA = `https://0x00c0de-blog-append.0x00c0de.workers.dev/api/blog/media/r2/${Buffer.from('blog-gifs/a.gif').toString('base64url')}`;
    const mediaUrlB = `https://0x00c0de-blog-append.0x00c0de.workers.dev/api/blog/media/b2/${encodeURIComponent('4_zbucket_f1048576_d20260403_m120000_c001_v0001001_t0042_u017')}`;
    const currentContent = [
        '[2026-04-02T10:17:04.041Z]',
        'first hosted gif',
        '[image-url]',
        `src:${mediaUrlA}`,
        'mime:image/gif',
        'provider:r2',
        'storage-key:blog-gifs/a.gif',
        '[/image-url]',
        '',
        '[2026-04-02T10:19:04.041Z]',
        'second hosted gif',
        '[image-url]',
        `src:${mediaUrlB}`,
        'mime:image/gif',
        'provider:b2',
        'storage-key:blog-gifs/b.gif',
        'storage-file-id:4_zbucket_f1048576_d20260403_m120000_c001_v0001001_t0042_u017',
        '[/image-url]',
        ''
    ].join('\n');

    const removal = removeImageBlock(currentContent, {
        targetImageBlockIndex: 0,
        targetImageKey: createBlogImageKey(mediaUrlB)
    });

    assert.equal(removal.removed, true);
    assert.match(removal.content, /first hosted gif/);
    assert.match(removal.content, /second hosted gif/);
    assert.match(removal.content, /\[image-url\]\nsrc:https:\/\/0x00c0de-blog-append\.0x00c0de\.workers\.dev\/api\/blog\/media\/r2\//);
    assert.doesNotMatch(removal.content, /storage-file-id:4_zbucket_f1048576_d20260403_m120000_c001_v0001001_t0042_u017/);
});

test('removeImageBlock does not delete a different image when retrying a stale delete after the original image is already gone', () => {
    const imageA = 'data:image/png;base64,AAAA';
    const imageB = 'data:image/png;base64,BBBB';
    const currentContent = [
        '[2026-04-02T10:17:04.041Z]',
        'testing image post',
        '[image-base64]',
        imageA,
        '[/image-base64]',
        '[image-base64]',
        imageB,
        '[/image-base64]',
        ''
    ].join('\n');

    const firstRemoval = removeImageBlock(currentContent, {
        targetEntryTimestamp: '[2026-04-02T10:17:04.041Z]',
        targetEntryImageIndex: 0,
        targetPreviousTextLine: 'testing image post',
        targetImageDataUrl: imageA
    });

    assert.equal(firstRemoval.removed, true);
    assert.doesNotMatch(firstRemoval.content, /data:image\/png;base64,AAAA/);
    assert.match(firstRemoval.content, /data:image\/png;base64,BBBB/);

    const secondRemoval = removeImageBlock(firstRemoval.content, {
        targetEntryTimestamp: '[2026-04-02T10:17:04.041Z]',
        targetEntryImageIndex: 0,
        targetPreviousTextLine: 'testing image post',
        targetImageDataUrl: imageA
    });

    assert.equal(secondRemoval.removed, false);
    assert.match(secondRemoval.content, /data:image\/png;base64,BBBB/);
});

test('appendBlogEntry and removeImageBlock use the same blog file serialization', () => {
    const initialContent = [
        '0x00C0DE Blog',
        '=============',
        'Header line',
        ''
    ].join('\n');

    const appended = appendBlogEntry(initialContent, [
        { type: 'text', text: 'testing image post' },
        { type: 'image', imageDataUrl: 'data:image/png;base64,AAAA' }
    ], '2026-04-02T10:17:04.041Z');

    assert.equal(appended, [
        '0x00C0DE Blog',
        '=============',
        'Header line',
        '',
        '[2026-04-02T10:17:04.041Z]',
        'testing image post',
        '[image-base64]',
        'data:image/png;base64,AAAA',
        '[/image-base64]',
        ''
    ].join('\n'));

    const removal = removeImageBlock(appended, {
        targetEntryTimestamp: '[2026-04-02T10:17:04.041Z]',
        targetEntryImageIndex: 0
    });

    assert.equal(removal.removed, true);
    assert.equal(removal.content, [
        '0x00C0DE Blog',
        '=============',
        'Header line',
        '',
        '[2026-04-02T10:17:04.041Z]',
        'testing image post',
        ''
    ].join('\n'));
});

test('append endpoint accepts gif image data urls and commits them to blog.txt in compact reversible form', async t => {
    const originalFetch = globalThis.fetch;
    let githubUpdateBody = null;

    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async (url, options = {}) => {
        const urlString = String(url);
        const method = options.method || 'GET';

        if (urlString === 'https://api.github.com/repos/owner/repo/contents/blog.txt?ref=main') {
            if (method === 'PUT') {
                githubUpdateBody = JSON.parse(options.body);
                return new Response(JSON.stringify({
                    commit: {
                        sha: 'newsha123'
                    }
                }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    }
                });
            }

            return new Response(JSON.stringify({
                sha: 'oldsha456',
                content: Buffer.from([
                    '0x00C0DE Blog',
                    '=============',
                    ''
                ].join('\n'), 'utf8').toString('base64')
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString.startsWith('https://0x00c0de.github.io/blog.txt?')) {
            return new Response([
                '0x00C0DE Blog',
                '=============',
                ''
            ].join('\n'), {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8'
                }
            });
        }

        throw new Error(`unexpected fetch: ${method} ${urlString}`);
    };

    const env = {
        ALLOWED_ORIGIN: 'https://0x00c0de.github.io',
        GITHUB_OWNER: 'owner',
        GITHUB_REPO: 'repo',
        GITHUB_PAT: 'token',
        GITHUB_BRANCH: 'main',
        RATE_LIMITER: {
            idFromName(name) {
                return name;
            },
            get() {
                return {
                    async fetch() {
                        return new Response(JSON.stringify({
                            allowed: true
                        }), {
                            status: 200,
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8'
                            }
                        });
                    }
                };
            }
        }
    };

    const gifDataUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==';
    const response = await blogWorker.fetch(new Request('https://example.com/api/blog/append', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contentBlocks: [
                { type: 'text', text: 'gif post' },
                { type: 'image', imageDataUrl: gifDataUrl }
            ]
        })
    }), env);

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
        ok: true,
        commitSha: 'newsha123',
        commitUrl: 'https://github.com/owner/repo/commit/newsha123'
    });
    assert.ok(githubUpdateBody, 'expected append request to update GitHub');
    assert.equal(githubUpdateBody.message, 'Append blog entry via terminal site');

    const updatedBlogContent = Buffer.from(githubUpdateBody.content, 'base64').toString('utf8');
    assert.match(updatedBlogContent, /\[image-z85\]/);
    assert.match(updatedBlogContent, /mime:image\/gif/);
    assert.match(updatedBlogContent, /bytes:\d+/);
    assert.doesNotMatch(updatedBlogContent, /data:image\/gif;base64,R0lGODlhAQABAIAAAAUEBA==/);
    assert.match(updatedBlogContent, /\[\/image-z85\]/);
});

test('append endpoint uploads gif image data urls to R2 and stores a hosted image-url block in blog.txt', async t => {
    const originalFetch = globalThis.fetch;
    let githubUpdateBody = null;
    const r2Bucket = new FakeR2Bucket();

    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async (url, options = {}) => {
        const urlString = String(url);
        const method = options.method || 'GET';

        if (urlString === 'https://api.github.com/repos/owner/repo/contents/blog.txt?ref=main') {
            if (method === 'PUT') {
                githubUpdateBody = JSON.parse(options.body);
                return new Response(JSON.stringify({
                    commit: {
                        sha: 'r2gif123'
                    }
                }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    }
                });
            }

            return new Response(JSON.stringify({
                sha: 'oldsha123',
                content: Buffer.from([
                    '0x00C0DE Blog',
                    '=============',
                    ''
                ].join('\n'), 'utf8').toString('base64')
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString.startsWith('https://0x00c0de.github.io/blog.txt?')) {
            return new Response([
                '0x00C0DE Blog',
                '=============',
                ''
            ].join('\n'), {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8'
                }
            });
        }

        throw new Error(`unexpected fetch: ${method} ${urlString}`);
    };

    const env = {
        ALLOWED_ORIGIN: 'https://0x00c0de.github.io',
        GITHUB_OWNER: 'owner',
        GITHUB_REPO: 'repo',
        GITHUB_PAT: 'token',
        GITHUB_BRANCH: 'main',
        BLOG_MEDIA_BASE_URL: 'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/blog/media',
        BLOG_GIF_R2_BUCKET: r2Bucket,
        RATE_LIMITER: createAlwaysAllowRateLimiter()
    };

    const response = await blogWorker.fetch(new Request('https://example.com/api/blog/append', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contentBlocks: [
                { type: 'text', text: 'hosted gif post' },
                { type: 'image', imageDataUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==' }
            ]
        })
    }), env);

    assert.equal(response.status, 201);
    const updatedBlogContent = Buffer.from(githubUpdateBody.content, 'base64').toString('utf8');
    assert.match(updatedBlogContent, /hosted gif post/);
    assert.match(updatedBlogContent, /\[image-url\]/);
    assert.match(updatedBlogContent, /src:https:\/\/0x00c0de-blog-append\.0x00c0de\.workers\.dev\/api\/blog\/media\/r2\//);
    assert.match(updatedBlogContent, /mime:image\/gif/);
    assert.match(updatedBlogContent, /provider:r2/);
    assert.match(updatedBlogContent, /storage-key:blog-gifs\//);
    assert.doesNotMatch(updatedBlogContent, /\[image-z85\]/);
    assert.doesNotMatch(updatedBlogContent, /data:image\/gif;base64/);
    assert.equal(r2Bucket.objects.size, 1);
    const uploaded = [...r2Bucket.objects.values()][0];
    assert.equal(Buffer.from(uploaded.body).toString('base64'), 'R0lGODlhAQABAIAAAAUEBA==');
    assert.equal(uploaded.httpMetadata.contentType, 'image/gif');
});

test('append endpoint falls back to private B2 when R2 gif upload fails', async t => {
    const originalFetch = globalThis.fetch;
    let githubUpdateBody = null;
    let b2UploadHeaders = null;
    const r2Bucket = new FakeR2Bucket();
    r2Bucket.failPut = new Error('simulated R2 quota failure');

    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async (url, options = {}) => {
        const urlString = String(url);
        const method = options.method || 'GET';

        if (urlString === 'https://api.github.com/repos/owner/repo/contents/blog.txt?ref=main') {
            if (method === 'PUT') {
                githubUpdateBody = JSON.parse(options.body);
                return new Response(JSON.stringify({
                    commit: {
                        sha: 'b2gif123'
                    }
                }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    }
                });
            }

            return new Response(JSON.stringify({
                sha: 'oldsha123',
                content: Buffer.from([
                    '0x00C0DE Blog',
                    '=============',
                    ''
                ].join('\n'), 'utf8').toString('base64')
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString.startsWith('https://0x00c0de.github.io/blog.txt?')) {
            return new Response([
                '0x00C0DE Blog',
                '=============',
                ''
            ].join('\n'), {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8'
                }
            });
        }

        if (urlString.includes('b2_authorize_account')) {
            return new Response(JSON.stringify({
                apiUrl: 'https://api001.backblazeb2.com',
                downloadUrl: 'https://f001.backblazeb2.com',
                authorizationToken: 'b2-auth-token'
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString.includes('b2_get_upload_url')) {
            return new Response(JSON.stringify({
                uploadUrl: 'https://pod-001.backblazeb2.com/b2api/v3/b2_upload_file/upload-001',
                authorizationToken: 'b2-upload-token'
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString.startsWith('https://pod-001.backblazeb2.com/b2api/v3/b2_upload_file/')) {
            b2UploadHeaders = options.headers;
            return new Response(JSON.stringify({
                fileId: 'b2-file-id-123',
                fileName: 'blog-gifs/uploaded.gif'
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        throw new Error(`unexpected fetch: ${method} ${urlString}`);
    };

    const env = {
        ALLOWED_ORIGIN: 'https://0x00c0de.github.io',
        GITHUB_OWNER: 'owner',
        GITHUB_REPO: 'repo',
        GITHUB_PAT: 'token',
        GITHUB_BRANCH: 'main',
        BLOG_MEDIA_BASE_URL: 'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/blog/media',
        BLOG_GIF_R2_BUCKET: r2Bucket,
        B2_APPLICATION_KEY_ID: 'key-id',
        B2_APPLICATION_KEY: 'app-key',
        B2_BUCKET_ID: 'bucket-id-123',
        B2_BUCKET_NAME: '0x00C0DE-github-b2',
        RATE_LIMITER: createAlwaysAllowRateLimiter()
    };

    const response = await blogWorker.fetch(new Request('https://example.com/api/blog/append', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contentBlocks: [
                { type: 'text', text: 'b2 fallback gif post' },
                { type: 'image', imageDataUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==' }
            ]
        })
    }), env);

    assert.equal(response.status, 201);
    const updatedBlogContent = Buffer.from(githubUpdateBody.content, 'base64').toString('utf8');
    assert.match(updatedBlogContent, /b2 fallback gif post/);
    assert.match(updatedBlogContent, /\[image-url\]/);
    assert.match(updatedBlogContent, /src:https:\/\/0x00c0de-blog-append\.0x00c0de\.workers\.dev\/api\/blog\/media\/b2\/b2-file-id-123/);
    assert.match(updatedBlogContent, /provider:b2/);
    assert.match(updatedBlogContent, /storage-key:blog-gifs\/uploaded\.gif/);
    assert.match(updatedBlogContent, /storage-file-id:b2-file-id-123/);
    assert.equal(r2Bucket.objects.size, 0);
    assert.equal(b2UploadHeaders.Authorization, 'b2-upload-token');
});

test('append endpoint accepts direct compact gif payloads and commits them to blog.txt', async t => {
    const originalFetch = globalThis.fetch;
    let githubUpdateBody = null;

    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async (url, options = {}) => {
        const urlString = String(url);
        const method = options.method || 'GET';

        if (urlString === 'https://api.github.com/repos/owner/repo/contents/blog.txt?ref=main') {
            if (method === 'PUT') {
                githubUpdateBody = JSON.parse(options.body);
                return new Response(JSON.stringify({
                    commit: {
                        sha: 'compactdirect123'
                    }
                }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    }
                });
            }

            return new Response(JSON.stringify({
                sha: 'compactdirectold456',
                content: Buffer.from([
                    '0x00C0DE Blog',
                    '=============',
                    ''
                ].join('\n'), 'utf8').toString('base64')
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString.startsWith('https://0x00c0de.github.io/blog.txt?')) {
            return new Response([
                '0x00C0DE Blog',
                '=============',
                ''
            ].join('\n'), {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8'
                }
            });
        }

        throw new Error(`unexpected fetch: ${method} ${urlString}`);
    };

    const env = {
        ALLOWED_ORIGIN: 'https://0x00c0de.github.io',
        GITHUB_OWNER: 'owner',
        GITHUB_REPO: 'repo',
        GITHUB_PAT: 'token',
        GITHUB_BRANCH: 'main',
        RATE_LIMITER: {
            idFromName(name) {
                return name;
            },
            get() {
                return {
                    async fetch() {
                        return new Response(JSON.stringify({
                            allowed: true
                        }), {
                            status: 200,
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8'
                            }
                        });
                    }
                };
            }
        }
    };

    const response = await blogWorker.fetch(new Request('https://example.com/api/blog/append', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contentBlocks: [
                { type: 'text', text: 'direct compact gif post' },
                { type: 'image', imageEncoding: 'z85', mimeType: 'image/gif', byteLength: 4, encodedPayload: 'abcde' }
            ]
        })
    }), env);

    assert.equal(response.status, 201);
    const updatedBlogContent = Buffer.from(githubUpdateBody.content, 'base64').toString('utf8');
    assert.match(updatedBlogContent, /direct compact gif post/);
    assert.match(updatedBlogContent, /\[image-z85\]\nmime:image\/gif\nbytes:4\nabcde\n\[\/image-z85\]/);
});

test('append endpoint can consume a staged image upload assembled from chunks', async t => {
    const originalFetch = globalThis.fetch;
    let githubUpdateBody = null;
    const uploadBinding = createUploadSessionBinding();

    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async (url, options = {}) => {
        const urlString = String(url);
        const method = options.method || 'GET';

        if (urlString === 'https://api.github.com/repos/owner/repo/contents/blog.txt?ref=main') {
            if (method === 'PUT') {
                githubUpdateBody = JSON.parse(options.body);
                return new Response(JSON.stringify({
                    commit: {
                        sha: 'chunksha123'
                    }
                }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    }
                });
            }

            return new Response(JSON.stringify({
                sha: 'chunkold456',
                content: Buffer.from([
                    '0x00C0DE Blog',
                    '=============',
                    ''
                ].join('\n'), 'utf8').toString('base64')
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString.startsWith('https://0x00c0de.github.io/blog.txt?')) {
            return new Response([
                '0x00C0DE Blog',
                '=============',
                ''
            ].join('\n'), {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8'
                }
            });
        }

        throw new Error(`unexpected fetch: ${method} ${urlString}`);
    };

    const env = {
        ALLOWED_ORIGIN: 'https://0x00c0de.github.io',
        GITHUB_OWNER: 'owner',
        GITHUB_REPO: 'repo',
        GITHUB_PAT: 'token',
        GITHUB_BRANCH: 'main',
        BLOG_UPLOAD_SESSION: uploadBinding,
        RATE_LIMITER: {
            idFromName(name) {
                return name;
            },
            get() {
                return {
                    async fetch() {
                        return new Response(JSON.stringify({
                            allowed: true
                        }), {
                            status: 200,
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8'
                            }
                        });
                    }
                };
            }
        }
    };

    const uploadId = 'upload-test-1';
    const dataUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==';
    const chunks = [
        dataUrl.slice(0, 12),
        dataUrl.slice(12, 24),
        dataUrl.slice(24)
    ];

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
        const stageResponse = await blogWorker.fetch(new Request('https://example.com/api/blog/upload-chunk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uploadId,
                chunkIndex,
                totalChunks: chunks.length,
                chunk: chunks[chunkIndex]
            })
        }), env);
        assert.equal(stageResponse.status, 200);
    }

    const appendResponse = await blogWorker.fetch(new Request('https://example.com/api/blog/append', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contentBlocks: [
                { type: 'text', text: 'chunked gif post' },
                { type: 'image', stagedUploadToken: uploadId }
            ]
        })
    }), env);

    assert.equal(appendResponse.status, 201);
    assert.deepEqual(await appendResponse.json(), {
        ok: true,
        commitSha: 'chunksha123',
        commitUrl: 'https://github.com/owner/repo/commit/chunksha123'
    });

    const updatedBlogContent = Buffer.from(githubUpdateBody.content, 'base64').toString('utf8');
    assert.match(updatedBlogContent, /chunked gif post/);
    assert.match(updatedBlogContent, /\[image-z85\]/);
    assert.match(updatedBlogContent, /mime:image\/gif/);
    assert.doesNotMatch(updatedBlogContent, /data:image\/gif;base64,R0lGODlhAQABAIAAAAUEBA==/);
});

test('append endpoint can consume a staged compact gif payload without converting it on the worker', async t => {
    const originalFetch = globalThis.fetch;
    let githubUpdateBody = null;
    const uploadBinding = createUploadSessionBinding();

    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async (url, options = {}) => {
        const urlString = String(url);
        const method = options.method || 'GET';

        if (urlString === 'https://api.github.com/repos/owner/repo/contents/blog.txt?ref=main') {
            if (method === 'PUT') {
                githubUpdateBody = JSON.parse(options.body);
                return new Response(JSON.stringify({
                    commit: {
                        sha: 'compactstage123'
                    }
                }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    }
                });
            }

            return new Response(JSON.stringify({
                sha: 'compactstageold456',
                content: Buffer.from([
                    '0x00C0DE Blog',
                    '=============',
                    ''
                ].join('\n'), 'utf8').toString('base64')
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString.startsWith('https://0x00c0de.github.io/blog.txt?')) {
            return new Response([
                '0x00C0DE Blog',
                '=============',
                ''
            ].join('\n'), {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8'
                }
            });
        }

        throw new Error(`unexpected fetch: ${method} ${urlString}`);
    };

    const env = {
        ALLOWED_ORIGIN: 'https://0x00c0de.github.io',
        GITHUB_OWNER: 'owner',
        GITHUB_REPO: 'repo',
        GITHUB_PAT: 'token',
        GITHUB_BRANCH: 'main',
        BLOG_UPLOAD_SESSION: uploadBinding,
        RATE_LIMITER: {
            idFromName(name) {
                return name;
            },
            get() {
                return {
                    async fetch() {
                        return new Response(JSON.stringify({
                            allowed: true
                        }), {
                            status: 200,
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8'
                            }
                        });
                    }
                };
            }
        }
    };

    const uploadId = 'upload-compact-gif-1';
    const chunks = ['ab', 'cde'];

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
        const stageResponse = await blogWorker.fetch(new Request('https://example.com/api/blog/upload-chunk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uploadId,
                chunkIndex,
                totalChunks: chunks.length,
                chunk: chunks[chunkIndex]
            })
        }), env);
        assert.equal(stageResponse.status, 200);
    }

    const appendResponse = await blogWorker.fetch(new Request('https://example.com/api/blog/append', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contentBlocks: [
                { type: 'text', text: 'staged compact gif post' },
                { type: 'image', stagedUploadToken: uploadId, imageEncoding: 'z85', mimeType: 'image/gif', byteLength: 4 }
            ]
        })
    }), env);

    assert.equal(appendResponse.status, 201);
    const updatedBlogContent = Buffer.from(githubUpdateBody.content, 'base64').toString('utf8');
    assert.match(updatedBlogContent, /staged compact gif post/);
    assert.match(updatedBlogContent, /\[image-z85\]\nmime:image\/gif\nbytes:4\nabcde\n\[\/image-z85\]/);
});

test('append endpoint streams large staged compact gif payloads directly into blog.txt without extra repo files', async t => {
    const originalFetch = globalThis.fetch;
    let blobCreateBodyText = '';
    let contentsPutCalls = 0;
    let refUpdateBody = null;
    const uploadBinding = createUploadSessionBinding();

    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async (url, options = {}) => {
        const urlString = String(url);
        const method = options.method || 'GET';

        if (urlString === 'https://api.github.com/repos/owner/repo/contents/blog.txt?ref=main') {
            if (method === 'PUT') {
                contentsPutCalls += 1;
                return new Response('unexpected contents put', { status: 500 });
            }

            return new Response(JSON.stringify({
                sha: 'streamold456',
                content: Buffer.from([
                    '0x00C0DE Blog',
                    '=============',
                    ''
                ].join('\n'), 'utf8').toString('base64')
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString === 'https://api.github.com/repos/owner/repo/git/ref/heads/main') {
            return new Response(JSON.stringify({
                object: {
                    sha: 'headcommitsha'
                }
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString === 'https://api.github.com/repos/owner/repo/git/commits/headcommitsha') {
            return new Response(JSON.stringify({
                tree: {
                    sha: 'basetreesha'
                }
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString === 'https://api.github.com/repos/owner/repo/git/blobs') {
            blobCreateBodyText = await new Response(options.body).text();
            return new Response(JSON.stringify({
                sha: 'streamblobsha'
            }), {
                status: 201,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString === 'https://api.github.com/repos/owner/repo/git/trees') {
            return new Response(JSON.stringify({
                sha: 'streamtreesha'
            }), {
                status: 201,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString === 'https://api.github.com/repos/owner/repo/git/commits' && method === 'POST') {
            return new Response(JSON.stringify({
                sha: 'streamcommitsha'
            }), {
                status: 201,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString === 'https://api.github.com/repos/owner/repo/git/refs/heads/main' && method === 'PATCH') {
            refUpdateBody = JSON.parse(options.body);
            return new Response(JSON.stringify({
                object: {
                    sha: 'streamcommitsha'
                }
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString.startsWith('https://0x00c0de.github.io/blog.txt?')) {
            return new Response([
                '0x00C0DE Blog',
                '=============',
                ''
            ].join('\n'), {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8'
                }
            });
        }

        throw new Error(`unexpected fetch: ${method} ${urlString}`);
    };

    const env = {
        ALLOWED_ORIGIN: 'https://0x00c0de.github.io',
        GITHUB_OWNER: 'owner',
        GITHUB_REPO: 'repo',
        GITHUB_PAT: 'token',
        GITHUB_BRANCH: 'main',
        BLOG_UPLOAD_SESSION: uploadBinding,
        RATE_LIMITER: {
            idFromName(name) {
                return name;
            },
            get() {
                return {
                    async fetch() {
                        return new Response(JSON.stringify({
                            allowed: true
                        }), {
                            status: 200,
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8'
                            }
                        });
                    }
                };
            }
        }
    };

    const uploadId = 'upload-stream-compact-gif';
    const chunks = ['ab', 'cde'];

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
        const stageResponse = await blogWorker.fetch(new Request('https://example.com/api/blog/upload-chunk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uploadId,
                chunkIndex,
                totalChunks: chunks.length,
                chunk: chunks[chunkIndex]
            })
        }), env);
        assert.equal(stageResponse.status, 200);
    }

    const appendResponse = await blogWorker.fetch(new Request('https://example.com/api/blog/append', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contentBlocks: [
                { type: 'text', text: 'streamed compact gif post' },
                { type: 'image', stagedUploadToken: uploadId, imageEncoding: 'z85', mimeType: 'image/gif', byteLength: 4000000 }
            ]
        })
    }), env);

    assert.equal(appendResponse.status, 201);
    assert.equal(contentsPutCalls, 0);
    assert.match(blobCreateBodyText, /"encoding":"utf-8"}/);
    assert.match(blobCreateBodyText, /streamed compact gif post/);
    assert.match(blobCreateBodyText, /\[image-z85\]\\nmime:image\/gif\\nbytes:4000000\\nabcde\\n\[\/image-z85\]/);
    assert.deepEqual(refUpdateBody, {
        sha: 'streamcommitsha',
        force: false
    });
});

test('upload-chunk endpoint accepts high chunk counts needed for large staged uploads', async () => {
    const env = {
        ALLOWED_ORIGIN: 'https://0x00c0de.github.io',
        BLOG_UPLOAD_SESSION: createUploadSessionBinding()
    };

    const response = await blogWorker.fetch(new Request('https://example.com/api/blog/upload-chunk', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            uploadId: 'upload-many-chunks',
            chunkIndex: 1536,
            totalChunks: 1537,
            chunk: 'data:image/gif;base64,AAAA'
        })
    }), env);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
        ok: true,
        staged: true,
        chunkIndex: 1536
    });
});

test('upload-chunk endpoint returns a json error when staged upload storage throws', async () => {
    const env = {
        ALLOWED_ORIGIN: 'https://0x00c0de.github.io',
        BLOG_UPLOAD_SESSION: createThrowingUploadSessionBinding()
    };

    const response = await blogWorker.fetch(new Request('https://example.com/api/blog/upload-chunk', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            uploadId: 'upload-throws',
            chunkIndex: 0,
            totalChunks: 1,
            chunk: 'data:image/gif;base64,AAAA'
        })
    }), env);

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
        error: 'unable to stage image upload right now'
    });
});

test('append endpoint can consume a staged image upload when chunk reads come back as a map', async t => {
    const originalFetch = globalThis.fetch;
    let githubUpdateBody = null;
    const uploadBinding = createUploadSessionBindingWithMapReads();

    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async (url, options = {}) => {
        const urlString = String(url);
        const method = options.method || 'GET';

        if (urlString === 'https://api.github.com/repos/owner/repo/contents/blog.txt?ref=main') {
            if (method === 'PUT') {
                githubUpdateBody = JSON.parse(options.body);
                return new Response(JSON.stringify({
                    commit: {
                        sha: 'mapsha123'
                    }
                }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    }
                });
            }

            return new Response(JSON.stringify({
                sha: 'mapold456',
                content: Buffer.from([
                    '0x00C0DE Blog',
                    '=============',
                    ''
                ].join('\n'), 'utf8').toString('base64')
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString.startsWith('https://0x00c0de.github.io/blog.txt?')) {
            return new Response([
                '0x00C0DE Blog',
                '=============',
                ''
            ].join('\n'), {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8'
                }
            });
        }

        throw new Error(`unexpected fetch: ${method} ${urlString}`);
    };

    const env = {
        ALLOWED_ORIGIN: 'https://0x00c0de.github.io',
        GITHUB_OWNER: 'owner',
        GITHUB_REPO: 'repo',
        GITHUB_PAT: 'token',
        GITHUB_BRANCH: 'main',
        BLOG_UPLOAD_SESSION: uploadBinding,
        RATE_LIMITER: {
            idFromName(name) {
                return name;
            },
            get() {
                return {
                    async fetch() {
                        return new Response(JSON.stringify({
                            allowed: true
                        }), {
                            status: 200,
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8'
                            }
                        });
                    }
                };
            }
        }
    };

    const uploadId = 'upload-test-map';
    const dataUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==';
    const chunks = [
        dataUrl.slice(0, 10),
        dataUrl.slice(10, 20),
        dataUrl.slice(20)
    ];

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
        const stageResponse = await blogWorker.fetch(new Request('https://example.com/api/blog/upload-chunk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                uploadId,
                chunkIndex,
                totalChunks: chunks.length,
                chunk: chunks[chunkIndex]
            })
        }), env);
        assert.equal(stageResponse.status, 200);
    }

    const appendResponse = await blogWorker.fetch(new Request('https://example.com/api/blog/append', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contentBlocks: [
                { type: 'text', text: 'map read gif post' },
                { type: 'image', stagedUploadToken: uploadId }
            ]
        })
    }), env);

    assert.equal(appendResponse.status, 201);
    const updatedBlogContent = Buffer.from(githubUpdateBody.content, 'base64').toString('utf8');
    assert.match(updatedBlogContent, /map read gif post/);
    assert.match(updatedBlogContent, /\[image-z85\]/);
    assert.match(updatedBlogContent, /mime:image\/gif/);
    assert.doesNotMatch(updatedBlogContent, /data:image\/gif;base64,R0lGODlhAQABAIAAAAUEBA==/);
});

test('append endpoint stores gif uploads as compact reversible text blocks in blog.txt', async t => {
    const originalFetch = globalThis.fetch;
    let githubUpdateBody = null;

    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async (url, options = {}) => {
        const urlString = String(url);
        const method = options.method || 'GET';

        if (urlString === 'https://api.github.com/repos/owner/repo/contents/blog.txt?ref=main') {
            if (method === 'PUT') {
                githubUpdateBody = JSON.parse(options.body);
                return new Response(JSON.stringify({
                    commit: {
                        sha: 'gifcompact123'
                    }
                }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    }
                });
            }

            return new Response(JSON.stringify({
                sha: 'gifold456',
                content: Buffer.from([
                    '0x00C0DE Blog',
                    '=============',
                    ''
                ].join('\n'), 'utf8').toString('base64')
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString.startsWith('https://0x00c0de.github.io/blog.txt?')) {
            return new Response([
                '0x00C0DE Blog',
                '=============',
                ''
            ].join('\n'), {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8'
                }
            });
        }

        throw new Error(`unexpected fetch: ${method} ${urlString}`);
    };

    const env = {
        ALLOWED_ORIGIN: 'https://0x00c0de.github.io',
        GITHUB_OWNER: 'owner',
        GITHUB_REPO: 'repo',
        GITHUB_PAT: 'token',
        GITHUB_BRANCH: 'main',
        RATE_LIMITER: {
            idFromName(name) {
                return name;
            },
            get() {
                return {
                    async fetch() {
                        return new Response(JSON.stringify({
                            allowed: true
                        }), {
                            status: 200,
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8'
                            }
                        });
                    }
                };
            }
        }
    };

    const appendResponse = await blogWorker.fetch(new Request('https://example.com/api/blog/append', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contentBlocks: [
                { type: 'text', text: 'compact gif post' },
                { type: 'image', imageDataUrl: 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==' }
            ]
        })
    }), env);

    assert.equal(appendResponse.status, 201);
    assert.deepEqual(await appendResponse.json(), {
        ok: true,
        commitSha: 'gifcompact123',
        commitUrl: 'https://github.com/owner/repo/commit/gifcompact123'
    });

    const updatedBlogContent = Buffer.from(githubUpdateBody.content, 'base64').toString('utf8');
    assert.match(updatedBlogContent, /compact gif post/);
    assert.match(updatedBlogContent, /\[image-z85\]\nmime:image\/gif\nbytes:\d+\n[\s\S]+?\n\[\/image-z85\]/);
    assert.doesNotMatch(updatedBlogContent, /data:image\/gif;base64/);
});

test('append endpoint preserves existing content when GitHub contents API returns metadata-only for a large blog.txt', async t => {
    const originalFetch = globalThis.fetch;
    let currentSha = 'sha-1';
    let currentContent = [
        '0x00C0DE Blog',
        '=============',
        'Header line',
        '',
        '[2026-04-02T09:00:00.000Z]',
        'existing entry',
        ''
    ].join('\n');

    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async (url, options = {}) => {
        const urlString = String(url);
        const method = options.method || 'GET';

        if (urlString === 'https://api.github.com/repos/owner/repo/contents/blog.txt?ref=main') {
            if (method === 'PUT') {
                const body = JSON.parse(options.body);
                currentContent = Buffer.from(body.content, 'base64').toString('utf8');
                currentSha = `sha-${Number(currentSha.split('-')[1]) + 1}`;
                return new Response(JSON.stringify({
                    commit: {
                        sha: currentSha
                    }
                }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    }
                });
            }

            return new Response(JSON.stringify({
                sha: currentSha,
                encoding: 'none',
                content: ''
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString === `https://api.github.com/repos/owner/repo/git/blobs/${currentSha}`) {
            return new Response(JSON.stringify({
                encoding: 'base64',
                content: Buffer.from(currentContent, 'utf8').toString('base64')
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString.startsWith('https://0x00c0de.github.io/blog.txt?')) {
            return new Response(currentContent, {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8'
                }
            });
        }

        if (urlString.startsWith('https://0x00c0de.github.io/blog.txt?')) {
            return new Response([
                '0x00C0DE Blog',
                '=============',
                ''
            ].join('\n'), {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8'
                }
            });
        }

        throw new Error(`unexpected fetch: ${method} ${urlString}`);
    };

    const env = {
        ALLOWED_ORIGIN: 'https://0x00c0de.github.io',
        GITHUB_OWNER: 'owner',
        GITHUB_REPO: 'repo',
        GITHUB_PAT: 'token',
        GITHUB_BRANCH: 'main',
        RATE_LIMITER: {
            idFromName(name) {
                return name;
            },
            get() {
                return {
                    async fetch() {
                        return new Response(JSON.stringify({
                            allowed: true
                        }), {
                            status: 200,
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8'
                            }
                        });
                    }
                };
            }
        }
    };

    const requestBody = {
        contentBlocks: [
            { type: 'text', text: 'aaaa' },
            { type: 'image', imageDataUrl: 'data:image/png;base64,AAAA' },
            { type: 'text', text: 'bbbb' },
            { type: 'image', imageDataUrl: 'data:image/png;base64,BBBB' },
            { type: 'text', text: 'ccccccc' }
        ]
    };

    const firstResponse = await blogWorker.fetch(new Request('https://example.com/api/blog/append', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    }), env);

    const secondResponse = await blogWorker.fetch(new Request('https://example.com/api/blog/append', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    }), env);

    assert.equal(firstResponse.status, 201);
    assert.equal(secondResponse.status, 201);
    assert.match(currentContent, /^0x00C0DE Blog\n=============\nHeader line\n/m);
    assert.match(currentContent, /\[2026-04-02T09:00:00.000Z]\nexisting entry\n/);
    assert.equal((currentContent.match(/\naaaa\n/g) || []).length, 2);
    assert.equal((currentContent.match(/data:image\/png;base64,AAAA/g) || []).length, 2);
    assert.equal((currentContent.match(/data:image\/png;base64,BBBB/g) || []).length, 2);
    assert.equal((currentContent.match(/\nccccccc\n/g) || []).length, 2);
});

test('append endpoint uses the git data api when a blog update would exceed the contents api base64 threshold', async t => {
    const originalFetch = globalThis.fetch;
    let blobCreateBody = null;
    let treeCreateBody = null;
    let commitCreateBody = null;
    let refUpdateBody = null;
    let contentsPutCalls = 0;
    const currentContent = [
        '0x00C0DE Blog',
        '=============',
        '',
        '[2026-04-02T09:00:00.000Z]',
        'existing entry',
        ''
    ].join('\n');

    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async (url, options = {}) => {
        const urlString = String(url);
        const method = options.method || 'GET';

        if (urlString === 'https://api.github.com/repos/owner/repo/contents/blog.txt?ref=main') {
            if (method === 'PUT') {
                contentsPutCalls += 1;
                return new Response('unexpected contents put', { status: 500 });
            }

            return new Response(JSON.stringify({
                sha: 'blobsha-old',
                content: Buffer.from(currentContent, 'utf8').toString('base64')
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString === 'https://api.github.com/repos/owner/repo/git/ref/heads/main') {
            return new Response(JSON.stringify({
                object: {
                    sha: 'headcommitsha'
                }
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString === 'https://api.github.com/repos/owner/repo/git/refs/heads/main') {
            if (method === 'PATCH') {
                refUpdateBody = JSON.parse(options.body);
                return new Response(JSON.stringify({
                    object: {
                        sha: 'newcommitsha'
                    }
                }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    }
                });
            }

            throw new Error(`unexpected fetch: ${method} ${urlString}`);
        }

        if (urlString === 'https://api.github.com/repos/owner/repo/git/commits/headcommitsha') {
            return new Response(JSON.stringify({
                tree: {
                    sha: 'basetreesha'
                }
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString === 'https://api.github.com/repos/owner/repo/git/blobs') {
            blobCreateBody = JSON.parse(options.body);
            return new Response(JSON.stringify({
                sha: 'newblobsha'
            }), {
                status: 201,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString === 'https://api.github.com/repos/owner/repo/git/trees') {
            treeCreateBody = JSON.parse(options.body);
            return new Response(JSON.stringify({
                sha: 'newtreesha'
            }), {
                status: 201,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString === 'https://api.github.com/repos/owner/repo/git/commits' && method === 'POST') {
            commitCreateBody = JSON.parse(options.body);
            return new Response(JSON.stringify({
                sha: 'newcommitsha'
            }), {
                status: 201,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString.startsWith('https://0x00c0de.github.io/blog.txt?')) {
            return new Response(currentContent, {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8'
                }
            });
        }

        throw new Error(`unexpected fetch: ${method} ${urlString}`);
    };

    const env = {
        ALLOWED_ORIGIN: 'https://0x00c0de.github.io',
        GITHUB_OWNER: 'owner',
        GITHUB_REPO: 'repo',
        GITHUB_PAT: 'token',
        GITHUB_BRANCH: 'main',
        GITHUB_CONTENTS_MAX_BASE64_BYTES: '10',
        RATE_LIMITER: {
            idFromName(name) {
                return name;
            },
            get() {
                return {
                    async fetch() {
                        return new Response(JSON.stringify({
                            allowed: true
                        }), {
                            status: 200,
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8'
                            }
                        });
                    }
                };
            }
        }
    };

    const response = await blogWorker.fetch(new Request('https://example.com/api/blog/append', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contentBlocks: [
                { type: 'text', text: 'git data api post' }
            ]
        })
    }), env);

    assert.equal(response.status, 201);
    assert.equal(contentsPutCalls, 0);
    assert.equal(blobCreateBody.encoding, 'utf-8');
    assert.match(blobCreateBody.content, /git data api post/);
    assert.deepEqual(treeCreateBody, {
        base_tree: 'basetreesha',
        tree: [
            {
                path: 'blog.txt',
                mode: '100644',
                type: 'blob',
                sha: 'newblobsha'
            }
        ]
    });
    assert.deepEqual(commitCreateBody, {
        message: 'Append blog entry via terminal site',
        tree: 'newtreesha',
        parents: ['headcommitsha']
    });
    assert.deepEqual(refUpdateBody, {
        sha: 'newcommitsha',
        force: false
    });
});

test('media endpoint serves hosted gifs from R2 primary storage', async () => {
    const r2Bucket = new FakeR2Bucket();
    await r2Bucket.put('blog-gifs/test.gif', Buffer.from('GIF89a', 'utf8'), {
        httpMetadata: {
            contentType: 'image/gif'
        }
    });

    const response = await blogWorker.fetch(
        new Request(`https://example.com/api/blog/media/r2/${Buffer.from('blog-gifs/test.gif').toString('base64url')}`),
        {
            ALLOWED_ORIGIN: 'https://0x00c0de.github.io',
            BLOG_GIF_R2_BUCKET: r2Bucket
        }
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'image/gif');
    assert.equal(Buffer.from(await response.arrayBuffer()).toString('utf8'), 'GIF89a');
});

test('media endpoint serves hosted gifs from private B2 fallback storage', async t => {
    const originalFetch = globalThis.fetch;

    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async (url, options = {}) => {
        const urlString = String(url);

        if (urlString.includes('b2_authorize_account')) {
            return new Response(JSON.stringify({
                apiUrl: 'https://api001.backblazeb2.com',
                downloadUrl: 'https://f001.backblazeb2.com',
                authorizationToken: 'b2-auth-token'
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString.includes('b2_download_file_by_id') && String(options.headers?.Authorization || options.headers?.authorization || '') === 'b2-auth-token') {
            return new Response(Buffer.from('GIF89a', 'utf8'), {
                status: 200,
                headers: {
                    'Content-Type': 'image/gif'
                }
            });
        }

        throw new Error(`unexpected fetch: ${urlString}`);
    };

    const response = await blogWorker.fetch(
        new Request('https://example.com/api/blog/media/b2/b2-file-id-123'),
        {
            ALLOWED_ORIGIN: 'https://0x00c0de.github.io',
            B2_APPLICATION_KEY_ID: 'key-id',
            B2_APPLICATION_KEY: 'app-key',
            B2_BUCKET_NAME: '0x00C0DE-github-b2'
        }
    );

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'image/gif');
    assert.equal(Buffer.from(await response.arrayBuffer()).toString('utf8'), 'GIF89a');
});

test('delete endpoint removes hosted B2 gif blocks from blog.txt and deletes the backing file', async t => {
    const originalFetch = globalThis.fetch;
    let githubUpdateBody = null;
    let b2DeleteBody = null;
    const mediaUrl = 'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/blog/media/b2/b2-file-id-123';

    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async (url, options = {}) => {
        const urlString = String(url);
        const method = options.method || 'GET';

        if (urlString === 'https://api.github.com/repos/owner/repo/contents/blog.txt?ref=main') {
            if (method === 'PUT') {
                githubUpdateBody = JSON.parse(options.body);
                return new Response(JSON.stringify({
                    commit: {
                        sha: 'deletegif123'
                    }
                }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8'
                    }
                });
            }

            return new Response(JSON.stringify({
                sha: 'oldsha123',
                content: Buffer.from([
                    '0x00C0DE Blog',
                    '=============',
                    '',
                    '[2026-04-03T02:00:00.000Z]',
                    'hosted gif',
                    '[image-url]',
                    `src:${mediaUrl}`,
                    'mime:image/gif',
                    'provider:b2',
                    'storage-key:blog-gifs/uploaded.gif',
                    'storage-file-id:b2-file-id-123',
                    '[/image-url]',
                    ''
                ].join('\n'), 'utf8').toString('base64')
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString.startsWith('https://0x00c0de.github.io/blog.txt?')) {
            return new Response([
                '0x00C0DE Blog',
                '=============',
                '',
                '[2026-04-03T02:00:00.000Z]',
                'hosted gif',
                '[image-url]',
                `src:${mediaUrl}`,
                'mime:image/gif',
                'provider:b2',
                'storage-key:blog-gifs/uploaded.gif',
                'storage-file-id:b2-file-id-123',
                '[/image-url]',
                ''
            ].join('\n'), {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8'
                }
            });
        }

        if (urlString.includes('b2_authorize_account')) {
            return new Response(JSON.stringify({
                apiUrl: 'https://api001.backblazeb2.com',
                downloadUrl: 'https://f001.backblazeb2.com',
                authorizationToken: 'b2-auth-token'
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString.includes('b2_delete_file_version')) {
            b2DeleteBody = JSON.parse(options.body);
            return new Response(JSON.stringify({
                fileId: 'b2-file-id-123',
                fileName: 'blog-gifs/uploaded.gif'
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        throw new Error(`unexpected fetch: ${method} ${urlString}`);
    };

    const response = await blogWorker.fetch(new Request('https://example.com/api/blog/delete-image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            password: 'delete-me',
            imageBlockIndex: 0,
            imageKey: createBlogImageKey(mediaUrl),
            entryTimestamp: '[2026-04-03T02:00:00.000Z]',
            entryImageIndex: 0
        })
    }), {
        ALLOWED_ORIGIN: 'https://0x00c0de.github.io',
        GITHUB_OWNER: 'owner',
        GITHUB_REPO: 'repo',
        GITHUB_PAT: 'token',
        GITHUB_BRANCH: 'main',
        BLOG_IMAGE_DELETE_PASSWORD: 'delete-me',
        B2_APPLICATION_KEY_ID: 'key-id',
        B2_APPLICATION_KEY: 'app-key',
        B2_BUCKET_NAME: '0x00C0DE-github-b2',
        RATE_LIMITER: createAlwaysAllowRateLimiter()
    });

    assert.equal(response.status, 200);
    const updatedBlogContent = Buffer.from(githubUpdateBody.content, 'base64').toString('utf8');
    assert.doesNotMatch(updatedBlogContent, /\[image-url\]/);
    assert.deepEqual(b2DeleteBody, {
        fileId: 'b2-file-id-123',
        fileName: 'blog-gifs/uploaded.gif'
    });
});

test('append endpoint blocks writes while the live site is still deploying the previous repo state', async t => {
    const originalFetch = globalThis.fetch;
    let githubUpdateCalls = 0;

    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async (url, options = {}) => {
        const urlString = String(url);
        const method = options.method || 'GET';

        if (urlString === 'https://api.github.com/repos/owner/repo/contents/blog.txt?ref=main') {
            if (method === 'PUT') {
                githubUpdateCalls += 1;
            }

            return new Response(JSON.stringify({
                sha: 'oldsha456',
                content: Buffer.from([
                    '0x00C0DE Blog',
                    '=============',
                    '',
                    '[2026-04-02T09:00:00.000Z]',
                    'repo is ahead',
                    ''
                ].join('\n'), 'utf8').toString('base64')
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString.startsWith('https://0x00c0de.github.io/blog.txt?')) {
            return new Response([
                '0x00C0DE Blog',
                '=============',
                '',
                '[2026-04-02T08:59:00.000Z]',
                'site is still behind',
                ''
            ].join('\n'), {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8'
                }
            });
        }

        if (urlString.startsWith('https://0x00c0de.github.io/blog.txt?')) {
            return new Response([
                '0x00C0DE Blog',
                '=============',
                ''
            ].join('\n'), {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8'
                }
            });
        }

        throw new Error(`unexpected fetch: ${method} ${urlString}`);
    };

    const env = {
        ALLOWED_ORIGIN: 'https://0x00c0de.github.io',
        GITHUB_OWNER: 'owner',
        GITHUB_REPO: 'repo',
        GITHUB_PAT: 'token',
        GITHUB_BRANCH: 'main',
        RATE_LIMITER: {
            idFromName(name) {
                return name;
            },
            get() {
                return {
                    async fetch() {
                        return new Response(JSON.stringify({
                            allowed: true
                        }), {
                            status: 200,
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8'
                            }
                        });
                    }
                };
            }
        }
    };

    const response = await blogWorker.fetch(new Request('https://example.com/api/blog/append', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contentBlocks: [
                { type: 'text', text: 'blocked post' }
            ]
        })
    }), env);

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
        error: 'site is still deploying previous changes; wait for blog.txt to go live before posting or deleting again'
    });
    assert.equal(githubUpdateCalls, 0);
});

test('delete endpoint blocks writes while the live site is still deploying the previous repo state', async t => {
    const originalFetch = globalThis.fetch;
    let githubUpdateCalls = 0;

    t.after(() => {
        globalThis.fetch = originalFetch;
    });

    globalThis.fetch = async (url, options = {}) => {
        const urlString = String(url);
        const method = options.method || 'GET';

        if (urlString === 'https://api.github.com/repos/owner/repo/contents/blog.txt?ref=main') {
            if (method === 'PUT') {
                githubUpdateCalls += 1;
            }

            return new Response(JSON.stringify({
                sha: 'oldsha456',
                content: Buffer.from([
                    '0x00C0DE Blog',
                    '=============',
                    '',
                    '[2026-04-02T10:17:04.041Z]',
                    'testing image post',
                    '[image-base64]',
                    'data:image/png;base64,AAAA',
                    '[/image-base64]',
                    ''
                ].join('\n'), 'utf8').toString('base64')
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8'
                }
            });
        }

        if (urlString.startsWith('https://0x00c0de.github.io/blog.txt?')) {
            return new Response([
                '0x00C0DE Blog',
                '=============',
                '',
                '[2026-04-02T10:16:00.000Z]',
                'older deployed site',
                ''
            ].join('\n'), {
                status: 200,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8'
                }
            });
        }

        throw new Error(`unexpected fetch: ${method} ${urlString}`);
    };

    const env = {
        ALLOWED_ORIGIN: 'https://0x00c0de.github.io',
        BLOG_IMAGE_DELETE_PASSWORD: 'secret',
        GITHUB_OWNER: 'owner',
        GITHUB_REPO: 'repo',
        GITHUB_PAT: 'token',
        GITHUB_BRANCH: 'main',
        RATE_LIMITER: {
            idFromName(name) {
                return name;
            },
            get() {
                return {
                    async fetch() {
                        return new Response(JSON.stringify({
                            allowed: true
                        }), {
                            status: 200,
                            headers: {
                                'Content-Type': 'application/json; charset=utf-8'
                            }
                        });
                    }
                };
            }
        }
    };

    const response = await blogWorker.fetch(new Request('https://example.com/api/blog/delete-image', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            password: 'secret',
            entryTimestamp: '[2026-04-02T10:17:04.041Z]',
            entryImageIndex: 0,
            previousTextLine: 'testing image post',
            imageDataUrl: 'data:image/png;base64,AAAA'
        })
    }), env);

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), {
        error: 'site is still deploying previous changes; wait for blog.txt to go live before posting or deleting again'
    });
    assert.equal(githubUpdateCalls, 0);
});
