import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { feedback } from '../src/codex-feature-practice-model.mjs';
import { createBloom } from '../src/codex-feature-bloom-demo-model.mjs';
import { reset, step, segmentClearance } from '../src/codex-feature-collision-demo-core.mjs';

test('every prediction has explicit feedback, including incorrect choices', () => {
    for (const question of ['bloom', 'robot', 'layout']) {
        for (const choice of ['a', 'b', 'c']) {
            assert.match(feedback(question, choice), /^(Correct|Reconsider): .+/);
        }
    }
    assert.throws(() => feedback('missing', 'a'), RangeError);
    assert.throws(() => feedback('bloom', ''), RangeError);
});

test('answer keys agree with the existing Bloom and robot teaching models', () => {
    const bloom = createBloom();
    bloom.insert('cat'); bloom.insert('dog');
    assert.deepEqual(bloom.bits(), [0, 1, 2, 7]);
    assert.deepEqual(bloom.query('god').hashes, [2, 1]);
    assert.equal(bloom.query('god').decision, 'Probably present');
    assert.match(feedback('bloom', 'b'), /^Correct:/);
    const robot = reset();
    assert.equal(segmentClearance(robot.robot, { x: 23, y: 50 }, robot.obstacle), 7);
    assert.equal(step(step(robot)).hazard, true);
    assert.match(feedback('robot', 'b'), /^Correct:/);
    assert.match(feedback('layout', 'a'), /^Correct:/);
});

test('static questions and evidence survive without JavaScript and link to local demos', () => {
    const html = readFileSync(new URL('../pages/explore.html', import.meta.url), 'utf8');
    for (const key of ['bloom', 'robot', 'layout']) {
        assert.ok(html.includes(`id="${key}-evidence"><summary>`));
        for (const choice of ['a', 'b', 'c']) {
            assert.ok(html.includes(`id="${key}-${choice}" type="radio"`));
        }
    }
    for (const [, path, anchor] of html.matchAll(/href="(\/pages\/[^"#]+)#([^"]+)"/g)) {
        const target = readFileSync(new URL(`..${path}`, import.meta.url), 'utf8');
        assert.ok(target.includes(`id="${anchor}"`));
    }
});
