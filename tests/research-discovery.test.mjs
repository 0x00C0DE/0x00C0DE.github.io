import assert from 'node:assert/strict';
import test from 'node:test';
import * as discovery from '../scripts/research/codex-proposal.mjs';

test('discovery handoffs need no repository or keyword match', () => {
    assert.deepEqual(discovery.describeHandoff({ discovery: true }, 123),
        { lead: 'Trending discovery (123)', surface: null });
});

test('evaluation accounts for every repository rank in all three windows', () => {
    const trending = { unavailable: [], repositories: [
        { name: 'a/first', ranks: { daily: 1, weekly: 2 }, readme: { text: 'Save a view.' } },
        { name: 'a/second', ranks: { monthly: 1, weekly: 1 }, readme: { text: 'Filter by category.' } },
    ] };
    const assessments = [
        { window: 'daily', repository: 'a/first', reason: 'Already supported' },
        { window: 'weekly', repository: 'a/first', reason: 'Already supported' },
        { window: 'weekly', repository: 'a/second', reason: 'Useful filter' },
        { window: 'monthly', repository: 'a/second', reason: 'Useful filter' },
    ];
    const withEvidence = assessments.map(assessment => ({
        ...assessment, readmeEvidence: trending.repositories.find(repo => repo.name === assessment.repository).readme.text,
    }));
    const feature = { title: 'Project filters', repository: 'a/second', brief: 'Filter by category.' };
    const second = { title: 'Saved views', repository: 'a/first', brief: 'Save a view locally.' };
    assert.deepEqual(discovery.verifyEvaluation(trending, { assessments: withEvidence, features: [feature, second] }),
        [feature, second]);
    assert.deepEqual(discovery.verifyEvaluation(trending, { assessments: withEvidence, features: [] }), []);
    assert.throws(() => discovery.verifyEvaluation(trending,
        { assessments: withEvidence, features: [feature, { ...feature, title: ' project FILTERS ' }] }), /duplicate/i);
    assert.throws(() => discovery.verifyEvaluation(trending, { assessments: withEvidence.slice(1), feature }), /coverage/i);
    assert.throws(() => discovery.verifyEvaluation({ ...trending, unavailable: ['daily'] },
        { assessments: withEvidence, feature }), /unavailable/i);
});

test('rejects invented README evidence and features sourced from unreadable READMEs', () => {
    const trending = { repositories: [
        { name: 'a/first', readme: { text: 'Save your view.' }, ranks: { daily: 1, weekly: 1 } },
        { name: 'a/missing', readme: { status: 'unavailable' }, ranks: { monthly: 1 } },
    ] };
    const assessments = [
        { window: 'daily', repository: 'a/first', reason: 'Useful', readmeEvidence: 'Save your view.' },
        { window: 'weekly', repository: 'a/first', reason: 'Useful', readmeEvidence: 'Save your view.' },
        { window: 'monthly', repository: 'a/missing', reason: 'README unavailable', readmeEvidence: '' },
    ];
    assert.deepEqual(discovery.verifyEvaluation(trending, { assessments, features: [] }), []);
    assert.throws(() => discovery.verifyEvaluation(trending, {
        assessments: [{ ...assessments[0], readmeEvidence: 'Invented quote' }, ...assessments.slice(1)], features: [],
    }), /README evidence/i);
    assert.throws(() => discovery.verifyEvaluation(trending, {
        assessments, features: [{ title: 'New feature', repository: 'a/missing', brief: 'Missing evidence.' }],
    }), /invalid selected Trending feature/i);
});
