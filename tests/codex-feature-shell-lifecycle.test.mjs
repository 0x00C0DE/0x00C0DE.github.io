import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createJob, advanceJob, describeJob } from '../src/codex-feature-shell-lifecycle-core.mjs';

for (const mode of ['foreground', 'background']) {
    test(`${mode}: prompt, completion, and reaping remain coherent`, () => {
        let job = createJob(mode);
        assert.equal(describeJob(job).child, 'Not started');
        const initial = job;
        job = advanceJob(job);
        assert.equal(initial.stage, 0);
        assert.equal(describeJob(job).child, 'Running');
        assert.equal(describeJob(job).prompt, mode === 'foreground' ? 'Waiting' : 'Ready');
        job = advanceJob(job);
        assert.equal(describeJob(job).child, 'Completed · not reaped');
        assert.equal(describeJob(job).prompt, mode === 'foreground' ? 'Waiting' : 'Ready');
        job = advanceJob(job);
        assert.equal(describeJob(job).child, 'Reaped');
        assert.equal(describeJob(job).prompt, 'Ready');
        assert.equal(describeJob(job).events.length, 4);
        assert.deepEqual(advanceJob(job), job);
        assert.deepEqual(createJob(mode), initial);
        assert.equal(describeJob(initial).events.length, 1);
    });
}

test('invalid modes and stages fail explicitly', () => {
    assert.throws(() => createJob('unknown'), /mode/);
    assert.throws(() => advanceJob({ mode: 'foreground', stage: 8 }), /stage/);
});

test('direct page retains source disclosures and a readable static fallback', () => {
    const page = readFileSync(new URL('../pages/project-smallsh.html', import.meta.url), 'utf8');
    assert.match(page, /id="flow-lifecycle"/);
    assert.match(page, /id="shell-controls" hidden/);
    assert.match(page, /id="shell-fallback" open/);
    assert.match(page, /Waiting \/ Ready/);
    assert.match(page, /notification alone does not reap/);
    for (const asset of ['style.css', 'ui.mjs']) {
        assert.ok(page.includes(`/src/codex-feature-shell-lifecycle-${asset}`));
    }
    const css = readFileSync(new URL('../src/codex-feature-shell-lifecycle-style.css', import.meta.url), 'utf8');
    assert.match(css, /prefers-reduced-motion: reduce/);
    assert.match(css, /animation: none/);
});
