import test from 'node:test';
import assert from 'node:assert/strict';

import { VisitorCounter, createBlogImageKey, removeImageBlock } from './index.js';

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
