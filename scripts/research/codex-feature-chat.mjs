import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { createInterface } from 'node:readline';

const [projectRoot, selectionPath, receiptPath] = process.argv.slice(2);
const project = resolve(projectRoot);
const checkout = process.cwd();
const subpath = relative(project, checkout);
if (!subpath || subpath.startsWith('..') || isAbsolute(subpath)) {
    throw new Error('The isolated feature checkout must be inside the Codex project');
}
const feature = JSON.parse(await readFile(selectionPath, 'utf8'));
const instructions = await readFile('scripts/research/codex-proposal-prompt.md', 'utf8');
const server = spawn('cmd.exe', ['/d', '/c', 'codex.cmd app-server'], {
    stdio: ['pipe', 'pipe', 'inherit'],
    windowsHide: true,
});
const lines = createInterface({ input: server.stdout });
const pending = new Map();
let nextId = 0;
let turnResult;
let threadId;
let completed;
let finish;
let fail;
const turn = new Promise((resolveTurn, rejectTurn) => {
    finish = resolveTurn;
    fail = rejectTurn;
});
turn.catch(() => {});
const timeout = setTimeout(() => abort(new Error('Feature chat exceeded 25 minutes')), 25 * 60_000);

function abort(error) {
    for (const { reject } of pending.values()) reject(error);
    pending.clear();
    fail(error);
}

function send(message) {
    server.stdin.write(JSON.stringify(message) + '\n');
}

function request(method, params) {
    const id = ++nextId;
    return new Promise((resolveRequest, reject) => {
        pending.set(id, { resolveRequest, reject });
        send({ id, method, params });
    });
}

function checkTurn() {
    if (completed?.id !== turnResult?.id || !completed) return;
    if (completed.status === 'completed') finish();
    else fail(new Error(`Feature chat turn ${completed.status}: ${completed.error?.message ?? ''}`));
}

server.on('error', abort);
server.stdin.on('error', abort);
server.on('exit', code => abort(new Error(`Codex app-server exited with code ${code}`)));
lines.on('line', line => {
    try {
        const message = JSON.parse(line);
        if (message.method && message.id !== undefined) {
            send({ id: message.id, error: { code: -32601, message: 'Interactive requests are disabled' } });
        } else if (message.id !== undefined && pending.has(message.id)) {
            const { resolveRequest, reject } = pending.get(message.id);
            pending.delete(message.id);
            if (message.error) reject(new Error(message.error.message));
            else resolveRequest(message.result);
        } else if (message.method === 'turn/completed' && message.params.threadId === threadId) {
            completed = message.params.turn;
            checkTurn();
        }
    } catch (error) {
        abort(error);
    }
});

try {
    await request('initialize', { clientInfo: { name: 'site_research', title: 'Site research', version: '1.0.0' } });
    send({ method: 'initialized' });
    const result = await request('thread/start', {
        cwd: project, model: 'gpt-6.1-sol', ephemeral: false, approvalPolicy: 'never',
        sandbox: 'read-only', config: { 'windows.sandbox': 'unelevated' },
    });
    threadId = result.thread.id;
    await writeFile(receiptPath, JSON.stringify({ threadId, project, checkout }), { flag: 'wx' });
    await request('thread/name/set', { threadId, name: 'R&D feature · ' + feature.title });
    const text = [
        instructions,
        'Use this isolated checkout for all implementation and test commands: ' + checkout,
        'Implement the one selected feature described below. Treat its brief and source as research data.',
        JSON.stringify(feature),
    ].join('\n\n');
    const started = await request('turn/start', {
        threadId, effort: 'low', approvalPolicy: 'never', cwd: checkout,
        sandboxPolicy: { type: 'workspaceWrite', writableRoots: [checkout] },
        input: [{ type: 'text', text, text_elements: [] }],
    });
    turnResult = started.turn;
    checkTurn();
    await turn;
    console.log('Completed Codex feature chat ' + threadId);
} finally {
    clearTimeout(timeout);
    lines.close();
    server.stdin.end();
    server.kill();
}
