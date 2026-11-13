import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { artifactPath } from '../scripts/research/browser-verify.mjs';

test('browser server resolves artifact paths and rejects paths outside the build', () => {
    assert.equal(artifactPath('/build', '/pages/projects.html?check=1'), resolve('/build/pages/projects.html'));
    assert.equal(artifactPath('/build', '/'), resolve('/build/index.html'));
    assert.throws(() => artifactPath('/build', '/%2e%2e%2fsecret'), /outside/);
    assert.throws(() => artifactPath('/build', '/%5c..%5csecret'), /outside/);
});
