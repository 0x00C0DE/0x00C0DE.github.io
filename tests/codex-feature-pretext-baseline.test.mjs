import test from 'node:test';
import assert from 'node:assert/strict';
import { pinBaseline, baselineDeltas } from '../src/codex-feature-pretext-baseline-core.mjs';
import { buildPretextLayout } from '../src/pretext-lab-core.mjs';

const api = {
    prepareWithSegments(text) { return text; },
    layoutWithLines(text, width, lineHeight) {
        const lines = text.split('\n').map(text => ({ text, width: text.length * 10 }));
        return { lines, lineCount: lines.length, height: lines.length * lineHeight };
    }
};

test('pin freezes text, settings, lines and metrics independently of current edits', () => {
    const current = buildPretextLayout(api, { text: 'Original\nSecond', lineHeight: 28 });
    const baseline = pinBaseline(current);
    const expected = structuredClone(current);
    current.text = 'Changed';
    current.maxWidth = 80;
    current.lines[0].text = 'Changed';
    current.lines.push({ text: 'Extra', width: 50 });
    current.height = 100;
    assert.deepEqual(baseline, expected);
    assert.throws(() => { baseline.lines[0].text = 'Mutation'; }, TypeError);
    assert.throws(() => { baseline.maxWidth = 960; }, TypeError);
});

test('identical layouts have zero deltas; changes are current minus baseline', () => {
    const input = { text: 'Original\nSecond', lineHeight: 28 };
    const baseline = pinBaseline(buildPretextLayout(api, input));
    assert.deepEqual(baselineDeltas(buildPretextLayout(api, input), baseline), {
        lines: 0, height: 0, widest: 0
    });
    assert.deepEqual(baselineDeltas(buildPretextLayout(api, { text: 'New', lineHeight: 30 }), baseline), {
        lines: -1, height: -26, widest: -50
    });
});
