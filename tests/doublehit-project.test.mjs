import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Double Hit Collectibles is available from both project indexes and its terminal page', async () => {
    const [commands, projects, projectPage, projectContent] = await Promise.all([
        readFile(new URL('../src/commands.js', import.meta.url), 'utf8'),
        readFile(new URL('../content/projects.txt', import.meta.url), 'utf8'),
        readFile(new URL('../pages/project-doublehitcollectibles.html', import.meta.url), 'utf8'),
        readFile(new URL('../content/doublehitcollectibles.txt', import.meta.url), 'utf8')
    ]);

    assert.match(commands, /"doublehitcollectibles\.txt"\s*:/);
    assert.match(commands, /project-doublehitcollectibles\.html/);
    assert.match(projects, /doublehitcollectibles\.txt/);
    assert.match(projects, /project-doublehitcollectibles\.html/);
    assert.match(projectPage, /cat doublehitcollectibles\.txt/);
    assert.match(projectContent, /https:\/\/doublehitcollectibles\.github\.io/);
});
