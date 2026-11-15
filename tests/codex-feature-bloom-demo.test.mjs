import test from 'node:test';
import assert from 'node:assert/strict';
import { createBloom, positions } from '../src/codex-feature-bloom-demo-model.mjs';

test('eight-bit worked fixture produces a false positive without false negatives', () => {
    const model = createBloom();
    assert.deepEqual(positions('cat', 8), [0, 1]);
    model.insert('cat');
    model.insert('dog');
    assert.deepEqual(model.bits(), [0, 1, 2, 7]);
    assert.equal(model.query('god').decision, 'Probably present');
    assert.equal(model.query('god').inserted, false);
    for (const word of model.words()) assert.equal(model.query(word).decision, 'Probably present');
    assert.equal(model.query('sun').decision, 'Definitely absent');
});

test('rebuild retains samples, recomputes bits, and reset reproduces initial state', () => {
    const model = createBloom();
    model.insert('cat');
    model.insert('dog');
    model.resize(32);
    assert.deepEqual(model.bits(), [1, 23, 24, 26]);
    assert.equal(model.query('god').decision, 'Definitely absent');
    for (const word of model.words()) assert.equal(model.query(word).decision, 'Probably present');
    model.reset();
    assert.equal(model.size(), 8);
    assert.deepEqual(model.words(), []);
    assert.deepEqual(model.bits(), []);
});

test('invalid sizes and words cannot mutate the bounded model', () => {
    const model = createBloom();
    for (const size of [0, 9, 33, NaN, Infinity]) assert.throws(() => model.resize(size));
    for (const word of ['', 'password123', 'a'.repeat(17)]) assert.throws(() => model.insert(word));
    model.insert(' CAT ');
    model.insert('cat');
    assert.deepEqual(model.words(), ['cat']);
    assert.equal(model.size(), 8);
});


test('inserted samples never report absent across every supported rebuild size', () => {
    const model = createBloom();
    for (const word of ['cat', 'dog', 'god', 'sun', 'a', 'zebra']) model.insert(word);
    for (const size of [8, 16, 24, 32, 8]) {
        model.resize(size);
        for (const word of model.words()) {
            assert.equal(model.query(word).decision, 'Probably present');
        }
        assert.ok(model.bits().every(bit => bit >= 0 && bit < size));
    }
});
