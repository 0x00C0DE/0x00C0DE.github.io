import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const page = read('../pages/project-smallsh.html');
const source = read('../content/smallsh.txt');

test('Smallsh flow keeps every stage and connection grounded in its public source', () => {
    assert.match(page, /Illustrative flow/);
    const evidence = 'tokenizes shell input, launches foreground and background jobs, and tracks process lifecycle events';
    assert.ok(source.includes(evidence));
    assert.ok(page.includes(`<dd>${evidence}</dd>`));
    assert.ok(page.includes('<dl id="smallsh-behavior">'));
    assert.match(page, /<ol id="project-flow-order">/);
    for (const stage of ['input', 'jobs', 'lifecycle']) {
        assert.match(page, new RegExp(`<details id="flow-${stage}">`));
        const detail = page.match(new RegExp(`<details id="flow-${stage}">([\\s\\S]*?)</details>`))[1];
        assert.ok(detail.includes('href="#smallsh-behavior"'));
        assert.ok(detail.includes('href="/content/smallsh.txt"'));
    }
    assert.match(page, /Input → jobs:/);
    assert.match(page, /Jobs → lifecycle:/);
    assert.match(page, /not a runtime trace/);
});
