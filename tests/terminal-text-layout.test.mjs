import assert from 'node:assert/strict';
import test from 'node:test';
import { layoutTerminalText, measureTerminalText, tokenizeTerminalText } from '../src/terminal-text-layout.mjs';

const measure = text => Array.from(text).length;
function layout(text, options) {
    const pieces = measureTerminalText(tokenizeTerminalText(text), measure);
    return layoutTerminalText(pieces, { width: 16, lineHeight: 2, measure, ...options });
}

test('text routes around overlapping media and resumes below fully obstructed rows', () => {
    const lines = layout('alpha beta gamma', {
        obstacles: [
            { x: 5, y: 0, width: 5, height: 2 },
            { x: 8, y: 0, width: 3, height: 2 },
            { x: 0, y: 2, width: 16, height: 2 }
        ]
    });
    assert.deepEqual(lines.map(line => [line.x, line.y, line.plans.map(plan => plan.text).join('')]), [
        [0, 0, 'alpha'],
        [11, 0, ' beta'],
        [0, 4, ' gamma']
    ]);
});

test('wrapped links keep their destination and hard line breaks keep blank rows', () => {
    const href = 'https://example.com/long';
    const lines = layout(href + '\n\nnext', {});
    assert.equal(lines.slice(0, 2).flatMap(line => line.plans).map(plan => plan.text).join(''), href);
    assert.ok(lines.slice(0, 2).flatMap(line => line.plans).every(plan => plan.fragment.href === href));
    assert.deepEqual(lines.slice(2).map(line => line.plans.map(plan => plan.text)), [[], ['next']]);
});

test('a narrow terminal keeps a grapheme intact even when it exceeds one row', () => {
    const lines = layout('👩‍💻x', { width: 1 });
    assert.deepEqual(lines.map(line => line.plans.map(plan => plan.text)), [['👩‍💻'], ['x']]);
});
