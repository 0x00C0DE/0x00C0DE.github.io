import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

test('filter controls are progressive and panel keystrokes cannot reach terminal handlers', async () => {
    const page = await readFile(new URL('../pages/projects.html', import.meta.url), 'utf8');
    assert.match(page, /<div id="project-filter-controls" hidden>/);
    assert.match(page, /<label for="project-filter">Filter by project title<\/label>/);
    assert.match(page, /id="project-filter-count" role="status" aria-live="polite"/);
    assert.match(page, /src="\/src\/codex-feature-project-filter.mjs"/);
    let keyHandler;
    const browser = {
        addEventListener(type, handler) { if (type === 'keydown') keyHandler = handler; },
    };
    runInNewContext(await readFile(new URL('../src/codex-feature-project-browser.mjs', import.meta.url), 'utf8'), {
        document: { querySelector: () => browser },
        window: { addEventListener() {} },
    });
    for (const key of ['b', 'Enter', 'Tab', 'Escape']) {
        let stopped = false;
        keyHandler({ key, stopPropagation() { stopped = true; } });
        assert.equal(stopped, true, key);
    }
});

test('title filtering handles case, no matches, and clearing without replacing links', async () => {
    const { attachProjectFilter } = await import('../src/codex-feature-project-filter.mjs');
    const page = await readFile(new URL('../pages/projects.html', import.meta.url), 'utf8');
    const links = [...page.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)]
        .map(([, href, textContent]) => ({ href, textContent, hidden: false }));
    assert.equal(links.length, 7);
    const destinations = links.map(link => link.href);
    const handlers = {};
    const input = { value: '', addEventListener: (type, handler) => { handlers[type] = handler; } };
    const status = { textContent: '' };
    const empty = { hidden: true };
    const controls = { hidden: true };
    attachProjectFilter({ input, status, empty, controls, links });
    assert.equal(controls.hidden, false);
    assert.equal(status.textContent, '7 of 7 projects');
    input.value = '  bLoOm  ';
    handlers.input();
    assert.deepEqual(links.filter(link => !link.hidden).map(link => link.textContent),
        ['Bloom Filter Password Screening']);
    assert.equal(status.textContent, '1 of 7 projects');
    assert.equal(empty.hidden, true);
    input.value = '<script>no matches</script>';
    handlers.input();
    assert.ok(links.every(link => link.hidden));
    assert.equal(status.textContent, '0 of 7 projects');
    assert.equal(empty.hidden, false);
    input.value = '';
    handlers.input();
    assert.ok(links.every(link => !link.hidden));
    assert.equal(empty.hidden, true);
    assert.deepEqual(links.map(link => link.href), destinations);
});
