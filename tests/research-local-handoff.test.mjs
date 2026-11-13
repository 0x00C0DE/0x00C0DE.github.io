import assert from 'node:assert/strict';
import test from 'node:test';
import * as handoff from '../scripts/research/local-handoff.mjs';
const { readHandoff } = handoff;
test('only a successful named handoff for the current revision is accepted', () => {
    const run = { head_sha: 'base', conclusion: 'success' };
    const jobs = [{ name: 'Local Codex handoff | example/charts | pages/bitcoin.html', conclusion: 'success' }];
    assert.equal(readHandoff(run, jobs, 'old'), null);
    assert.equal(readHandoff(run, [{ ...jobs[0], conclusion: 'skipped' }], 'base'), null);
    assert.equal(readHandoff(run, jobs, 'base').trending.repositories[0].name, 'example/charts');
});

test('a missing or stale hosted cycle permits local research once per six hours', () => {
    const now = Date.parse('2026-11-13T18:30:00Z');
    const run = { head_sha: 'base', status: 'completed', conclusion: 'success', created_at: '2026-11-13T16:30:00Z' };
    assert.equal(handoff.shouldResearchLocally([], 'base', null, now), true);
    assert.equal(handoff.shouldResearchLocally([run], 'new-main', null, now), true);
    assert.equal(handoff.shouldResearchLocally([run], 'base', null, now), false);
    assert.equal(handoff.shouldResearchLocally([{ ...run, status: 'in_progress' }], 'base', null, now), false);
    assert.equal(handoff.shouldResearchLocally([{ ...run, conclusion: 'failure' }], 'base', null, now), true);
    assert.equal(handoff.shouldResearchLocally([], 'base', now - 60_000, now), false);
    assert.equal(handoff.shouldResearchLocally([{ ...run, created_at: '2026-11-13T11:30:00Z' }], 'base', now - 7 * 3_600_000, now), true);
});

test('a deploy-only match does not hide a usable later proposal lead', () => {
    const repo = { name: 'example/design', fit: { surface: 'pages/projects.html' } };
    const report = { revision: 'base', trending: { repositories: [
        { name: 'example/sitemap', fit: { surface: 'sitemap.xml' } }, repo,
    ] } };
    assert.deepEqual(handoff.selectHandoff(report, 'base').trending.repositories, [repo]);
});

test('a report skips already published native project navigation but still accepts a different lead', () => {
    const next = { name: 'example/search', fit: { surface: 'pages/projects.html' } };
    const report = { revision: 'base', projectNavigationPublished: true, trending: { repositories: [
        { name: 'example/guidance', fit: { surface: 'pages/projects.html', capability: 'native-project-navigation' } },
        next,
    ] } };
    assert.deepEqual(handoff.selectHandoff(report, 'base').trending.repositories, [next]);
});
