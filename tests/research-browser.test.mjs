import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { artifactPath, runFeatureBrowserTests } from '../scripts/research/browser-verify.mjs';

test('browser server resolves artifact paths and rejects paths outside the build', () => {
    assert.equal(artifactPath('/build', '/pages/projects.html?check=1'), resolve('/build/pages/projects.html'));
    assert.equal(artifactPath('/build', '/'), resolve('/build/index.html'));
    assert.equal(artifactPath('/build', '/?command=help'), resolve('/build/index.html'));
    assert.throws(() => artifactPath('/build', '/%2e%2e%2fsecret'), /outside/);
    assert.throws(() => artifactPath('/build', '/%5c..%5csecret'), /outside/);
});

test('feature browser regressions run against the served artifact and failures block publication', async () => {
    let observed;
    const execute = async (...args) => { observed = args; return { stdout: '', stderr: '' }; };
    await runFeatureBrowserTests('http://127.0.0.1:1234', ['tests/codex-feature-help.test.mjs'], execute);
    assert.equal(observed[0], process.execPath);
    assert.deepEqual(observed[1], ['--test', '--test-isolation=none', 'tests/codex-feature-help.test.mjs']);
    assert.equal(observed[2].env.FEATURE_BROWSER_ORIGIN, 'http://127.0.0.1:1234');
    assert.equal(observed[2].windowsHide, true);
    assert.ok(observed[2].timeout > 0);
    const failure = new Error('Canvas selection regression');
    await assert.rejects(runFeatureBrowserTests('http://127.0.0.1:1234',
        ['tests/codex-feature-help.test.mjs'], async () => { throw failure; }), failure);
    await assert.rejects(runFeatureBrowserTests('http://127.0.0.1:1234', ['--eval=unsafe'], execute), /feature test/i);
});
