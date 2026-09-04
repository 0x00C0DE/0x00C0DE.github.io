import test from 'node:test';
import assert from 'node:assert/strict';

import {
    stripLeadingCharacter,
    stripTrailingCharacter
} from '../worker/src/linear-string-normalization.js';

test('character stripping preserves values while removing only the requested boundary', () => {
    assert.equal(stripLeadingCharacter('///api/blog///', '/'), 'api/blog///');
    assert.equal(stripTrailingCharacter('///api/blog///', '/'), '///api/blog');
    assert.equal(stripTrailingCharacter('MZXW6===', '='), 'MZXW6');
    assert.equal(stripTrailingCharacter('unchanged', '/'), 'unchanged');
});

test('character stripping handles long attacker-controlled boundaries in linear passes', () => {
    const repeated = '/'.repeat(250_000);

    assert.equal(stripLeadingCharacter(`${repeated}safe`, '/'), 'safe');
    assert.equal(stripTrailingCharacter(`safe${repeated}`, '/'), 'safe');
});
