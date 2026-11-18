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
    const surplus = { ...withEvidence[0], window: 'monthly', readmeEvidence: 'Irrelevant evidence' };
    assert.deepEqual(discovery.verifyEvaluation(trending,
        { assessments: [...withEvidence, surplus], features: [second] }), [second]);
    assert.throws(() => discovery.verifyEvaluation(trending,
        { assessments: [...withEvidence, withEvidence[0]], features: [second] }), /duplicate/i);

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

test('README evidence can cross source line breaks without accepting paraphrases', () => {
    const repo = {
        name: 'example/tool', ranks: { daily: 1, weekly: 1, monthly: 1 },
        readme: { text: 'Open the project\r\nand choose a saved view.' },
    };
    const assessments = Object.keys(repo.ranks).map(window => ({
        window, repository: repo.name, reason: 'Useful navigation', readmeEvidence: 'project and choose',
    }));
    assert.deepEqual(discovery.verifyEvaluation({ repositories: [repo] }, { assessments, features: [] }), []);
    assessments[0].readmeEvidence = 'project then choose';
    assert.throws(() => discovery.verifyEvaluation({ repositories: [repo] }, { assessments, features: [] }),
        /README evidence/);
});

test('keeps verified candidates when another repository has an invalid excerpt', () => {
    const trending = { repositories: [
        { name: 'example/good', ranks: { daily: 1, weekly: 1 }, readme: { text: 'Browse by topic.' } },
        { name: 'example/bad', ranks: { monthly: 1 }, readme: { text: 'Possible ideas.' } },
    ] };
    const assessments = [
        ...['daily', 'weekly'].map(window => ({
            window, repository: 'example/good', reason: 'Useful filter', readmeEvidence: 'Browse by topic.',
        })),
        { window: 'monthly', repository: 'example/bad', reason: 'Proposed', readmeEvidence: 'Altered quote' },
    ];
    const good = { title: 'Browse by topic', repository: 'example/good', brief: 'Show topic filters.' };
    const bad = { title: 'More ideas', repository: 'example/bad', brief: 'Show ideas.' };
    const result = discovery.selectVerifiedFeatures(trending, { assessments, features: [good, bad] });
    assert.deepEqual(result, { features: [good], invalidEvidence: ['example/bad'] });
    assert.throws(() => discovery.selectVerifiedFeatures(trending, { assessments: assessments.slice(1), features: [good] }),
        /coverage/i);
});

test('describes broad fallback discoveries without site fit hints', () => {
    const revision = 'abc';
    const candidate = discovery.selectDiscovery({ revision, trending: { repositories: [
        { name: 'example/new-tech', fit: null, ranks: { daily: 1 } },
    ] } }, revision);
    assert.deepEqual(discovery.describeHandoff(candidate, 'local-123'),
        { lead: 'Trending discovery (local-123)', surface: null });
});
