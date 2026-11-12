import assert from 'node:assert/strict';
import test from 'node:test';
import { planCycle } from '../scripts/research/preflight.mjs';

const now = Date.parse('2026-11-12T18:00:00Z');
const hour = 3_600_000;
const tasks = [
    { id: 'routine', value: 5, confidence: 0.8, risk: 'low', apiCostCents: 15, weeklyFraction: 0.03, shortFraction: 0.03 },
    { id: 'urgent', value: 8, confidence: 0.9, risk: 'low', urgent: true, apiCostCents: 50, weeklyFraction: 0.08, shortFraction: 0.04 },
];

function plan(hours, weekly = 0.8, short = 0.9, overrides = {}) {
    return planCycle({
        now, tasks, mode: 'chatgpt-plan',
        observation: {
            observedAt: new Date(now).toISOString(),
            weeklyResetAt: new Date(now + hours * hour).toISOString(),
            previousWeeklyResetAt: new Date(now - (168 - hours) * hour).toISOString(),
            weeklyRemaining: weekly,
            shortRemaining: short,
            shortResetAt: new Date(now + 3 * hour).toISOString(),
        },
        ...overrides,
    });
}

test('freshly reset and midweek choose efficient routine work', () => {
    assert.equal(plan(164).phase, 'first-24h');
    assert.equal(plan(120).task, 'routine');
});
test('low weekly allowance favors urgent work', () => {
    assert.equal(plan(100, 0.16).task, 'urgent');
});
test('weekly and short windows independently block work', () => {
    assert.equal(plan(72, 0).task, null);
    assert.equal(plan(72, 0.9, 0).task, null);
});
test('the last day releases reserve but one hour is too short for the safety margin', () => {
    assert.equal(plan(24, 0.08).task, 'routine');
    assert.equal(plan(1).reason, 'reset-too-close');
});
test('missing, stale and elapsed observations do not authorize a launch', () => {
    assert.equal(plan(100, 1, 1, { observation: null }).reason, 'usage-unknown');
    assert.equal(plan(-1).reason, 'usage-unknown');
    assert.equal(plan(100, 1, 1, { observation: {
        observedAt: '2026-11-12T12:00:00Z', weeklyResetAt: '2026-11-17T12:00:00Z', weeklyRemaining: 1,
    } }).reason, 'usage-unknown');
});
test('changed verified reset controls scheduling and new telemetry resumes it', () => {
    assert.equal(plan(2).phase, 'final-24h');
    assert.equal(plan(80).phase, 'steady');
    assert.equal(plan(-1).task, null);
    assert.equal(plan(167).task, 'routine');
});
test('API capacity is independent of plan data and accounts for pending charges', () => {
    const input = {
        now, tasks, mode: 'openai-api',
        api: { periodStart: '2026-11-09T00:00:00Z', periodEnd: '2026-11-16T00:00:00Z', limitCents: 2000, bookedCents: 500, pendingCents: 0, observedAt: new Date(now).toISOString() },
    };
    assert.equal(planCycle(input).task, 'routine');
    assert.equal(planCycle({ ...input, api: { ...input.api, pendingCents: 1500 } }).task, null);
});
test('duplicates, unresolved executions, active PRs, unsafe work and missing design tooling defer', () => {
    assert.equal(plan(24, 1, 1, { active: true }).reason, 'work-active');
    assert.equal(plan(24, 1, 1, { duplicate: true }).reason, 'work-active');
    assert.equal(plan(24, 1, 1, { cooldownUntil: now + hour }).reason, 'cooldown');
    assert.equal(plan(24, 1, 1, { tasks: [] }).task, null);
    assert.equal(plan(24, 1, 1, { tasks: [{ ...tasks[0], frontend: true }] }).task, null);
    assert.equal(plan(24, 1, 1, { tasks: [{ ...tasks[1], risk: 'high' }] }).task, null);
});

test('an observed reset invalidates pre-reset telemetry and a near short reset blocks launch', () => {
    const observation = {
        observedAt: new Date(now - hour).toISOString(),
        previousWeeklyResetAt: new Date(now - hour / 2).toISOString(),
        weeklyResetAt: new Date(now + 167 * hour).toISOString(),
        weeklyRemaining: 0.8,
        shortRemaining: 0.9,
        shortResetAt: new Date(now + 3 * hour).toISOString(),
    };
    assert.equal(plan(167, 0.8, 0.9, { observation }).reason, 'usage-unknown');
    assert.equal(plan(167, 0.8, 0.9, {
        observation: {
            ...observation,
            observedAt: new Date(now).toISOString(),
            shortResetAt: new Date(now + hour).toISOString(),
        },
    }).reason, 'reset-too-close');
});

test('API telemetry from the previous allocation period is rejected', () => {
    const api = {
        periodStart: new Date(now - hour).toISOString(),
        periodEnd: new Date(now + 167 * hour).toISOString(),
        observedAt: new Date(now - 2 * hour).toISOString(),
        limitCents: 2000, bookedCents: 0, pendingCents: 0,
    };
    assert.equal(planCycle({ now, mode: 'openai-api', api, tasks }).reason, 'usage-unknown');
});

test('an explicitly inapplicable short window requires no short-window estimate', () => {
    const observation = {
        observedAt: new Date(now).toISOString(),
        weeklyResetAt: new Date(now + 120 * hour).toISOString(),
        weeklyRemaining: 0.8,
        shortWindowApplies: false,
    };
    assert.equal(plan(120, 0.8, 1, {
        observation, tasks: [{ ...tasks[0], shortFraction: undefined }],
    }).task, 'routine');
});
