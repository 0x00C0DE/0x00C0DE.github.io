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

test('append endpoint accepts gif image data urls and commits them to blog.txt', async t => {
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
    assert.match(updatedBlogContent, /\[image-base64\]/);
    assert.match(updatedBlogContent, /data:image\/gif;base64,R0lGODlhAQABAIAAAAUEBA==/);
    assert.match(updatedBlogContent, /\[\/image-base64\]/);
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
    assert.match(updatedBlogContent, /data:image\/gif;base64,R0lGODlhAQABAIAAAAUEBA==/);
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
