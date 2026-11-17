import test from 'node:test';
import assert from 'node:assert/strict';
import { initial, change } from '../src/codex-feature-type-relief-model.mjs';

test('word, extrusion and outline compose independently; reset restores FORM', () => {
    let state = change(initial, 'word', 'echo');
    assert.equal(state.word, 'ECHO');
    state = change(state, 'depth', 4);
    state = change(state, 'outline', true);
    assert.deepEqual(state, { word: 'ECHO', depth: 4, outline: true });
    assert.deepEqual(change(state, 'reset'), initial);
    assert.deepEqual(initial, { word: 'FORM', depth: 1, outline: false });
});

test('short lettering stays bounded and invalid depths preserve the composition', () => {
    assert.equal(change(initial, 'word', 'abcdefghijk').word, 'ABCDEF');
    assert.equal(change(initial, 'word', '').word, '');
    assert.equal(change(initial, 'depth', 99).depth, 4);
    assert.equal(change(initial, 'depth', -1).depth, 1);
    assert.deepEqual(change(initial, 'depth', NaN), initial);
    assert.deepEqual(change(initial, 'unknown', 3), initial);
});
