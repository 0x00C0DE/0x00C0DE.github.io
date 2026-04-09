import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readHelpLayoutFunctionSource() {
    const source = await readFile(new URL('../terminal-canvas-core.mjs', import.meta.url), 'utf8');
    const match = /function layoutHelpEntry\(block, width, metrics, context = \{\}\) \{([\s\S]*?)\n\}\n\nfunction buildVisitorRowTokens/.exec(source);
    assert.ok(match, 'expected to find layoutHelpEntry in terminal-canvas-core.mjs');
    return match[1];
}

test('help layout stays columnar instead of switching into editorial obstacle prose flow', async () => {
    const layoutHelpEntrySource = await readHelpLayoutFunctionSource();

    assert.doesNotMatch(
        layoutHelpEntrySource,
        /__helpEditorial|buildEditorialTextLayout|hasGlobalEditorialObstacles/,
        'expected help layout to skip the editorial obstacle flow and preserve column alignment'
    );
});
