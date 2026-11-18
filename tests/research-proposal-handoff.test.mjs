import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('proposal sandbox browser failures defer to the guarded runner verification', async () => {
    const prompt = await readFile(new URL('../scripts/research/codex-proposal-prompt.md', import.meta.url), 'utf8');
    assert.ok(prompt.includes('Keep the implementation, Node tests, and browser plan'));
    assert.ok(prompt.includes('spawn EPERM'));
    const runner = await readFile(new URL('../scripts/research/run-codex-local.ps1', import.meta.url), 'utf8');
    const browser = runner.indexOf('Invoke-Checked node scripts/research/browser-verify.mjs');
    const publication = runner.indexOf('Invoke-Checked git push --atomic');
    assert.ok(browser > 0 && publication > browser);
});
