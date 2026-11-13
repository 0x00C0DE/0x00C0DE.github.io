import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const commandsUrl = new URL('../src/commands.js', import.meta.url);
const pageUrl = new URL('../pages/projects.html', import.meta.url);
const behaviorUrl = new URL('../src/codex-feature-project-browser.mjs', import.meta.url);

function pinnedProjects(source) {
    const entry = source.match(/"projects\.txt": \[(?<contents>[\s\S]*?)\n\s*\],/);
    assert.ok(entry, 'expected the projects.txt entry in src/commands.js');

    return [...entry.groups.contents.matchAll(/<a href="(?<href>[^"]+)">(?<title>[^<]+)<\/a>/g)]
        .map(({ groups }) => groups);
}

test('the projects page exposes every pinned project as a native browser link', async () => {
    const [commands, page] = await Promise.all([
        readFile(commandsUrl, 'utf8'),
        readFile(pageUrl, 'utf8'),
    ]);

    const projects = pinnedProjects(commands);
    assert.ok(projects.length > 0);
    assert.match(page, /<details class="project-browser">/);
    assert.match(page, /<nav aria-label="Pinned projects">/);
    assert.match(page, /src="\/src\/codex-feature-project-browser\.mjs"/);

    for (const { href, title } of projects) {
        assert.ok(page.includes(`<a href="${href}">${title}</a>`), title);
    }
});

test('Tab reaches project navigation from an empty prompt and retains terminal completion for typed commands', async () => {
    const body = {};
    const input = { value: '' };
    let tabHandler;
    let focusCount = 0;
    const browser = {
        addEventListener() {},
        contains: () => false,
        querySelector: () => ({ focus: () => focusCount++ }),
    };
    runInNewContext(await readFile(behaviorUrl, 'utf8'), {
        document: { body, querySelector: selector => selector === '.project-browser' ? browser : input },
        window: { addEventListener: (type, handler) => { tabHandler = handler; } },
    });
    let prevented = 0;
    const event = {
        key: 'Tab',
        target: input,
        preventDefault: () => prevented++,
        stopImmediatePropagation() {},
    };
    tabHandler(event);
    input.value = 'cat';
    tabHandler(event);
    tabHandler({ ...event, target: body });
    assert.equal(focusCount, 1);
    assert.equal(prevented, 1);
});
