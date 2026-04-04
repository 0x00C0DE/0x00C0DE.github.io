import test from 'node:test';
import assert from 'node:assert/strict';

import {
    buildTerminalEditorialLayout,
    buildTerminalPretextLayout,
    getTerminalTextFromTokens,
    tokenizeTerminalText
} from '../terminal-pretext-core.mjs';

function createLinkOptions() {
    return {
        normalizeTextFilename(value) {
            if (String(value).toLowerCase() === 'projects.txt') {
                return 'projects.txt';
            }
            return null;
        }
    };
}

test('tokenizeTerminalText preserves plain text and terminal link metadata', () => {
    const tokens = tokenizeTerminalText(
        'Use projects.txt and https://example.com plus resume.pdf',
        createLinkOptions()
    );

    assert.deepEqual(tokens, [
        { type: 'text', text: 'Use ', start: 0, end: 4 },
        {
            type: 'link',
            text: 'projects.txt',
            href: '?command=cat%20projects.txt',
            newTab: false,
            start: 4,
            end: 16
        },
        { type: 'text', text: ' and ', start: 16, end: 21 },
        {
            type: 'link',
            text: 'https://example.com',
            href: 'https://example.com',
            newTab: true,
            start: 21,
            end: 40
        },
        { type: 'text', text: ' plus ', start: 40, end: 46 },
        {
            type: 'link',
            text: 'resume.pdf',
            href: 'resume.pdf',
            newTab: true,
            start: 46,
            end: 56
        }
    ]);
    assert.equal(getTerminalTextFromTokens(tokens), 'Use projects.txt and https://example.com plus resume.pdf');
});

test('buildTerminalPretextLayout preserves link fragments inside wrapped terminal lines', () => {
    const tokens = tokenizeTerminalText('Use projects.txt today', createLinkOptions());
    const calls = [];
    const fakePretext = {
        prepareWithSegments(text, font, options) {
            calls.push({ type: 'prepare', text, font, options });
            return {
                segments: ['Use ', 'projects.txt', ' today']
            };
        },
        layoutWithLines(prepared, maxWidth, lineHeight) {
            calls.push({ type: 'layout', prepared, maxWidth, lineHeight });
            return {
                lineCount: 2,
                height: 42,
                lines: [
                    {
                        text: 'Use projects.txt',
                        width: 120,
                        start: { segmentIndex: 0, graphemeIndex: 0 },
                        end: { segmentIndex: 2, graphemeIndex: 0 }
                    },
                    {
                        text: ' today',
                        width: 48,
                        start: { segmentIndex: 2, graphemeIndex: 0 },
                        end: { segmentIndex: 2, graphemeIndex: 6 }
                    }
                ]
            };
        }
    };

    const layout = buildTerminalPretextLayout(fakePretext, {
        tokens,
        font: '18px "Courier New", monospace',
        lineHeight: 21,
        maxWidth: 160,
        whiteSpace: 'pre-wrap'
    });

    assert.deepEqual(calls, [
        {
            type: 'prepare',
            text: 'Use projects.txt today',
            font: '18px "Courier New", monospace',
            options: { whiteSpace: 'pre-wrap' }
        },
        {
            type: 'layout',
            prepared: {
                segments: ['Use ', 'projects.txt', ' today']
            },
            maxWidth: 160,
            lineHeight: 21
        }
    ]);
    assert.equal(layout.lineCount, 2);
    assert.equal(layout.height, 42);
    assert.deepEqual(layout.lines[0].fragments, [
        { type: 'text', text: 'Use ' },
        {
            type: 'link',
            text: 'projects.txt',
            href: '?command=cat%20projects.txt',
            newTab: false
        }
    ]);
    assert.deepEqual(layout.lines[1].fragments, [
        { type: 'text', text: ' today' }
    ]);
});

