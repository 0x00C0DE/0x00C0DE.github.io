import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeBlogPostText, encodeBlogTextLine } from '../src/blog-post-text.mjs';

test('post text preserves punctuation and multilingual content', () => {
    assert.deepEqual(normalizeBlogPostText("  O’Reilly; SELECT café, 東京  ", 500), {
        text: "O’Reilly; SELECT café, 東京",
    });
    assert.deepEqual(normalizeBlogPostText('First\r\nSecond', 500, { multiline: true }), {
        text: 'First\nSecond',
    });
});

test('validation rejects malformed strings before whitespace normalization', () => {
    for (const input of [123, '\u000Bhello', 'hi\u0085', 'hi\u202E', '\uD800', '  toolong']) {
        assert.ok(normalizeBlogPostText(input, 7).error);
    }
});

test('blog serialization escapes structural text lines while preserving ordinary brackets', () => {
    for (const line of ['[image-url]', '[/image-base64]', '[2026-01-02T03:04:05Z]', '[text-escaped]abc']) {
        assert.equal(encodeBlogTextLine(line), '[text-escaped]' + line);
    }
    assert.equal(encodeBlogTextLine('[notes]'), '[notes]');
});

test('segmented posts enforce the combined raw length and preserve attachment order', async () => {
    const { normalizeBlogPostTextBlocks } = await import('../src/blog-upload-core.mjs');
    const image = { type: 'image' };
    const blocks = [{ type: 'text', text: ' α ' }, image, { type: 'text', text: '😀' }];
    assert.ok(normalizeBlogPostTextBlocks(blocks, 4).error);
    assert.deepEqual(normalizeBlogPostTextBlocks(blocks, 5), {
        blocks: [{ type: 'text', text: 'α' }, image, { type: 'text', text: '😀' }],
    });
});
