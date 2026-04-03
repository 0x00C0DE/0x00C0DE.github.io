const DEFAULT_TERMINAL_SESSION = Object.freeze({
    shell: 'default',
    user: 'guest'
});

const DEFAULT_PROMPT_SNAPSHOT = Object.freeze({
    documentTitle: null,
    host: 'localhost',
    isRoot: false,
    mode: 'default',
    path: '/home/0x00C0DE/Unkn0wn',
    promptSymbol: '$',
    theme: 'default',
    user: 'guest'
});

function sanitizeUsername(value, fallback = DEFAULT_TERMINAL_SESSION.user) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed || fallback;
}

export function createDefaultTerminalSession() {
    return {
        ...DEFAULT_TERMINAL_SESSION
    };
}

export function normalizeTerminalSession(session) {
    if (!session || typeof session !== 'object') {
        return createDefaultTerminalSession();
    }

    return {
        shell: 'default',
        user: sanitizeUsername(session.user)
    };
}

export function resolveSuTarget(args = []) {
    if (!Array.isArray(args) || args.length === 0) {
        return 'root';
    }

    return sanitizeUsername(args[0], 'root');
}

export function applyTerminalSessionCommand(session, command, args = []) {
    const normalized = normalizeTerminalSession(session);
    if (String(command || '').toLowerCase() !== 'su') {
        return normalized;
    }

    return {
        shell: 'default',
        user: resolveSuTarget(args)
    };
}

export function getTerminalPromptSnapshot(session) {
    const normalized = normalizeTerminalSession(session);
    const isRoot = normalized.user.toLowerCase() === 'root';
    return {
        ...DEFAULT_PROMPT_SNAPSHOT,
        documentTitle: null,
        host: 'localhost',
        isRoot,
        mode: 'default',
        path: '/home/0x00C0DE/Unkn0wn',
        promptSymbol: '$',
        theme: 'default',
        user: normalized.user
    };
}

export function getTerminalSessionUsername(session) {
    return getTerminalPromptSnapshot(session).user;
}

export function getTerminalSessionPwd(session) {
    return getTerminalPromptSnapshot(session).path;
}
