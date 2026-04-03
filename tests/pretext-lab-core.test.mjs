import test from 'node:test';
import assert from 'node:assert/strict';

import {
    PRETEXT_DEFAULT_STATE,
    buildPretextLayout,
    buildPretextLabHref,
    parsePretextStateFromSearch
} from '../pretext-lab-core.mjs';

test('parsePretextStateFromSearch clamps numeric params and keeps non-empty text', () => {
    const state = parsePretextStateFromSearch('?text=hello%20world&width=9999&fontSize=8&lineHeight=400&whiteSpace=normal');

    assert.equal(state.text, 'hello world');
    assert.equal(state.maxWidth, 960);
    assert.equal(state.fontSize, 12);
    assert.equal(state.lineHeight, 72);
    assert.equal(state.whiteSpace, 'normal');
});

test('buildPretextLayout normalizes state and shapes the pretext result for the lab ui', () => {
    const calls = [];
    const fakePretext = {
        prepareWithSegments(text, font, options) {
            calls.push({ type: 'prepare', text, font, options });
            return { token: 'prepared' };
        },
        layoutWithLines(prepared, maxWidth, lineHeight) {
            calls.push({ type: 'layout', prepared, maxWidth, lineHeight });
            return {
                lineCount: 2,
                height: 60,
                lines: [
                    { text: 'alpha beta', width: 95 },
                    { text: 'gamma', width: 50 }
                ]
            };
        }
    };

    const layout = buildPretextLayout(fakePretext, {
        text: 'alpha beta gamma',
        maxWidth: 100,
        fontSize: 20,
        lineHeight: 30,
        whiteSpace: 'normal'
    });

    assert.deepEqual(calls, [
        {
            type: 'prepare',
            text: 'alpha beta gamma',
            font: `20px ${PRETEXT_DEFAULT_STATE.fontFamily}`,
            options: { whiteSpace: 'normal' }
        },
        {
            type: 'layout',
            prepared: { token: 'prepared' },
            maxWidth: 100,
            lineHeight: 30
        }
    ]);
    assert.equal(layout.font, `${layout.fontSize}px ${PRETEXT_DEFAULT_STATE.fontFamily}`);
    assert.equal(layout.lineCount, 2);
    assert.equal(layout.height, 60);
    assert.deepEqual(layout.lines.map(line => line.text), ['alpha beta', 'gamma']);
    assert.equal(layout.widestLineWidth, 95);
});

test('buildPretextLabHref encodes text for the terminal command bridge', () => {
    assert.equal(
        buildPretextLabHref('measure this next'),
        'pretext-lab.html?text=measure+this+next'
    );
    assert.equal(buildPretextLabHref('   '), 'pretext-lab.html');
});
