import test from 'node:test';
import assert from 'node:assert/strict';

import {
    advanceBinaryRainColumn,
    createBinaryRainColumns,
    getBinaryRainColumnFrame,
    getPromptUserClassName,
    shouldUseRootTerminalVisuals
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

test('godlike prompt adds a dedicated godlike user class', () => {
    assert.equal(
        getPromptUserClassName({
            isGodlike: true,
            isRoot: false,
            user: 'godlike'
        }),
        'prompt-user prompt-user-godlike'
    );
});

test('only root snapshots enable the animated terminal background', () => {
    assert.equal(
        shouldUseRootTerminalVisuals({
            isRoot: false,
            user: 'guest'
        }),
        false
    );
    assert.equal(
        shouldUseRootTerminalVisuals({
            isRoot: true,
            user: 'root'
        }),
        true
    );
    assert.equal(
        shouldUseRootTerminalVisuals({
            isGodlike: true,
            isRoot: false,
            user: 'godlike'
        }),
        true
    );
});

test('binary rain columns stay inside the viewport and use the configured glyph pool', () => {
    const columns = createBinaryRainColumns({
        columnCount: 6,
        glyphs: 'A1$',
        height: 720,
        rng: createDeterministicRandom([0.05, 0.18, 0.33, 0.51, 0.74, 0.92]),
        width: 1200
    });

    assert.equal(columns.length, 6);

    columns.forEach(column => {
        assert.equal(typeof column.stream, 'string');
        assert.match(column.stream, /^[A1$\n]+$/);
        assert.ok(column.stream.includes('\n'));
        assert.ok(column.leftPercent >= 0);
        assert.ok(column.leftPercent <= 100);
        assert.ok(column.durationMs >= 6000);
        assert.ok(column.delayMs <= 0);
        assert.ok(column.fontSizePx >= 14);
        assert.ok(column.mutationIntervalMs >= 70);
        assert.ok(column.opacity > 0);
    });
});

test('advancing a rain column mutates characters but keeps the same safe glyph set', () => {
    const [column] = createBinaryRainColumns({
        columnCount: 1,
        glyphs: 'Z9?',
        height: 500,
        rng: createDeterministicRandom([0.12, 0.44, 0.66, 0.88, 0.23, 0.57]),
        width: 700
    });

    const originalStream = column.stream;
    const updated = advanceBinaryRainColumn(column, {
        glyphs: 'Z9?',
        rng: createDeterministicRandom([0.81, 0.02, 0.94, 0.35, 0.61, 0.17])
    });

    assert.notEqual(updated.stream, originalStream);
    assert.equal(updated.cells.length, column.cells.length);
    assert.match(updated.stream, /^[Z9?\n]+$/);
});

test('default rain glyph pool can include letters, digits, and special characters', () => {
    const [column] = createBinaryRainColumns({
        columnCount: 1,
        height: 420,
        rng: createDeterministicRandom([0.02, 0.31, 0.97, 0.18, 0.54, 0.89, 0.07, 0.42, 0.93]),
        width: 640
    });

    assert.match(column.stream, /[A-Z]/);
    assert.match(column.stream, /[0-9]/);
    assert.match(column.stream, /[!?@#$%&*+\-=<>\[\]{}]/);
});

test('binary rain frames fall over time and loop by duration', () => {
    const column = {
        blurPx: 1.1,
        cells: Array.from({ length: 12 }, () => 'A'),
        delayMs: -250,
        durationMs: 1000,
        fontSizePx: 20,
        leftPercent: 37,
        opacity: 0.34
    };

    const first = getBinaryRainColumnFrame(column, {
        height: 400,
        timestamp: 100
    });
    const later = getBinaryRainColumnFrame(column, {
        height: 400,
        timestamp: 500
    });
    const looped = getBinaryRainColumnFrame(column, {
        height: 400,
        timestamp: 1500
    });

    assert.equal(first.leftPercent, 37);
    assert.equal(first.opacity, 0.34);
    assert.ok(first.y < later.y);
    assert.ok(Math.abs(later.y - looped.y) < 0.001);
    assert.ok(first.y >= -first.streamHeight * 1.25 - 0.001);
    assert.ok(later.y <= 400 * 1.35 + 0.001);
});
