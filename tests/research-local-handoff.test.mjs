import assert from 'node:assert/strict';
import test from 'node:test';
import { readHandoff } from '../scripts/research/local-handoff.mjs';
test('only a successful named handoff for the current revision is accepted', () => {
    const run = { head_sha: 'base', conclusion: 'success' };
    const jobs = [{ name: 'Local Codex handoff | example/charts | pages/bitcoin.html', conclusion: 'success' }];
    assert.equal(readHandoff(run, jobs, 'old'), null);
    assert.equal(readHandoff(run, [{ ...jobs[0], conclusion: 'skipped' }], 'base'), null);
    assert.equal(readHandoff(run, jobs, 'base').trending.repositories[0].name, 'example/charts');
});
