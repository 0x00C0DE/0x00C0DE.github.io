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

test('su without arguments switches the session into a root kali prompt', () => {
    const session = applyTerminalSessionCommand(
        createDefaultTerminalSession(),
        'su',
        []
    );

    assert.deepEqual(session, {
        shell: 'kali',
        user: 'root'
    });
    assert.deepEqual(getTerminalPromptSnapshot(session), {
        documentTitle: 'root@kali: ~',
        host: 'kali',
        isRoot: true,
        mode: 'kali',
        path: '~',
        promptSymbol: '#',
        theme: 'kali-root',
        user: 'root'
    });
    assert.equal(getTerminalSessionUsername(session), 'root');
    assert.equal(getTerminalSessionPwd(session), '~');
});

test('su with a username keeps the kali shell but stays non-root', () => {
    const session = applyTerminalSessionCommand(
        createDefaultTerminalSession(),
        'su',
        ['analyst']
    );

    assert.deepEqual(getTerminalPromptSnapshot(session), {
        documentTitle: 'analyst@kali: ~',
        host: 'kali',
        isRoot: false,
        mode: 'kali',
        path: '~',
        promptSymbol: '$',
        theme: 'kali-user',
        user: 'analyst'
    });
    assert.equal(getTerminalSessionUsername(session), 'analyst');
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
