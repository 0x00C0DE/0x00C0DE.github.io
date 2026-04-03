import test from 'node:test';
import assert from 'node:assert/strict';

import {
    createBinaryRainColumns,
    getPromptUserClassName
} from '../terminal-visuals-core.mjs';

function createDeterministicRandom(values) {
    let index = 0;
    return () => {
        const value = values[index % values.length];
        index += 1;
        return value;
    };
}

test('guest prompt keeps the default user class', () => {
    assert.equal(
        getPromptUserClassName({
            isRoot: false,
            user: 'guest'
        }),
        'prompt-user'
    );
});

test('root prompt adds a dedicated root user class', () => {
    assert.equal(
        getPromptUserClassName({
            isRoot: true,
            user: 'root'
        }),
        'prompt-user prompt-user-root'
    );
});

test('binary rain columns stay inside the viewport and only use binary glyphs', () => {
    const columns = createBinaryRainColumns({
        columnCount: 6,
        glyphs: '01',
        height: 720,
        rng: createDeterministicRandom([0.05, 0.18, 0.33, 0.51, 0.74, 0.92]),
        width: 1200
    });

    assert.equal(columns.length, 6);

    columns.forEach(column => {
        assert.equal(typeof column.stream, 'string');
        assert.match(column.stream, /^[01\n]+$/);
        assert.ok(column.stream.includes('\n'));
        assert.ok(column.leftPercent >= 0);
        assert.ok(column.leftPercent <= 100);
        assert.ok(column.durationMs >= 6000);
        assert.ok(column.delayMs <= 0);
        assert.ok(column.fontSizePx >= 14);
        assert.ok(column.opacity > 0);
    });
});