test('buildTerminalPretextLayout can split a single terminal link across multiple wrapped lines', () => {
    const tokens = tokenizeTerminalText('https://example.com', createLinkOptions());
    const fakePretext = {
        prepareWithSegments() {
            return {
                segments: ['https://example.com']
            };
        },
        layoutWithLines() {
            return {
                lineCount: 2,
                height: 40,
                lines: [
                    {
                        text: 'https://',
                        width: 70,
                        start: { segmentIndex: 0, graphemeIndex: 0 },
                        end: { segmentIndex: 0, graphemeIndex: 8 }
                    },
                    {
                        text: 'example.com',
                        width: 95,
                        start: { segmentIndex: 0, graphemeIndex: 8 },
                        end: { segmentIndex: 0, graphemeIndex: 19 }
                    }
                ]
            };
        }
    };

    const layout = buildTerminalPretextLayout(fakePretext, {
        tokens,
        font: '18px "Courier New", monospace',
        lineHeight: 20,
        maxWidth: 100
    });

    assert.deepEqual(layout.lines.map(line => line.fragments), [
        [
            {
                type: 'link',
                text: 'https://',
                href: 'https://example.com',
                newTab: true
            }
        ],
        [
            {
                type: 'link',
                text: 'example.com',
                href: 'https://example.com',
                newTab: true
            }
        ]
    ]);
});

test('buildTerminalEditorialLayout routes terminal lines around media obstacles', () => {
    const tokens = tokenizeTerminalText('https://example.com', createLinkOptions());
    const widthCalls = [];
    const fakePretext = {
        prepareWithSegments() {
            return {
                segments: ['https://example.com'],
                widths: [190]
            };
        },
        layoutNextLine(_prepared, start, maxWidth) {
            widthCalls.push({ graphemeIndex: start.graphemeIndex, maxWidth });

            if (start.graphemeIndex === 0) {
                return {
                    text: 'https://',
                    width: 64,
                    start: { segmentIndex: 0, graphemeIndex: 0 },
                    end: { segmentIndex: 0, graphemeIndex: 8 }
                };
            }

            if (start.graphemeIndex === 8) {
                return {
                    text: 'example.com',
                    width: 95,
                    start: { segmentIndex: 0, graphemeIndex: 8 },
                    end: { segmentIndex: 0, graphemeIndex: 19 }
                };
            }

            return null;
        }
    };

    const layout = buildTerminalEditorialLayout(fakePretext, {
        tokens,
        font: '18px "Courier New", monospace',
        lineHeight: 20,
        maxWidth: 200,
        minSegmentWidth: 40,
        obstacles: [
            {
                x: 72,
                y: 0,
                width: 48,
                height: 20
            }
        ]
    });

    assert.deepEqual(widthCalls, [
        { graphemeIndex: 0, maxWidth: 72 },
        { graphemeIndex: 8, maxWidth: 80 },
        { graphemeIndex: 19, maxWidth: 200 }
    ]);
    assert.equal(layout.lineCount, 2);
    assert.equal(layout.height, 20);
    assert.equal(layout.textHeight, 20);
    assert.deepEqual(
        layout.lines.map(line => ({ text: line.text, x: line.x, y: line.y })),
        [
            { text: 'https://', x: 0, y: 0 },
            { text: 'example.com', x: 120, y: 0 }
        ]
    );
    assert.deepEqual(layout.lines.map(line => line.fragments), [
        [
            {
                type: 'link',
                text: 'https://',
                href: 'https://example.com',
                newTab: true
            }
        ],
        [
            {
                type: 'link',
                text: 'example.com',
                href: 'https://example.com',
                newTab: true
            }
        ]
    ]);
});

test('buildTerminalEditorialLayout keeps text height stable when obstacles sit below the rendered text', () => {
    const tokens = tokenizeTerminalText('hello', createLinkOptions());
    const fakePretext = {
        prepareWithSegments() {
            return {
                segments: ['hello'],
                widths: [50]
            };
        },
        layoutNextLine(_prepared, start) {
            if (start.graphemeIndex === 0) {
                return {
                    text: 'hello',
                    width: 50,
                    start: { segmentIndex: 0, graphemeIndex: 0 },
                    end: { segmentIndex: 0, graphemeIndex: 5 }
                };
            }

            return null;
        }
    };

    const layout = buildTerminalEditorialLayout(fakePretext, {
        tokens,
        font: '18px "Courier New", monospace',
        lineHeight: 20,
        maxWidth: 200,
        minSegmentWidth: 40,
        obstacles: [
            {
                x: 0,
                y: 220,
                width: 80,
                height: 80
            }
        ]
    });

    assert.equal(layout.height, 300);
    assert.equal(layout.textHeight, 20);
    assert.equal(layout.lineCount, 1);
});
