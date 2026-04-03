import test from 'node:test';
import assert from 'node:assert/strict';

import {
    applyTerminalSessionCommand,
    createDefaultTerminalSession,
    getTerminalPromptSnapshot,
    getTerminalSessionPwd,
    getTerminalSessionUsername
} from '../terminal-session-core.mjs';

test('default terminal session keeps the original guest prompt', () => {
    const session = createDefaultTerminalSession();
    const snapshot = getTerminalPromptSnapshot(session);

    assert.deepEqual(session, {
        shell: 'default',
        user: 'guest'
    });
    assert.deepEqual(snapshot, {
        documentTitle: null,
        host: 'localhost',
        isRoot: false,
        mode: 'default',
        path: '/home/0x00C0DE/Unkn0wn',
        promptSymbol: '$',
        theme: 'default',
        user: 'guest'
    });
});

test('su without arguments switches the session into a root localhost prompt', () => {
    const session = applyTerminalSessionCommand(
        createDefaultTerminalSession(),
        'su',
        []
    );

    assert.deepEqual(session, {
        shell: 'default',
        user: 'root'
    });
    assert.deepEqual(getTerminalPromptSnapshot(session), {
        documentTitle: null,
        host: 'localhost',
        isRoot: true,
        mode: 'default',
        path: '/home/0x00C0DE/Unkn0wn',
        promptSymbol: '$',
        theme: 'default',
        user: 'root'
    });
    assert.equal(getTerminalSessionUsername(session), 'root');
    assert.equal(getTerminalSessionPwd(session), '/home/0x00C0DE/Unkn0wn');
});

test('su guest switches back to the guest localhost prompt', () => {
    const rootSession = applyTerminalSessionCommand(
        createDefaultTerminalSession(),
        'su',
        []
    );
    const session = applyTerminalSessionCommand(rootSession, 'su', ['guest']);

    assert.deepEqual(getTerminalPromptSnapshot(session), {
        documentTitle: null,
        host: 'localhost',
        isRoot: false,
        mode: 'default',
        path: '/home/0x00C0DE/Unkn0wn',
        promptSymbol: '$',
        theme: 'default',
        user: 'guest'
    });
    assert.equal(getTerminalSessionUsername(session), 'guest');
});

test('unsupported su usernames leave the current shell profile unchanged', () => {
    const rootSession = applyTerminalSessionCommand(
        createDefaultTerminalSession(),
        'su',
        []
    );

    assert.deepEqual(
        applyTerminalSessionCommand(rootSession, 'su', ['analyst']),
        rootSession
    );
    assert.deepEqual(
        applyTerminalSessionCommand(rootSession, 'su', ['root']),
        rootSession
    );
});

test('non-session commands do not change the current shell profile', () => {
    const rootSession = applyTerminalSessionCommand(
        createDefaultTerminalSession(),
        'su',
        []
    );

    assert.deepEqual(
        applyTerminalSessionCommand(rootSession, 'whoami', []),
        rootSession
    );
});
