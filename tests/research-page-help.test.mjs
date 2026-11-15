import assert from 'node:assert/strict';
import test from 'node:test';
import { terminalPageFiles } from '../scripts/research/page-help.mjs';

test('publishes new public HTML pages in deterministic help order', () => {
    const entry = (name, isFile = true) => ({ name, isFile: () => isFile });
    assert.deepEqual(terminalPageFiles([
        entry('new-feature.html'), entry('explore.html'), entry('private.html', false),
        entry('notes.md'), entry('../index.html'), entry('resume-intro.html'),
    ]), ['explore.html', 'new-feature.html']);
});
