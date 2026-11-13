import test from 'node:test';
import assert from 'node:assert/strict';
import { selectLead, validateChanges } from '../scripts/research/codex-proposal.mjs';

test('only current reports with a relevant lead trigger Codex', () => {
    const lead = { name: 'example/chart', ranks: { daily: 1 }, fit: { surface: 'pages/bitcoin.html' } };
    assert.equal(selectLead({ revision: 'base', trending: { repositories: [lead] } }, 'other'), null);
    assert.equal(selectLead({ revision: 'base', trending: { repositories: [lead] } }, 'base'), lead);
});
test('requires README and tests, and rejects privileged or nonregular paths', () => {
    const good = [
        { path: 'README.md', mode: '100644' },
        { path: 'pages/bitcoin.html', mode: '100644' },
        { path: 'tests/codex-feature-chart.test.mjs', mode: '100644' },
    ];
    assert.doesNotThrow(() => validateChanges(good));
    for (const path of ['.github/workflows/pages.yml', 'src/commands.js', 'worker/src/index.js', 'pages/../index.html']) {
        assert.throws(() => validateChanges([...good, { path, mode: '100644' }]));
    }
    assert.throws(() => validateChanges(good.slice(1)));
    assert.throws(() => validateChanges([...good.slice(0, 2), { ...good[2], mode: '120000' }]));
    const existingPage = { ...good[1], mode: '100755' };
    assert.throws(() => validateChanges([good[0], existingPage, good[2]]));
    assert.doesNotThrow(() => validateChanges([good[0], { ...existingPage, previousMode: '100755' }, good[2]]));
});

test('automated review fails closed unless it explicitly approves with zero findings', async () => {
    const { reviewApproved } = await import('../scripts/research/codex-proposal.mjs');
    assert.equal(reviewApproved('{"decision":"approve","findings":[]}'), true);
    for (const value of ['approve', '{}', '{"decision":"block","findings":[]}',
        '{"decision":"approve","findings":["Regression"]}', '{"decision":"approve","findings":[]} trailing']) {
        assert.equal(reviewApproved(value), false);
    }
});
