import assert from 'node:assert/strict';
import test from 'node:test';
import * as discovery from '../scripts/research/codex-proposal.mjs';

test('discovery handoffs need no repository or keyword match', () => {
    assert.deepEqual(discovery.describeHandoff({ discovery: true }, 123),
        { lead: 'Trending discovery (123)', surface: null });
});

test('evaluation accounts for every repository rank in all three windows', () => {
    const trending = { unavailable: [], repositories: [
        { name: 'a/first', ranks: { daily: 1, weekly: 2 } },
        { name: 'a/second', ranks: { monthly: 1, weekly: 1 } },
    ] };
    const assessments = [
        { window: 'daily', repository: 'a/first', reason: 'Already supported' },
        { window: 'weekly', repository: 'a/first', reason: 'Already supported' },
        { window: 'weekly', repository: 'a/second', reason: 'Useful filter' },
        { window: 'monthly', repository: 'a/second', reason: 'Useful filter' },
    ];
    const feature = { title: 'Project filters', repository: 'a/second', brief: 'Filter by category.' };
    const second = { title: 'Saved views', repository: 'a/first', brief: 'Save a view locally.' };
    assert.deepEqual(discovery.verifyEvaluation(trending, { assessments, features: [feature, second] }),
        [feature, second]);
    assert.deepEqual(discovery.verifyEvaluation(trending, { assessments, features: [] }), []);
    assert.throws(() => discovery.verifyEvaluation(trending,
        { assessments, features: [feature, { ...feature, title: ' project FILTERS ' }] }), /duplicate/i);
    assert.throws(() => discovery.verifyEvaluation(trending, { assessments: assessments.slice(1), feature }), /coverage/i);
    assert.throws(() => discovery.verifyEvaluation({ ...trending, unavailable: ['daily'] },
        { assessments, feature }), /unavailable/i);
});
