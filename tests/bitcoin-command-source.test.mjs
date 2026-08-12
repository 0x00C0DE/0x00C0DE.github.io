import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const commandsUrl = new URL('../src/commands.js', import.meta.url);
const terminalUrl = new URL('../src/terminal-canvas-core.mjs', import.meta.url);

test('bitcoin analytics is registered as a terminal command and documented in help', async () => {
    const [commands, terminal] = await Promise.all([
        readFile(commandsUrl, 'utf8'),
        readFile(terminalUrl, 'utf8')
    ]);

    assert.match(commands, /async function bitcoin_command\(args\)/);
    assert.match(commands, /\['bitcoin <interval>',\s*'Analyze/);
    assert.match(terminal, /\['bitcoin', window\.bitcoin_command\]/);
});

test('bitcoin command loads only repository data and requests bounded file tails', async () => {
    const commands = await readFile(commandsUrl, 'utf8');

    assert.match(commands, /\/bitcoindata\//);
    assert.match(commands, /Range/);
    assert.match(commands, /bytes=-/);
    assert.match(commands, /response\.status === 416/);
    assert.doesNotMatch(commands, /api\.robinhood|coinbase|coingecko/i);
});
