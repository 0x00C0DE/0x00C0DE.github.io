import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { journeyState, moveJourney } from '../src/codex-feature-explore-state.mjs';

test('Back and revisiting preserve the branch; completion requires an explicit action', () => {
    let state = journeyState('robot');
    assert.equal(state.complete, false);
    assert.equal(moveJourney(state, 2).stage, 0);
    state = moveJourney(state, 'next');
    state = moveJourney(state, 'back');
    assert.equal(state.branch, 'robot');
    assert.equal(state.stage, 0);
    assert.equal(moveJourney(state, 'finish').complete, false);
    state = moveJourney(moveJourney(state, 'next'), 'next');
    assert.equal(state.complete, false);
    assert.equal(moveJourney(state, 'finish').complete, true);
    assert.equal(moveJourney(state, 0).stage, 0);
    assert.equal(moveJourney(state, 3).stage, 2);
    assert.throws(() => journeyState('unknown'), /Unknown/);
});

test('static journeys provide existing local destinations and valid anchors at every stage', () => {
    const html = readFileSync(new URL('../pages/explore.html', import.meta.url), 'utf8');
    assert.equal((html.match(/data-stage=/g) || []).length, 6);
    for (const [, path, anchor] of html.matchAll(/href="(\/(?:pages|content|src)\/[^"#]+)(?:#([^"]+))?"/g)) {
        const url = new URL(`..${path}`, import.meta.url);
        assert.ok(existsSync(url), path);
        if (anchor) assert.ok(readFileSync(url, 'utf8').includes(`id="${anchor}"`), anchor);
    }
    assert.ok(html.includes('/src/terminal-text-layout.mjs'));
});
