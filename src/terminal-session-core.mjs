const TERMINAL_USERS = Object.freeze({
    GODLIKE: 'godlike',
    GUEST: 'guest',
    ROOT: 'root'
});

const DEFAULT_TERMINAL_SESSION = Object.freeze({
    shell: 'default',
    user: TERMINAL_USERS.GUEST
});

const DEFAULT_PROMPT_SNAPSHOT = Object.freeze({
    documentTitle: null,
    host: 'localhost',
    isGodlike: false,
    isRoot: false,
    mode: 'default',
    path: '/home/0x00C0DE/Unkn0wn',
    promptSymbol: '$',
    theme: 'default',
    user: TERMINAL_USERS.GUEST
});

function sanitizeUsername(value, fallback = DEFAULT_TERMINAL_SESSION.user) {
    const trimmed = typeof value === 'string' ? value.trim() : '';
    const normalized = trimmed.toLowerCase();

    if (normalized === TERMINAL_USERS.GUEST || normalized === TERMINAL_USERS.ROOT || normalized === TERMINAL_USERS.GODLIKE) {
        return normalized;
    }

    return fallback;
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
        return TERMINAL_USERS.ROOT;
    }

    if (args.length !== 1) {
        return null;
    }

    const target = sanitizeUsername(args[0], '');
    return target === TERMINAL_USERS.GUEST || target === TERMINAL_USERS.GODLIKE ? target : null;
}

export function applyTerminalSessionCommand(session, command, args = []) {
    const normalized = normalizeTerminalSession(session);
    if (String(command || '').toLowerCase() !== 'su') {
        return normalized;
    }

    const target = resolveSuTarget(args);
    if (!target) {
        return normalized;
    }

    return {
        shell: 'default',
        user: target
    };
}

export function getTerminalPromptSnapshot(session) {
    const normalized = normalizeTerminalSession(session);
    const isRoot = normalized.user === TERMINAL_USERS.ROOT;
    const isGodlike = normalized.user === TERMINAL_USERS.GODLIKE;
    return {
        ...DEFAULT_PROMPT_SNAPSHOT,
        documentTitle: null,
        host: 'localhost',
        isGodlike,
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
