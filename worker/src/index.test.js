import test from 'node:test';
import assert from 'node:assert/strict';

import { VisitorCounter } from './index.js';

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

    assert.equal(await storage.get('totalVisits'), 1);
    assert.equal(await storage.get('totalUniqueVisitors'), 1);
    const sessions = await storage.get('activeSessions');
    assert.equal(typeof sessions['visit-1'], 'number');
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

test('readSnapshot backfills missing unique visitor totals from visitor keys', async () => {
    const { counter, storage } = createCounter();
    await storage.put('totalVisits', 4);
    await storage.put('visitor:alpha', 1);
    await storage.put('visitor:beta', 2);

    const snapshot = await counter.readSnapshot();

    assert.equal(snapshot.visits, 4);
    assert.equal(snapshot.uniqueVisitors, 2);
    assert.equal(await storage.get('totalUniqueVisitors'), 2);
});
