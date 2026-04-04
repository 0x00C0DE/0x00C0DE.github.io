import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readStyleSheet() {
    return readFile(new URL('../style.css', import.meta.url), 'utf8');
}

function getCssBlock(source, selector) {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 'm').exec(source);
    return match ? match[1] : '';
}

test('input line shell keeps the live terminal input full-width instead of clipping typed text', async () => {
    const css = await readStyleSheet();
    const shellBlock = getCssBlock(css, '.input-line-shell');
    const inputBlock = getCssBlock(css, '.terminal-input');

    assert.match(shellBlock, /display:\s*flex\s*;/);
    assert.match(shellBlock, /width:\s*100%\s*;/);
    assert.match(shellBlock, /min-width:\s*0\s*;/);

    assert.match(inputBlock, /flex:\s*1\s+1\s+auto\s*;/);
    assert.match(inputBlock, /width:\s*100%\s*;/);
    assert.match(inputBlock, /min-width:\s*0\s*;/);
});
