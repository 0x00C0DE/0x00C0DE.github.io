import assert from 'node:assert/strict';
import test from 'node:test';
import { evolveTopics, observe, rank, research } from '../scripts/innovation/engine.mjs';
import { githubClient } from '../scripts/innovation/github.mjs';

test('new GitHub metadata topics can earn a future search without a seed match', () => {
    const registry = evolveTopics({}, [{ name: 'a/first', topics: ['acoustic-cartography'] },
        { name: 'b/second', topics: ['acoustic-cartography'] }], [], '2026-11-16', 60);
    assert.equal(registry['acoustic-cartography'].active, true);
    assert.equal(registry['acoustic-cartography'].source, 'a/first');
});

test('momentum uses observed star deltas and never infers growth from totals', () => {
    assert.equal(observe(null, 1000, '2026-11-16').growth, null);
    const prior = observe(null, 1000, '2026-11-16');
    assert.equal(observe(prior, 1012, '2026-11-17').growth, 12);
    assert.equal(observe(prior, 1012, '2026-11-16').growth, null);
});

test('ranking handles inadequate evidence and hard rejections', () => {
    const ratings = { originality: 8, compatibility: 7 };
    assert.equal(rank(ratings).score, 76);
    assert.equal(rank(ratings).confidence, 45);
    assert.equal(rank(ratings, undefined, 'license').score, null);
});

test('client stops issuing requests after a primary rate limit', async () => {
    let calls = 0;
    const github = githubClient({ requests: 5, fetcher: async () => {
        calls++;
        return new Response('', { status: 403, headers: { 'x-ratelimit-remaining': '0' } });
    } });
    await assert.rejects(github.search('topic:webgpu'), /rate limit/);
    await assert.rejects(github.search('topic:webassembly'), /rate limit/);
    assert.equal(calls, 1);
});

test('reuses prior analysis on an unchanged repository and retains its backlog entry', async () => {
    let inspections = 0;
    const candidate = { name: 'lab/odd', description: 'Audio visual playground', topics: ['acoustic-cartography'],
        revision: 'abc', stars: 10, license: 'MIT' };
    const github = { search: async () => [candidate], inspect: async () => {
        inspections++;
        return { path: 'README.md', text: 'Render music as a map of interactive spatial objects.' };
    } };
    const trend = async () => ({ repositories: [], unavailable: [] });
    const first = await research({ github, trend, date: '2026-11-16' });
    const second = await research({ github, trend, date: '2026-11-17', history: first.history });
    assert.equal(inspections, 1);
    assert.equal(first.report.backlog.length, 1);
    assert.equal(second.report.backlog[0].id, first.report.backlog[0].id);
    assert.deepEqual(second.report.changes.added, []);
});

test('cross-domain adapter output must cite exact evidence and is cached by current revisions', async () => {
    const candidates = ['one/sound', 'two/maps'].map((name, index) => ({ name,
        description: 'Experimental spatial interface', topics: [index ? 'cartography' : 'spatial-audio'],
        revision: '2026-11-15', license: 'MIT' }));
    const evidence = 'Render audio signals as interactive spatial objects.';
    const github = { search: async () => candidates,
        inspect: async () => ({ path: 'README.md', text: evidence }) };
    let calls = 0;
    const analyze = async (selected, budget) => {
        calls++;
        assert.equal(budget.maxTokens, 8000);
        const idea = { sources: selected.map(repo => repo.name), title: 'Spatial instrument',
            technique: 'Map acoustic events to pan and direction', adaptation: 'Build a standalone instrument.',
            value: 'Explore spatial audio.', approach: 'Prototype with pointer and keyboard input.',
            difficulty: 'medium', performance: 'test on mobile', compatibility: 'Web Audio API',
            security: 'browser-only input', ratings: { originality: 9, compatibility: 8 },
            evidence: selected.map(repo => ({ repository: repo.name, excerpt: evidence })) };
        return [idea, { ...idea, title: 'Invented', evidence: [] }];
    };
    const args = { github, trend: async () => ({ repositories: [], unavailable: [] }), analyze };
    const first = await research({ ...args, date: '2026-11-16' });
    const second = await research({ ...args, date: '2026-11-17', history: first.history });
    assert.equal(calls, 1);
    assert.equal(second.report.backlog.find(idea => idea.title === 'Spatial instrument').sources.length, 2);
    assert.ok(!second.report.backlog.some(idea => idea.title === 'Invented'));
});

test('partial source failures keep prior opportunities and still report usable new evidence', async () => {
    const trend = async () => { throw new Error('timeout'); };
    const result = await research({ trend, date: '2026-11-16', github: {
        search: async query => {
            if (query.includes('created:')) throw new Error('temporary upstream error');
            return [{ name: 'lab/map', topics: ['cartography'], license: 'MIT' }];
        },
        inspect: async () => ({ path: 'README.md', text: 'Render traces from a geographic data collection.' }),
    } });
    assert.deepEqual(result.report.trendingUnavailable, ['daily', 'weekly', 'monthly']);
    assert.equal(result.report.backlog.length, 1);
    assert.equal(result.report.errors.length, 2);
});

test('Markdown preserves evidence as text and presents the same proposal as JSON', async () => {
    const { markdown } = await import('../scripts/innovation/report.mjs');
    const result = await research({
        date: '2026-11-16', trend: async () => ({ repositories: [], unavailable: [] }),
        github: { search: async () => [{ name: 'lab/maps', topics: ['webxr'], license: 'MIT' }],
            inspect: async () => ({ path: 'README.md',
                text: 'Render a navigable spatial map with [project documentation].' }) },
    });
    const report = JSON.parse(JSON.stringify(result.report));
    assert.equal(report.schema, 1);
    assert.match(report.backlog[0].id, /^[0-9a-f]{20}$/);
    assert.match(markdown(report), /https:\/\/github\.com\/lab\/maps/);
    assert.ok(markdown(report).includes('\\[project documentation\\]'));
});
