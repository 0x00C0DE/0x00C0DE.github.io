import test from 'node:test';
import assert from 'node:assert/strict';
import { reset, step, moveObstacle, segmentClearance } from '../src/codex-feature-collision-demo-core.mjs';

test('reset and sense → detect → steer are deterministic', () => {
    const start = reset();
    const sensed = step(start);
    assert.equal(sensed.phase, 'detect');
    assert.deepEqual(sensed.robot, start.robot);
    const detected = step(sensed);
    assert.equal(detected.phase, 'steer');
    assert.equal(detected.hazard, true);
    const moved = step(detected);
    assert.notDeepEqual(moved.robot, start.robot);
    assert.deepEqual(step(step(step(reset()))), moved);
    assert.deepEqual(reset(), start);
});

test('every swept movement preserves 8 units of surface clearance and arena bounds', () => {
    for (let x = 15; x <= 85; x += 10) for (let y = 15; y <= 85; y += 10) {
        if (segmentClearance(reset().robot, reset().robot, { x, y }) < 8) continue;
        let state = moveObstacle(reset(), x, y);
        for (let i = 0; i < 150; i++) {
            const next = step(state);
            assert.ok(segmentClearance(state.robot, next.robot, next.obstacle) >= 8 - 1e-9);
            assert.ok(next.robot.x >= 5 && next.robot.x <= 95);
            assert.ok(next.robot.y >= 5 && next.robot.y <= 95);
            state = next;
        }
    }
});

test('invalid or overlapping obstacle edits are rejected; valid edits invalidate sensing', () => {
    for (const [x, y] of [[NaN, 50], [Infinity, 50], [0, 50], [15, 50]]) {
        assert.throws(() => moveObstacle(reset(), x, y), RangeError);
    }
    const state = moveObstacle(step(reset()), 70, 80);
    assert.equal(state.phase, 'sense');
    assert.equal(step(step(state)).hazard, false);
});

test('boundary edits and hold preserve the clearance rule', () => {
    const boundary = moveObstacle(reset(), 38, 50);
    assert.equal(segmentClearance(boundary.robot, boundary.robot, boundary.obstacle), 8);
    const held = step({ ...boundary, phase: 'steer', robot: { x: 95, y: 50 }, obstacle: { x: 10, y: 10 } });
    assert.deepEqual(held.robot, { x: 95, y: 50 });
    for (const [x, y] of [[10, 10], [90, 90]]) assert.doesNotThrow(() => moveObstacle(reset(), x, y));
});
