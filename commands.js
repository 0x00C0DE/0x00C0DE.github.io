const fileContents = {
    "readme.txt": [
        "About me",
        "--------",
        "I am Braden, a software developer and Oregon State University Computer Science graduate.",
        "My work centers on Python, systems programming, security-adjacent tooling, and practical project building.",
        " ",
        "About this website",
        "------------------",
        "This website mimics an old unix terminal, following the interaction style of yangeorget.net.",
        "Use cat projects.txt to browse pinned work, or type help for the full command list.",
        "The fortune command pulls live fortune-cookie messages."
    ],
    "projects.txt": [
        "Pinned projects",
        "---------------",
        '<a href="project-proprts.html">PROPR Nearest Neighbor Crypto Trading System</a>  - Python, trading automation, neural-network workflows',
        '<a href="project-qr-totp.html">Secure QR-TOTP Authenticator</a>              - Python, QR provisioning, TOTP validation',
        '<a href="project-collision-avoidance.html">Autonomous Mobile Robot Collision Avoidance</a> - Python, robotics, vision',
        '<a href="project-shellcode-template.html">Shellcode Development Template</a>          - C, security, low-level experimentation',
        '<a href="project-smallsh.html">Unix Small Shell Implementation</a>            - C, Unix process management',
        '<a href="project-bloom-filters.html">Bloom Filter Password Screening</a>          - Python, algorithms, membership testing'
    ],
    "links.txt": [
        "External links",
        "--------------",
        'GitHub    : <a href="https://github.com/0x00C0DE" target="_blank">https://github.com/0x00C0DE</a>',
        'Instagram : <a href="https://www.instagram.com/smallmediumpizza/" target="_blank">https://www.instagram.com/smallmediumpizza/</a>',
        'YouTube   : <a href="https://www.youtube.com/channel/UCYOKNvGyqvRPnDnvmbE-1Xw" target="_blank">https://www.youtube.com/channel/UCYOKNvGyqvRPnDnvmbE-1Xw</a>'
    ],
    "qr-totp.txt": [
        "Secure QR-TOTP Authenticator",
        "-----------------------------",
        "Python QR provisioning and time-based one-time password validation.",
        'Project page : <a href="project-qr-totp.html">project-qr-totp.html</a>',
        'Repository   : <a href="https://github.com/0x00C0DE/cs370-proj4-qr-totp" target="_blank">github.com/0x00C0DE/cs370-proj4-qr-totp</a>'
    ],
    "proprts.txt": [
        "PROPR Nearest Neighbor Crypto Trading System",
        "--------------------------------------------",
        "Neural-network-powered crypto trading system focused on automation, execution workflows, and modular Python architecture.",
        'Project page : <a href="project-proprts.html">project-proprts.html</a>',
        'Repository   : <a href="https://github.com/0x00C0DE/PROPR-nn-crypto-trading-system" target="_blank">github.com/0x00C0DE/PROPR-nn-crypto-trading-system</a>'
    ],
    "amr.txt": [
        "Autonomous Mobile Robot Collision Avoidance",
        "-------------------------------------------",
        "Vision and obstacle-detection tooling for safer robot navigation.",
        'Project page : <a href="project-collision-avoidance.html">project-collision-avoidance.html</a>',
        'Repository   : <a href="https://github.com/jwright303/Collision-Avoidance-For-Autonomous-Mobile-Robots" target="_blank">github.com/jwright303/Collision-Avoidance-For-Autonomous-Mobile-Robots</a>'
    ],
    "shellcode.txt": [
        "Shellcode Development Template",
        "------------------------------",
        "Security-oriented starter framework for shellcode experimentation and low-level testing.",
        'Project page : <a href="project-shellcode-template.html">project-shellcode-template.html</a>',
        'Repository   : <a href="https://github.com/0x00C0DE/shellcode-template" target="_blank">github.com/0x00C0DE/shellcode-template</a>'
    ],
    "smallsh.txt": [
        "Unix Small Shell Implementation",
        "-------------------------------",
        "Compact Unix shell demonstrating process control and systems programming fundamentals.",
        'Project page : <a href="project-smallsh.html">project-smallsh.html</a>',
        'Repository   : <a href="https://github.com/0x00C0DE/CS344-assign3" target="_blank">github.com/0x00C0DE/CS344-assign3</a>'
    ],
    "bloom.txt": [
        "Bloom Filter Password Screening",
        "-------------------------------",
        "Probabilistic membership testing for password workflows using Bloom filters.",
        'Project page : <a href="project-bloom-filters.html">project-bloom-filters.html</a>',
        'Repository   : <a href="https://github.com/0x00C0DE/cs370_bloom_filters" target="_blank">github.com/0x00C0DE/cs370_bloom_filters</a>'
    ]
};

const ASTROLOGY_FORTUNE_URL = 'https://www.astrology.com/compatibility/fortune-cookie.html';
const ASTROLOGY_FORTUNE_SOURCES = [
    {
        url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(ASTROLOGY_FORTUNE_URL)}`,
        parseResponse: async response => response.text()
    },
    {
        url: `https://api.allorigins.win/get?url=${encodeURIComponent(ASTROLOGY_FORTUNE_URL)}`,
        parseResponse: async response => {
            const payload = await response.json();
            return payload.contents || '';
        }
    },
    {
        url: `https://api.allorigins.win/raw?url=${encodeURIComponent(ASTROLOGY_FORTUNE_URL)}`,
        parseResponse: async response => response.text()
    }
];
const BLOG_POST_API_URL = window.BLOG_POST_API_URL || 'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/blog/append';
const TURNSTILE_SITE_KEY = window.TURNSTILE_SITE_KEY || '0x4AAAAAAC85Zivt0Tn6Fqp9';
const TURNSTILE_API_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const BLOG_STAGE_IMAGE_API_URL = window.BLOG_STAGE_IMAGE_API_URL || 'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/blog/upload-chunk';
const BLOG_DELETE_IMAGE_API_URL = window.BLOG_DELETE_IMAGE_API_URL || 'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/blog/delete-image';
const BLOG_DELETE_TEXT_API_URL = window.BLOG_DELETE_TEXT_API_URL || 'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/blog/delete-text';
const BLOG_DELETE_ENTRY_API_URL = window.BLOG_DELETE_ENTRY_API_URL || 'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/blog/delete-entry';
const TERMINAL_SU_API_URL = window.TERMINAL_SU_API_URL || 'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/terminal/su';
const VISITOR_COUNT_API_URL = window.VISITOR_COUNT_API_URL || 'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors';
const VISITOR_TRACK_API_URL = window.VISITOR_TRACK_API_URL || 'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/track';
const VISITOR_LEAVE_API_URL = window.VISITOR_LEAVE_API_URL || 'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/leave';
const BLOG_MAX_POST_LENGTH = 500;
const BLOG_MAX_IMAGE_DATA_URL_LENGTH = 100000000;
const BLOG_DIRECT_POST_IMAGE_DATA_URL_LENGTH = 4000000;
const BLOG_STAGED_IMAGE_CHUNK_LENGTH = 98304;
const BLOG_MAX_STAGED_IMAGE_CHUNKS = 2048;
const BLOG_MAX_IMAGE_ATTACHMENTS = 10;
const BLOG_SUPPORTED_POST_MEDIA_TYPES_LABEL = 'png/jpg/jpeg/webp/gif/mp4';
const BLOG_ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
const BLOG_ALLOWED_POST_MEDIA_MIME_TYPES = new Set([...BLOG_ALLOWED_IMAGE_MIME_TYPES, 'video/mp4']);
const BLOG_ALLOWED_HOSTED_MEDIA_MIME_TYPES = new Set(['image/gif', 'video/mp4']);
const USERPIC_SUPPORTED_IMAGE_TYPES_LABEL = 'png, jpg, jpeg, webp, or gif';
const USERPIC_MAX_FILE_BYTES = 8 * 1024 * 1024;
const USERPIC_MAX_SOURCE_WIDTH = 4096;
const USERPIC_MAX_SOURCE_HEIGHT = 4096;
const BLOG_IMAGE_FILE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp';
const BLOG_POST_FILE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,video/mp4';
const FILE_PICKER_ACCEPT_EXTENSIONS = Object.freeze({
    'image/png': Object.freeze(['.png']),
    'image/jpeg': Object.freeze(['.jpg', '.jpeg']),
    'image/gif': Object.freeze(['.gif']),
    'image/webp': Object.freeze(['.webp']),
    'video/mp4': Object.freeze(['.mp4'])
});
const BLOG_IMAGE_DATA_URL_PATTERN = /^data:([^;]+);base64,([A-Za-z0-9+/=\r\n]+)$/i;
const BLOG_Z85_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#';
const BLOG_Z85_CHAR_TO_VALUE = (() => {
    const mapping = Object.create(null);
    for (let index = 0; index < BLOG_Z85_ALPHABET.length; index += 1) {
        mapping[BLOG_Z85_ALPHABET[index]] = index;
    }
    return mapping;
})();
const VISITOR_HEARTBEAT_MS = 1000;
const VISITOR_STATS_POLL_MS = 500;
const TURNSTILE_API_LOAD_TIMEOUT_MS = 15000;
const TURNSTILE_TOKEN_TIMEOUT_MS = 30000;
const BLOG_MEDIA_SIGNATURE_PREFIX_BYTES = 16;
const TEXT_FILES = Object.freeze([
    'blog.txt',
    'readme.txt',
    'projects.txt',
    'links.txt',
    'qr-totp.txt',
    'proprts.txt',
    'amr.txt',
    'shellcode.txt',
    'smallsh.txt',
    'bloom.txt'
]);

const TEXT_FILE_LOOKUP = new Map(TEXT_FILES.map(filename => [filename.toUpperCase(), filename]));
const visitorCounterState = {
    visitorId: null,
    visitId: null,
    stats: null,
    initialized: false,
    heartbeatId: null,
    statsPollId: null,
    pendingStats: null,
    leaveSent: false
};
const QR_TOTP_MEMORY_KEY = '__qrTotpEnrollmentV1';
const QR_TOTP_BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const QR_TOTP_SECRET_BYTES = 20;
const QR_TOTP_STEP_SECONDS = 30;
const QR_TOTP_CODE_DIGITS = 6;
const DEFAULT_DOCUMENT_TITLE = document.title;
const FALLBACK_TERMINAL_SESSION = Object.freeze({
    shell: 'default',
    user: 'guest'
});

let terminalSessionReadyPromise = null;
let terminalSessionModule = null;
let terminalSessionState = { ...FALLBACK_TERMINAL_SESSION };
const terminalSessionSecrets = {
    godlikePassword: ''
};

function getFallbackPromptSnapshot() {
    const username = typeof terminalSessionState.user === 'string' && terminalSessionState.user.trim()
        ? terminalSessionState.user.trim().toLowerCase()
        : 'guest';
    return {
        documentTitle: null,
        host: 'localhost',
        isGodlike: username === 'godlike',
        isRoot: username.toLowerCase() === 'root',
        mode: 'default',
        path: '/home/0x00C0DE/Unkn0wn',
        promptSymbol: '$',
        theme: 'default',
        user: username
    };
}

function normalizeFallbackTerminalSession(session) {
    const safeSession = session && typeof session === 'object' ? session : FALLBACK_TERMINAL_SESSION;
    const normalizedUser = typeof safeSession.user === 'string' && safeSession.user.trim()
        ? safeSession.user.trim().toLowerCase()
        : 'guest';
    return {
        shell: 'default',
        user: normalizedUser === 'guest' || normalizedUser === 'root' || normalizedUser === 'godlike'
            ? normalizedUser
            : 'guest'
    };
}

function getTerminalSessionModuleApi() {
    return terminalSessionModule;
}

function normalizeTerminalSessionState(session) {
    const moduleApi = getTerminalSessionModuleApi();
    if (moduleApi && typeof moduleApi.normalizeTerminalSession === 'function') {
        return moduleApi.normalizeTerminalSession(session);
    }

    return normalizeFallbackTerminalSession(session);
}

function getTerminalPromptSnapshot() {
    const moduleApi = getTerminalSessionModuleApi();
    if (moduleApi && typeof moduleApi.getTerminalPromptSnapshot === 'function') {
        return moduleApi.getTerminalPromptSnapshot(terminalSessionState);
    }

    return getFallbackPromptSnapshot();
}

function getTerminalSessionUsername() {
    const moduleApi = getTerminalSessionModuleApi();
    if (moduleApi && typeof moduleApi.getTerminalSessionUsername === 'function') {
        return moduleApi.getTerminalSessionUsername(terminalSessionState);
    }

    return getTerminalPromptSnapshot().user;
}

function getTerminalSessionPwd() {
    const moduleApi = getTerminalSessionModuleApi();
    if (moduleApi && typeof moduleApi.getTerminalSessionPwd === 'function') {
        return moduleApi.getTerminalSessionPwd(terminalSessionState);
    }

    return getTerminalPromptSnapshot().path;
}

function isCurrentUserGodlike() {
    return getTerminalSessionUsername().toLowerCase() === 'godlike';
}

function setGodlikePassword(password) {
    terminalSessionSecrets.godlikePassword = typeof password === 'string' ? password : '';
}

function clearGodlikePassword() {
    terminalSessionSecrets.godlikePassword = '';
}

function getGodlikePassword() {
    return typeof terminalSessionSecrets.godlikePassword === 'string'
        ? terminalSessionSecrets.godlikePassword
        : '';
}

function canCurrentUserManageBlogEntries() {
    return isCurrentUserGodlike() && Boolean(getGodlikePassword());
}

function syncTerminalDocumentTitle() {
    const snapshot = getTerminalPromptSnapshot();
    document.title = snapshot.documentTitle || DEFAULT_DOCUMENT_TITLE;
}

function syncTerminalThemeClasses() {
    const snapshot = getTerminalPromptSnapshot();
    const isKali = snapshot.mode === 'kali';
    const isRoot = Boolean(snapshot.isRoot);
    const isGodlike = Boolean(snapshot.isGodlike);
    const isElevated = isRoot || isGodlike;
    const body = document.body;
    const terminal = document.getElementById('terminal');

    if (body) {
        body.classList.toggle('terminal-theme-kali', isKali);
        body.classList.toggle('terminal-theme-kali-root', isKali && isElevated);
        body.classList.toggle('terminal-theme-root', isRoot);
        body.classList.toggle('terminal-theme-godlike', isGodlike);
    }

    if (terminal) {
        terminal.classList.toggle('terminal-theme-kali', isKali);
        terminal.classList.toggle('terminal-theme-kali-root', isKali && isElevated);
        terminal.classList.toggle('terminal-theme-root', isRoot);
        terminal.classList.toggle('terminal-theme-godlike', isGodlike);
    }
}

function refreshTerminalSessionUi() {
    syncTerminalDocumentTitle();
    syncTerminalThemeClasses();
    if (typeof window.syncTerminalVisualEffects === 'function') {
        window.syncTerminalVisualEffects();
    }
    if (typeof window.refreshTerminalInputPrompt === 'function') {
        window.refreshTerminalInputPrompt();
    }
    if (typeof window.syncTerminalSessionAwareLines === 'function') {
        window.syncTerminalSessionAwareLines();
    }
}

function setTerminalSessionState(nextState) {
    terminalSessionState = normalizeTerminalSessionState(nextState);
    if (String(terminalSessionState.user || '').toLowerCase() !== 'godlike') {
        clearGodlikePassword();
    }
    refreshTerminalSessionUi();
    return terminalSessionState;
}

function applyTerminalSessionCommand(command, args = []) {
    const moduleApi = getTerminalSessionModuleApi();
    if (moduleApi && typeof moduleApi.applyTerminalSessionCommand === 'function') {
        return moduleApi.applyTerminalSessionCommand(terminalSessionState, command, args);
    }

    if (String(command || '').toLowerCase() !== 'su') {
        return normalizeTerminalSessionState(terminalSessionState);
    }

    if (!Array.isArray(args) || args.length === 0) {
        return {
            shell: 'default',
            user: 'root'
        };
    }

    if (args.length !== 1) {
        return normalizeTerminalSessionState(terminalSessionState);
    }

    const target = String(args[0] || '').trim().toLowerCase();
    if (target !== 'guest' && target !== 'godlike') {
        return normalizeTerminalSessionState(terminalSessionState);
    }

    return {
        shell: 'default',
        user: target
    };
}

function resolveSupportedSuTarget(args = []) {
    if (!Array.isArray(args) || args.length === 0) {
        return 'root';
    }

    if (args.length !== 1) {
        return null;
    }

    const target = String(args[0] || '').trim().toLowerCase();
    return target === 'guest' || target === 'godlike' ? target : null;
}

function ensureTerminalSessionReady() {
    if (terminalSessionReadyPromise) {
        return terminalSessionReadyPromise;
    }

    terminalSessionReadyPromise = import('./terminal-session-core.mjs')
        .then(module => {
            terminalSessionModule = module;
            terminalSessionState = normalizeTerminalSessionState(terminalSessionState);
            refreshTerminalSessionUi();
            return module;
        })
        .catch(error => {
            console.error('terminal session failed to load', error);
            refreshTerminalSessionUi();
            return null;
        });

    return terminalSessionReadyPromise;
}

function normalizeTextFilename(input) {
    const trimmed = input.trim();
    if (!trimmed) {
        return null;
    }
    const candidate = trimmed.toUpperCase().endsWith('.TXT') ? trimmed : `${trimmed}.txt`;
    return TEXT_FILE_LOOKUP.get(candidate.toUpperCase()) || null;
}

function appendAnchor(container, href, text, options = {}) {
    const safeHref = getSafeTerminalHref(href);
    const anchor = document.createElement('a');
    anchor.href = safeHref;
    anchor.textContent = text;
    if (options.newTab) {
        anchor.target = '_blank';
        anchor.rel = 'noreferrer';
    }
    container.append(anchor);
}

function getSafeTerminalHref(href) {
    try {
        const parsed = new URL(href, window.location.href);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.toString();
        }
    } catch {
        // Fall back to a harmless URL.
    }

    return '#';
}

let blogUploadCoreReadyPromise = null;
let turnstileApiReadyPromise = null;
const BLOG_UPLOAD_CORE_MODULE_URL = './blog-upload-core.mjs?v=20260408b';

function ensureBlogUploadCoreReady() {
    if (blogUploadCoreReadyPromise) {
        return blogUploadCoreReadyPromise;
    }

    blogUploadCoreReadyPromise = import(BLOG_UPLOAD_CORE_MODULE_URL)
        .catch(error => {
            console.error('blog upload core failed to load', error);
            return null;
        });

    return blogUploadCoreReadyPromise;
}

function ensureTurnstileReady() {
    if (!TURNSTILE_SITE_KEY) {
        return Promise.resolve(null);
    }

    if (window.turnstile && typeof window.turnstile.render === 'function') {
        return Promise.resolve(window.turnstile);
    }

    if (turnstileApiReadyPromise) {
        return turnstileApiReadyPromise;
    }

    turnstileApiReadyPromise = new Promise((resolve, reject) => {
        let settled = false;
        let timeoutId = 0;

        const finish = (error, api) => {
            if (settled) {
                return;
            }
            settled = true;
            if (timeoutId) {
                window.clearTimeout(timeoutId);
            }
            if (error) {
                turnstileApiReadyPromise = null;
                reject(error);
                return;
            }
            resolve(api);
        };

        const handleReady = () => {
            if (window.turnstile && typeof window.turnstile.render === 'function') {
                finish(null, window.turnstile);
                return;
            }
            finish(new Error('turnstile unavailable right now'));
        };

        const handleError = () => {
            finish(new Error('unable to load turnstile right now'));
        };

        timeoutId = window.setTimeout(() => {
            finish(new Error('turnstile load timed out'));
        }, TURNSTILE_API_LOAD_TIMEOUT_MS);

        const existingScript = Array.from(document.scripts || []).find(script =>
            typeof script?.src === 'string' &&
            script.src.startsWith('https://challenges.cloudflare.com/turnstile/v0/api.js')
        );

        if (existingScript) {
            existingScript.addEventListener('load', handleReady, { once: true });
            existingScript.addEventListener('error', handleError, { once: true });
            if (window.turnstile && typeof window.turnstile.render === 'function') {
                handleReady();
            }
            return;
        }

        const script = document.createElement('script');
        script.src = TURNSTILE_API_URL;
        script.async = true;
        script.defer = true;
        script.dataset.turnstileApi = 'true';
        script.addEventListener('load', handleReady, { once: true });
        script.addEventListener('error', handleError, { once: true });
        (document.head || document.documentElement).append(script);
    });

    return turnstileApiReadyPromise;
}

function createTurnstileContainer() {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.right = '16px';
    container.style.bottom = '16px';
    container.style.zIndex = '2147483647';
    container.style.minWidth = '300px';
    container.style.minHeight = '65px';
    container.style.pointerEvents = 'auto';
    container.style.background = 'transparent';
    (document.body || document.documentElement).append(container);
    return container;
}

async function requestTurnstileToken() {
    if (!TURNSTILE_SITE_KEY) {
        return '';
    }

    const turnstileApi = await ensureTurnstileReady();
    if (!turnstileApi || typeof turnstileApi.render !== 'function' || typeof turnstileApi.execute !== 'function') {
        throw new Error('turnstile unavailable right now');
    }

    return new Promise((resolve, reject) => {
        let settled = false;
        let widgetId = null;
        const container = createTurnstileContainer();
        const timeoutId = window.setTimeout(() => {
            finish(new Error('turnstile challenge timed out, try again'));
        }, TURNSTILE_TOKEN_TIMEOUT_MS);

        const cleanup = () => {
            window.clearTimeout(timeoutId);
            try {
                if (widgetId !== null && typeof turnstileApi.remove === 'function') {
                    turnstileApi.remove(widgetId);
                } else if (widgetId !== null && typeof turnstileApi.reset === 'function') {
                    turnstileApi.reset(widgetId);
                }
            } catch (error) {
                console.error('turnstile cleanup failed', error);
            }
            if (container.isConnected) {
                container.remove();
            }
        };

        const finish = (error, token) => {
            if (settled) {
                return;
            }
            settled = true;
            cleanup();
            if (error) {
                reject(error);
                return;
            }
            resolve(token);
        };

        try {
            widgetId = turnstileApi.render(container, {
                sitekey: TURNSTILE_SITE_KEY,
                appearance: 'interaction-only',
                execution: 'execute',
                callback: token => {
                    if (typeof token !== 'string' || !token.trim()) {
                        finish(new Error('turnstile token missing, try again'));
                        return;
                    }
                    finish(null, token);
                },
                'error-callback': () => {
                    finish(new Error('turnstile verification failed, try again'));
                },
                'expired-callback': () => {
                    finish(new Error('turnstile challenge expired, try again'));
                },
                'timeout-callback': () => {
                    finish(new Error('turnstile challenge timed out, try again'));
                }
            });
            turnstileApi.execute(widgetId);
        } catch (error) {
            finish(error instanceof Error ? error : new Error('turnstile unavailable right now'));
        }
    });
}

function buildTerminalLinkElement(fragment) {
    const anchor = document.createElement('a');
    anchor.href = getSafeTerminalHref(fragment.href || '#');
    anchor.textContent = fragment.text || '';
    if (fragment.newTab) {
        anchor.target = '_blank';
        anchor.rel = 'noreferrer';
    }
    return anchor;
}

function renderTerminalLineContentFallback(container, text) {
    const pattern = /\bhttps?:\/\/[^\s<]+|\bproject-[a-z0-9-]+\.html\b|\bprojects\.html\b|\bresume\.pdf\b|\b[A-Za-z0-9-]+\.txt\b/gi;
    let lastIndex = 0;
    let match = pattern.exec(text);

    while (match) {
        const matchedText = match[0];
        const start = match.index;
        if (start > lastIndex) {
            container.append(document.createTextNode(text.slice(lastIndex, start)));
        }

        if (/^https?:\/\//i.test(matchedText)) {
            appendAnchor(container, matchedText, matchedText, { newTab: true });
        } else if (/\.txt$/i.test(matchedText)) {
            const normalized = normalizeTextFilename(matchedText);
            if (normalized) {
                appendAnchor(container, `?command=${encodeURIComponent(`cat ${normalized}`)}`, normalized);
            } else {
                container.append(document.createTextNode(matchedText));
            }
        } else {
            const newTab = /\.pdf$/i.test(matchedText);
            appendAnchor(container, matchedText, matchedText, { newTab });
        }

        lastIndex = start + matchedText.length;
        match = pattern.exec(text);
    }

    if (lastIndex < text.length) {
        container.append(document.createTextNode(text.slice(lastIndex)));
    }
}

function renderTerminalLineContent(container, line) {
    const text = typeof line === 'string' ? line : String(line ?? '');
    if (!text) {
        container.append(document.createTextNode('\u00A0'));
        return;
    }

    if (typeof window.renderTerminalTextWithPretext === 'function') {
        const handled = window.renderTerminalTextWithPretext(container, text, {
            normalizeTextFilename,
            buildLinkElement: buildTerminalLinkElement
        });
        if (handled) {
            return;
        }
    }

    renderTerminalLineContentFallback(container, text);
}

function renderTerminalEditorialLineContent(container, line, options = {}) {
    const text = typeof line === 'string' ? line : String(line ?? '');
    if (!text) {
        container.replaceChildren();
        return {
            height: 0,
            lineCount: 0,
            lines: []
        };
    }

    if (typeof window.renderTerminalEditorialTextWithPretext === 'function') {
        const handled = window.renderTerminalEditorialTextWithPretext(container, text, {
            ...options,
            buildLinkElement: buildTerminalLinkElement,
            normalizeTextFilename
        });
        if (handled) {
            return handled;
        }
    }

    renderTerminalLineContent(container, line);
    return {
        height: container.getBoundingClientRect().height || 0,
        lineCount: 0,
        lines: []
    };
}

async function readTextFile(filename) {
    const response = await fetch(filename, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`request failed with status ${response.status}`);
    }

    const text = await response.text();
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '') {
        lines.pop();
    }

    if (filename === 'blog.txt') {
        return parseBlogTextFile(lines);
    }

    return lines;
}

function parseBlogTextFile(lines) {
    const output = [];
    let imageBlockIndex = 0;
    let currentEntry = null;
    let currentEntryImageIndex = 0;
    let previousTextLine = '';
    const flushCurrentEntry = () => {
        if (currentEntry) {
            finalizeParsedBlogEntry(currentEntry);
            output.push(currentEntry);
            currentEntry = null;
        }
    };
    const ensureCurrentEntryTextBlock = () => {
        if (!currentEntry) {
            return null;
        }

        const lastBlock = currentEntry.blocks[currentEntry.blocks.length - 1];
        if (lastBlock && lastBlock.type === 'blog-entry-text-block') {
            return lastBlock;
        }

        const textBlock = {
            type: 'blog-entry-text-block',
            lines: []
        };
        currentEntry.blocks.push(textBlock);
        return textBlock;
    };
    const pushBlogEntryTextLine = line => {
        if (!currentEntry) {
            output.push(line);
            return;
        }

        ensureCurrentEntryTextBlock().lines.push(line);
    };

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (line !== '[image-base64]' && line !== '[image-z85]' && line !== '[image-url]') {
            if (isBlogEntryTimestampLine(line)) {
                flushCurrentEntry();
                currentEntry = {
                    type: 'blog-entry',
                    blocks: [],
                    deletable: true,
                    entryTimestamp: line.trim(),
                    text: line
                };
                currentEntryImageIndex = 0;
                previousTextLine = '';
            } else if (line.trim()) {
                previousTextLine = line;
                pushBlogEntryTextLine(line);
            } else {
                pushBlogEntryTextLine(line);
            }
            continue;
        }

        const imageLines = [];
        const isCompactImageBlock = line === '[image-z85]';
        const isHostedImageBlock = line === '[image-url]';
        const closingMarker = isCompactImageBlock
            ? '[/image-z85]'
            : isHostedImageBlock
                ? '[/image-url]'
                : '[/image-base64]';
        index += 1;

        while (index < lines.length && lines[index] !== closingMarker) {
            imageLines.push(lines[index]);
            index += 1;
        }

        const nextTextLine = findNextBlogTextLine(lines, index + 1);
        if (isCompactImageBlock) {
            const compactImage = parseCompactBlogImageBlockLines(imageLines);
            if (compactImage && currentEntry) {
                currentEntry?.blocks.push({
                    type: 'inline-image',
                    src: compactImage.src,
                    alt: 'Embedded blog image',
                    deletable: true,
                    imageBlockIndex,
                    imageKey: createBlogImageKey(`z85:${compactImage.mimeType}:${compactImage.encodedPayload}`),
                    entryTimestamp: currentEntry ? currentEntry.entryTimestamp : '',
                    entryImageIndex: currentEntryImageIndex,
                    previousTextLine,
                    nextTextLine
                });
            } else {
                pushBlogEntryTextLine('[image-z85]');
                imageLines.forEach(imageLine => pushBlogEntryTextLine(imageLine));
                if (index < lines.length && lines[index] === '[/image-z85]') {
                    pushBlogEntryTextLine('[/image-z85]');
                }
            }
        } else if (isHostedImageBlock) {
            const hostedMedia = parseHostedBlogImageBlockLines(imageLines);
            if (hostedMedia && currentEntry) {
                currentEntry?.blocks.push({
                    type: hostedMedia.mediaType === 'video' ? 'inline-video' : 'inline-image',
                    src: hostedMedia.src,
                    alt: hostedMedia.mediaType === 'video' ? 'Embedded blog video' : 'Embedded blog image',
                    mimeType: hostedMedia.mimeType,
                    deletable: true,
                    imageBlockIndex,
                    imageKey: createBlogImageKey(hostedMedia.src),
                    entryTimestamp: currentEntry ? currentEntry.entryTimestamp : '',
                    entryImageIndex: currentEntryImageIndex,
                    previousTextLine,
                    nextTextLine
                });
            } else {
                pushBlogEntryTextLine('[image-url]');
                imageLines.forEach(imageLine => pushBlogEntryTextLine(imageLine));
                if (index < lines.length && lines[index] === '[/image-url]') {
                    pushBlogEntryTextLine('[/image-url]');
                }
            }
        } else {
            const dataUrl = imageLines.join('');
            if (isSafeBlogImageDataUrl(dataUrl) && currentEntry) {
                currentEntry?.blocks.push({
                    type: 'inline-image',
                    src: dataUrl,
                    alt: 'Embedded blog image',
                    deletable: true,
                    imageBlockIndex,
                    imageKey: createBlogImageKey(dataUrl),
                    entryTimestamp: currentEntry ? currentEntry.entryTimestamp : '',
                    entryImageIndex: currentEntryImageIndex,
                    previousTextLine,
                    nextTextLine
                });
            } else {
                pushBlogEntryTextLine('[image-base64]');
                imageLines.forEach(imageLine => pushBlogEntryTextLine(imageLine));
                if (index < lines.length && lines[index] === '[/image-base64]') {
                    pushBlogEntryTextLine('[/image-base64]');
                }
            }
        }

        imageBlockIndex += 1;
        currentEntryImageIndex += 1;
    }

    flushCurrentEntry();
    return output;
}

function findNextBlogTextLine(lines, startIndex) {
    for (let index = startIndex; index < lines.length; index += 1) {
        const line = lines[index];
        if (isBlogEntryTimestampLine(line)) {
            return '';
        }

        if (line === '[image-base64]' || line === '[image-z85]' || line === '[image-url]') {
            const closingMarker = line === '[image-z85]'
                ? '[/image-z85]'
                : line === '[image-url]'
                    ? '[/image-url]'
                    : '[/image-base64]';
            index += 1;
            while (index < lines.length && lines[index] !== closingMarker) {
                index += 1;
            }
            continue;
        }

        if (String(line || '').trim()) {
            return String(line);
        }
    }

    return '';
}

function finalizeParsedBlogEntry(entry) {
    if (!entry || !Array.isArray(entry.blocks)) {
        return;
    }

    const hasMedia = entry.blocks.some(block => block?.type === 'inline-image' || block?.type === 'inline-video');
    let textBlockIndex = 0;

    entry.blocks.forEach((block, blockIndex) => {
        if (block?.type !== 'blog-entry-text-block') {
            return;
        }

        const lines = Array.isArray(block.lines) ? block.lines : [];
        const previousImageKey = findAdjacentBlogMediaKey(entry.blocks, blockIndex, -1);
        const nextImageKey = findAdjacentBlogMediaKey(entry.blocks, blockIndex, 1);
        const hasVisibleText = lines.some(line => String(line || '').trim());

        Object.assign(block, {
            deletable: hasMedia && hasVisibleText,
            entryTextBlockIndex: textBlockIndex,
            entryTimestamp: entry.entryTimestamp || '',
            nextImageKey,
            previousImageKey,
            textKey: createBlogTextBlockKey(lines)
        });
        textBlockIndex += 1;
    });
}

function findAdjacentBlogMediaKey(blocks, startIndex, direction) {
    const step = direction < 0 ? -1 : 1;
    for (let index = startIndex + step; index >= 0 && index < blocks.length; index += step) {
        const block = blocks[index];
        if (block?.type === 'inline-image' || block?.type === 'inline-video') {
            return String(block.imageKey || '').trim();
        }
    }

    return '';
}

function banner_command() {
    setTimeout(() => {
        initVisitorTracking();
        renderVisitorCounter();
    }, 0);
    return [
        ' ',
        {
            type: 'banner',
            title: '0x00C0DE',
            subtitle: 'Fléctere si néqueo súperos, Acheronta movebo'
        },
        {
            type: 'visitor-widget'
        },
        'Type "help" for a list of commands.',
        ' '
    ];
}

function formatHelpEntry(command, description, width) {
    return {
        type: 'help-entry',
        command,
        description,
        commandWidth: width
    };
}

function buildPretextLabHref(text) {
    const trimmed = typeof text === 'string' ? text.trim() : '';
    if (!trimmed) {
        return 'pretext-lab.html';
    }

    return `pretext-lab.html?${new URLSearchParams({ text: trimmed }).toString()}`;
}

function help_command() {
    const entries = [
        ['cat', 'Display file contents'],
        ['clear', 'Clear the terminal screen'],
        ['date', 'Display current date and time'],
        ['echo', 'Display text'],
        ['fortune', 'Display a live fortune'],
        ['github', 'Open GitHub in a new tab'],
        ['help', 'Show this help message'],
        ['history', 'Show command history'],
        ['linkedin', 'Open LinkedIn in a new tab'],
        ['ls', 'List directory contents'],
        ['video [w h]', 'Display your live camera footage as ASCII art at size w x h'],
        ['mypic [w h]', 'Display 0x00C0DE\'s picture as ASCII art at size w x h'],
        ['pretext [lab] [text]', 'Show terminal Pretext status or open the layout lab'],
        ['post [text] ... [image] ...', `Append a blog entry; omit [image] for text-only posts or use one selected media file per placeholder (${BLOG_SUPPORTED_POST_MEDIA_TYPES_LABEL}, up to ${BLOG_MAX_IMAGE_ATTACHMENTS}). Example: post first [image] second [image] third`],
        ['pwd', 'Print working directory'],
        ['qr-totp', 'Browser QR enrollment + TOTP generator for the cs370 project'],
        ['resume', 'Open my resume PDF in a new tab'],
        ['su [guest|godlike]', 'Switch to root with `su`, back to guest with `su guest`, or authenticate godlike with `su godlike`'],
        ['userpic [w h]', 'Upload or take your own picture and display it as ASCII art'],
        ['visitors', 'Display the live visitor stats widget'],
        ['whoami', 'Print current username'],
        ['instagram', 'Open Instagram in a new tab'],
        ['projects', 'Open the projects terminal page'],
        ['youtube', 'Open YouTube in a new tab']
    ];
    const width = Math.max(...entries.map(([command]) => command.length));
    return ['Available commands:', ...entries.map(([command, description]) => formatHelpEntry(command, description, width))];
}

async function cat_command(args) {
    if (!args[0]) {
        return ['cat: Missing file operand'];
    }

    const filename = normalizeTextFilename(args[0]);
    if (!filename) {
        return [`cat: ${args[0]}: No such file or directory`];
    }

    try {
        return await readTextFile(filename);
    } catch (error) {
        console.error('cat failed', error);
        return [`cat: ${filename}: unable to read file`];
    }
}

function normalizeImgurImage(url) {
    let parsedUrl;
    try {
        parsedUrl = new URL(url);
    } catch {
        return url;
    }

    const hostname = parsedUrl.hostname.toLowerCase();
    if (hostname === 'i.imgur.com') {
        return parsedUrl.toString();
    }

    if (hostname !== 'imgur.com' && hostname !== 'www.imgur.com') {
        return url;
    }

    const imageId = parsedUrl.pathname.split('/').filter(Boolean)[0];
    if (!/^[a-z0-9]+$/i.test(imageId || '')) {
        return url;
    }

    return `https://i.imgur.com/${imageId}.jpg`;
}

function getAsciiCanvasContext(width, height) {
    const canvas = document.getElementById('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas.getContext('2d', { willReadFrequently: true });
}

const ASCII_CHARACTER_WIDTH_RATIO = 0.5;

function getAsciiSourceDimensions(imageSource) {
    const sourceWidth = imageSource.naturalWidth || imageSource.videoWidth || imageSource.width;
    const sourceHeight = imageSource.naturalHeight || imageSource.videoHeight || imageSource.height;
    if (!sourceWidth || !sourceHeight) {
        throw new Error('invalid image dimensions');
    }
    return { sourceWidth, sourceHeight };
}

function resolveAsciiDimensions(imageSource, requestedWidth, requestedHeight) {
    const width = Number.isFinite(requestedWidth) && requestedWidth > 0 ? Math.round(requestedWidth) : 160;
    if (Number.isFinite(requestedHeight) && requestedHeight > 0) {
        return { width, height: Math.round(requestedHeight) };
    }

    const { sourceWidth, sourceHeight } = getAsciiSourceDimensions(imageSource);
    const derivedHeight = Math.round((sourceHeight / sourceWidth) * width * ASCII_CHARACTER_WIDTH_RATIO);
    return {
        width,
        height: Math.max(1, derivedHeight)
    };
}

async function renderImageToAscii(imageSource, width, height, options = {}) {
    const dimensions = resolveAsciiDimensions(imageSource, width, height);
    const context = getAsciiCanvasContext(dimensions.width, dimensions.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(imageSource, 0, 0, dimensions.width, dimensions.height);
    return processImage(context, dimensions.width, dimensions.height);
}

function resolveUserImagePickerAccept(options = {}) {
    return typeof options.accept === 'string' && options.accept.trim()
        ? options.accept.trim()
        : BLOG_IMAGE_FILE_ACCEPT;
}

function buildNativeFilePickerTypes(acceptValue) {
    const accept = Object.create(null);
    String(acceptValue || '')
        .split(',')
        .map(token => token.trim().toLowerCase())
        .filter(Boolean)
        .forEach(token => {
            const extensions = FILE_PICKER_ACCEPT_EXTENSIONS[token];
            if (!extensions) {
                return;
            }

            accept[token] = [...extensions];
        });

    if (Object.keys(accept).length === 0) {
        return [];
    }

    return [{
        accept,
        description: 'Media files'
    }];
}

async function selectUserImageFilesWithOpenPicker(options = {}) {
    if (typeof window.showOpenFilePicker !== 'function') {
        return null;
    }

    const exactCount = Number.isInteger(options.exactCount) && options.exactCount > 0
        ? options.exactCount
        : null;
    const allowMultiple = Boolean(options.multiple || (exactCount && exactCount > 1));
    const pickerOptions = {
        excludeAcceptAllOption: false,
        multiple: allowMultiple
    };
    const types = buildNativeFilePickerTypes(resolveUserImagePickerAccept(options));
    if (types.length > 0) {
        pickerOptions.excludeAcceptAllOption = true;
        pickerOptions.types = types;
    }

    try {
        const handles = await window.showOpenFilePicker(pickerOptions);
        const files = await Promise.all(
            (Array.isArray(handles) ? handles : [])
                .filter(Boolean)
                .map(handle => typeof handle.getFile === 'function' ? handle.getFile() : null)
        );
        return files.filter(Boolean);
    } catch (error) {
        if (error?.name === 'AbortError') {
            return [];
        }

        if (error?.name === 'SecurityError' || error?.name === 'NotAllowedError') {
            return null;
        }

        throw error;
    }
}

async function selectUserImageFiles(options = {}) {
    const exactCount = Number.isInteger(options.exactCount) && options.exactCount > 0
        ? options.exactCount
        : null;
    const allowMultiple = Boolean(options.multiple || (exactCount && exactCount > 1));
    const pickerFiles = await selectUserImageFilesWithOpenPicker({
        ...options,
        exactCount,
        multiple: allowMultiple
    });
    if (pickerFiles !== null) {
        return pickerFiles;
    }

    const input = createTransientUserImageInput({
        accept: resolveUserImagePickerAccept(options),
        multiple: allowMultiple
    });

    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }

    return new Promise(resolve => {
        let settled = false;
        const supportsInputCancelEvent = 'oncancel' in input;

        const finish = files => {
            if (settled) {
                return;
            }
            settled = true;
            input.removeEventListener('change', handleChange);
            input.removeEventListener('cancel', handleCancel);
            removeTransientUserImageInput(input);
            resolve(Array.isArray(files) ? files.filter(Boolean) : []);
        };

        const resolveSelectedFiles = () => {
            finish(input.files ? Array.from(input.files).filter(Boolean) : []);
        };

        const handleChange = () => {
            resolveSelectedFiles();
        };

        const handleCancel = () => {
            finish([]);
        };

        input.addEventListener('change', handleChange);
        if (supportsInputCancelEvent) {
            input.addEventListener('cancel', handleCancel);
        }
        triggerUserImageInputPicker(input);
    });
}

function triggerUserImageInputPicker(input) {
    if (!input) {
        return;
    }

    if (typeof input.click === 'function') {
        try {
            input.click();
            return;
        } catch {
            // Fall back to showPicker() for browsers that block click() on hidden inputs.
        }
    }

    if (typeof input.showPicker === 'function') {
        try {
            input.showPicker();
        } catch {
            // No further fallback available.
        }
    }
}

function createTransientUserImageInput(options = {}) {
    const input = document.createElement('input');
    input.type = 'file';
    input.hidden = true;
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');
    input.style.position = 'fixed';
    input.style.left = '-10000px';
    input.style.top = '0';
    input.style.width = '1px';
    input.style.height = '1px';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    input.removeAttribute('capture');
    input.setAttribute(
        'accept',
        typeof options.accept === 'string' && options.accept.trim()
            ? options.accept.trim()
            : BLOG_IMAGE_FILE_ACCEPT
    );
    input.multiple = Boolean(options.multiple);
    (document.body || document.documentElement).append(input);
    return input;
}

function removeTransientUserImageInput(input) {
    if (!input || !input.isConnected) {
        return;
    }

    input.remove();
}

async function selectUserImageFilesSequentially(requiredCount = 1, options = {}) {
    const normalizedCount = Number.isInteger(requiredCount) && requiredCount > 0
        ? requiredCount
        : 1;
    const acceptValue = typeof options.accept === 'string' && options.accept.trim()
        ? options.accept.trim()
        : BLOG_IMAGE_FILE_ACCEPT;

    if (normalizedCount <= 1) {
        return selectUserImageFiles({
            ...options,
            accept: acceptValue,
            exactCount: 1,
            multiple: false
        });
    }

    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }

    return new Promise(resolve => {
        let settled = false;
        let fallbackTimerId = 0;
        const selectedFiles = [];
        const input = createTransientUserImageInput({
            accept: acceptValue,
            multiple: false
        });
        const supportsInputCancelEvent = 'oncancel' in input;
        let pickerWasBlurred = false;
        let pickerWasHidden = false;

        const clearFallbackTimer = () => {
            if (!fallbackTimerId) {
                return;
            }

            window.clearTimeout(fallbackTimerId);
            fallbackTimerId = 0;
        };

        const cleanupInput = () => {
            clearFallbackTimer();
            input.removeEventListener('change', handleChange);
            input.removeEventListener('cancel', handleCancel);
            if (!supportsInputCancelEvent) {
                window.removeEventListener('blur', handleBlur);
                window.removeEventListener('focus', handleFocus);
                document.removeEventListener('visibilitychange', handleVisibilityChange);
            }
            input.remove();
        };

        const finish = files => {
            if (settled) {
                return;
            }

            settled = true;
            cleanupInput();
            resolve(Array.isArray(files) ? files.filter(Boolean) : []);
        };

        const finalizeAfterReturn = () => {
            clearFallbackTimer();
            fallbackTimerId = window.setTimeout(() => {
                if (settled) {
                    return;
                }

                const files = input.files ? Array.from(input.files).filter(Boolean) : [];
                if (files.length === 0) {
                    finish(selectedFiles);
                }
            }, 250);
        };

        const openNextPicker = () => {
            if (settled) {
                return;
            }

            clearFallbackTimer();
            pickerWasBlurred = false;
            pickerWasHidden = false;
            input.value = '';
            triggerUserImageInputPicker(input);
        };

        const handleChange = () => {
            if (settled) {
                return;
            }

            const files = input.files ? Array.from(input.files).filter(Boolean) : [];
            if (files.length === 0) {
                finish(selectedFiles);
                return;
            }

            selectedFiles.push(files[0]);
            if (selectedFiles.length >= normalizedCount) {
                finish(selectedFiles);
                return;
            }

            openNextPicker();
        };

        const handleCancel = () => {
            if (settled) {
                return;
            }

            finish(selectedFiles);
        };

        const handleBlur = () => {
            pickerWasBlurred = true;
        };

        const handleFocus = () => {
            if (!pickerWasBlurred && !pickerWasHidden) {
                return;
            }
            finalizeAfterReturn();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                pickerWasHidden = true;
                return;
            }

            if (document.visibilityState === 'visible') {
                if (!pickerWasBlurred && !pickerWasHidden) {
                    return;
                }
                finalizeAfterReturn();
            }
        };

        input.addEventListener('change', handleChange);
        input.addEventListener('cancel', handleCancel);
        if (!supportsInputCancelEvent) {
            window.addEventListener('blur', handleBlur);
            window.addEventListener('focus', handleFocus);
            document.addEventListener('visibilitychange', handleVisibilityChange);
        }

        openNextPicker();
    });
}

async function selectUserImageFile(options = {}) {
    const files = await selectUserImageFiles({
        ...options,
        exactCount: 1,
        multiple: false
    });
    return files[0] || null;
}

async function decodeSelectedImage(source) {
    const dataUrl = typeof source === 'string' ? source : await readFileAsDataUrl(source);
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    return image;
}

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('unable to read selected file'));
        reader.readAsDataURL(file);
    });
}

function readFileAsArrayBuffer(file) {
    if (file && typeof file.arrayBuffer === 'function') {
        return file.arrayBuffer();
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('unable to read selected file'));
        reader.readAsArrayBuffer(file);
    });
}

function readFileSignatureBytes(file, byteLength = BLOG_MEDIA_SIGNATURE_PREFIX_BYTES) {
    const normalizedByteLength = Number.isFinite(byteLength) && byteLength > 0
        ? Math.floor(byteLength)
        : BLOG_MEDIA_SIGNATURE_PREFIX_BYTES;
    if (!file || typeof file.slice !== 'function') {
        return readFileAsArrayBuffer(file)
            .then(arrayBuffer => new Uint8Array(arrayBuffer).slice(0, normalizedByteLength));
    }

    return readFileAsArrayBuffer(file.slice(0, normalizedByteLength))
        .then(arrayBuffer => new Uint8Array(arrayBuffer));
}

function encodeBytesToBase64(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
        return '';
    }

    const chunkSize = 0x8000;
    let binary = '';
    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
}

function createDataUrlFromBytes(bytes, mimeType) {
    const normalizedMimeType = normalizeSupportedMediaMimeType(mimeType);
    const encodedPayload = encodeBytesToBase64(bytes);
    if (!normalizedMimeType || !encodedPayload) {
        return '';
    }
    return `data:${normalizedMimeType};base64,${encodedPayload}`;
}

function buildAsciiDownloadFilename(file) {
    const baseName = (file && file.name ? file.name : 'userpic')
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-z0-9-_]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
    return `${baseName || 'userpic'}-ascii.png`;
}

function parsePostArgs(args) {
    const options = {
        includeImage: false,
        textArgs: []
    };

    args.forEach(arg => {
        if (arg === '--image' || arg === '-i') {
            options.includeImage = true;
            return;
        }
        options.textArgs.push(arg);
    });

    return {
        includeImage: options.includeImage,
        text: options.textArgs.join(' ').trim()
    };
}

function parsePostTemplateBlocks(text, includeImage) {
    const placeholderPattern = /\[image\]/gi;
    const template = typeof text === 'string' ? text : '';
    const hasPlaceholder = placeholderPattern.test(template);
    placeholderPattern.lastIndex = 0;

    const normalizedTemplate = includeImage && !hasPlaceholder
        ? (template ? `${template} [image]` : '[image]')
        : template;

    const blocks = [];
    let lastIndex = 0;
    let match = placeholderPattern.exec(normalizedTemplate);

    while (match) {
        const textPart = normalizedTemplate.slice(lastIndex, match.index);
        if (textPart) {
            blocks.push({
                type: 'text',
                text: textPart
            });
        }

        blocks.push({ type: 'image' });
        lastIndex = match.index + match[0].length;
        match = placeholderPattern.exec(normalizedTemplate);
    }

    const trailingText = normalizedTemplate.slice(lastIndex);
    if (trailingText) {
        blocks.push({
            type: 'text',
            text: trailingText
        });
    }

    if (blocks.length === 0 && template) {
        blocks.push({
            type: 'text',
            text: template
        });
    }

    return blocks;
}

function normalizePostTextBlock(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
}

async function resolvePostContentBlocks(templateBlocks) {
    const contentBlocks = [];
    let totalTextLength = 0;
    const requestedMediaCount = templateBlocks.reduce(
        (count, block) => count + (block.type === 'image' ? 1 : 0),
        0
    );

    if (requestedMediaCount > BLOG_MAX_IMAGE_ATTACHMENTS) {
        return {
            error: `post: no more than ${BLOG_MAX_IMAGE_ATTACHMENTS} media attachments are allowed per entry`
        };
    }

    let mediaAttachments = [];
    if (requestedMediaCount > 0) {
        const selectedMedia = await selectPostMediaAttachments(requestedMediaCount);
        if (selectedMedia.error) {
            return { error: selectedMedia.error };
        }
        mediaAttachments = selectedMedia.attachments;
    }

    let mediaAttachmentIndex = 0;

    for (const block of templateBlocks) {
        if (block.type === 'image') {
            const imageAttachment = mediaAttachments[mediaAttachmentIndex];
            if (!imageAttachment) {
                return {
                    error: `post: upload cancelled; expected ${requestedMediaCount} media item${requestedMediaCount === 1 ? '' : 's'}`
                };
            }
            mediaAttachmentIndex += 1;

            contentBlocks.push({
                type: 'image',
                ...(imageAttachment.stagedUploadToken
                    ? {
                        stagedUploadToken: imageAttachment.stagedUploadToken,
                        ...(imageAttachment.imageEncoding === 'z85'
                            ? {
                                imageEncoding: 'z85',
                                mimeType: imageAttachment.mimeType,
                                byteLength: imageAttachment.byteLength
                            }
                            : {})
                    }
                    : imageAttachment.imageEncoding === 'z85'
                        ? {
                            imageEncoding: 'z85',
                            mimeType: imageAttachment.mimeType,
                            byteLength: imageAttachment.byteLength,
                            encodedPayload: imageAttachment.encodedPayload
                        }
                        : { imageDataUrl: imageAttachment.dataUrl }),
                fileName: imageAttachment.fileName
            });
            continue;
        }

        const normalizedText = normalizePostTextBlock(block.text);
        if (!normalizedText) {
            continue;
        }

        totalTextLength += normalizedText.length;
        if (totalTextLength > BLOG_MAX_POST_LENGTH) {
            return {
                error: `post: message exceeds ${BLOG_MAX_POST_LENGTH} characters`
            };
        }

        contentBlocks.push({
            type: 'text',
            text: normalizedText
        });
    }

    if (contentBlocks.length === 0) {
        return {
            error: 'post: missing blog text or media'
        };
    }

    return { contentBlocks };
}

async function deleteBlogImageByBlockIndex(
    imageBlockIndex,
    password,
    imageKey = '',
    imageDataUrl = '',
    entryTimestamp = '',
    entryImageIndex = null,
    previousTextLine = '',
    nextTextLine = ''
) {
    const resolvedPassword = typeof password === 'string' && password
        ? password
        : (canCurrentUserManageBlogEntries() ? getGodlikePassword() : '');
    const normalizedEntryTimestamp = isBlogEntryTimestampLine(entryTimestamp) ? entryTimestamp.trim() : '';
    const normalizedEntryImageIndex = Number.isInteger(entryImageIndex)
        ? entryImageIndex
        : Number.parseInt(entryImageIndex, 10);
    const normalizedPreviousTextLine = typeof previousTextLine === 'string' ? previousTextLine.trim() : '';
    const normalizedImageDataUrl = normalizeBlogImageDataUrl(imageDataUrl);
    const normalizedImageUrl = normalizedImageDataUrl ? '' : normalizeBlogImageUrl(imageDataUrl);
    const normalizedNextTextLine = typeof nextTextLine === 'string' ? nextTextLine.trim() : '';

    if ((!Number.isInteger(imageBlockIndex) || imageBlockIndex < 0) && !imageKey && !normalizedEntryTimestamp && !normalizedPreviousTextLine) {
        return {
            ok: false,
            error: 'invalid image reference'
        };
    }

    const response = await fetch(BLOG_DELETE_IMAGE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            imageBlockIndex,
            imageKey,
            imageDataUrl: normalizedImageDataUrl,
            imageUrl: normalizedImageUrl,
            entryTimestamp: normalizedEntryTimestamp,
              entryImageIndex: Number.isInteger(normalizedEntryImageIndex) && normalizedEntryImageIndex >= 0
                  ? normalizedEntryImageIndex
                  : null,
              previousTextLine: normalizedPreviousTextLine,
              nextTextLine: normalizedNextTextLine,
              password: resolvedPassword
          })
      });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        return {
            ok: false,
            error: payload.error || 'unable to delete image right now'
        };
    }

    return {
        ok: true,
        commitUrl: payload.commitUrl || ''
    };
}

async function deleteBlogEntryByTimestamp(entryTimestamp, password) {
    const resolvedPassword = typeof password === 'string' && password
        ? password
        : (canCurrentUserManageBlogEntries() ? getGodlikePassword() : '');
    const normalizedEntryTimestamp = isBlogEntryTimestampLine(entryTimestamp) ? entryTimestamp.trim() : '';
    if (!normalizedEntryTimestamp) {
        return {
            ok: false,
            error: 'invalid post reference'
        };
    }

    const response = await fetch(BLOG_DELETE_ENTRY_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            entryTimestamp: normalizedEntryTimestamp,
            password: resolvedPassword
        })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        return {
            ok: false,
            error: payload.error || 'unable to delete post right now'
        };
    }

    return {
        ok: true,
        commitUrl: payload.commitUrl || ''
    };
}

async function deleteBlogTextBlockByContext(
    entryTextBlockIndex,
    password,
    entryTimestamp = '',
    textKey = '',
    previousImageKey = '',
    nextImageKey = ''
) {
    const resolvedPassword = typeof password === 'string' && password
        ? password
        : (canCurrentUserManageBlogEntries() ? getGodlikePassword() : '');
    const normalizedEntryTimestamp = isBlogEntryTimestampLine(entryTimestamp) ? entryTimestamp.trim() : '';
    const normalizedEntryTextBlockIndex = Number.isInteger(entryTextBlockIndex)
        ? entryTextBlockIndex
        : Number.parseInt(entryTextBlockIndex, 10);
    const normalizedTextKey = typeof textKey === 'string' ? textKey.trim() : '';
    const normalizedPreviousImageKey = typeof previousImageKey === 'string' ? previousImageKey.trim() : '';
    const normalizedNextImageKey = typeof nextImageKey === 'string' ? nextImageKey.trim() : '';

    if (
        !normalizedEntryTimestamp
        || (
            (!Number.isInteger(normalizedEntryTextBlockIndex) || normalizedEntryTextBlockIndex < 0)
            && !normalizedTextKey
        )
    ) {
        return {
            ok: false,
            error: 'invalid text block reference'
        };
    }

    const response = await fetch(BLOG_DELETE_TEXT_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            entryTimestamp: normalizedEntryTimestamp,
            entryTextBlockIndex: Number.isInteger(normalizedEntryTextBlockIndex) && normalizedEntryTextBlockIndex >= 0
                ? normalizedEntryTextBlockIndex
                : null,
            textKey: normalizedTextKey,
            previousImageKey: normalizedPreviousImageKey,
            nextImageKey: normalizedNextImageKey,
            password: resolvedPassword
        })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        return {
            ok: false,
            error: payload.error || 'unable to delete text right now'
        };
    }

    return {
        ok: true,
        commitUrl: payload.commitUrl || ''
    };
}

function getDataUrlMimeType(dataUrl) {
    const match = BLOG_IMAGE_DATA_URL_PATTERN.exec(dataUrl || '');
    return match ? match[1].toLowerCase() : '';
}

function normalizeSupportedMediaMimeType(mimeType) {
    const normalizedMimeType = String(mimeType || '').trim().toLowerCase();
    return normalizedMimeType === 'image/jpg' ? 'image/jpeg' : normalizedMimeType;
}

function detectSupportedMediaMimeTypeFromBytes(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
        return '';
    }

    if (bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a) {
        return 'image/png';
    }

    if (bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff) {
        return 'image/jpeg';
    }

    if (bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50) {
        return 'image/webp';
    }

    if (bytes.length >= 6) {
        const gifHeader = String.fromCharCode(...bytes.slice(0, 6));
        if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
            return 'image/gif';
        }
    }

    if (bytes.length >= 12 &&
        bytes[4] === 0x66 &&
        bytes[5] === 0x74 &&
        bytes[6] === 0x79 &&
        bytes[7] === 0x70) {
        return 'video/mp4';
    }

    return '';
}

function mediaMimeTypesMatch(declaredMimeType, detectedMimeType) {
    return normalizeSupportedMediaMimeType(declaredMimeType) === normalizeSupportedMediaMimeType(detectedMimeType);
}

function decodeBase64ToBytes(value) {
    const binary = atob(String(value || '').replace(/\s+/g, ''));
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
}

function decodeBase64PrefixToBytes(base64Payload, prefixByteLength = BLOG_MEDIA_SIGNATURE_PREFIX_BYTES) {
    const normalizedPayload = String(base64Payload || '').replace(/\s+/g, '');
    const normalizedPrefixByteLength = Number.isFinite(prefixByteLength) && prefixByteLength > 0
        ? Math.floor(prefixByteLength)
        : BLOG_MEDIA_SIGNATURE_PREFIX_BYTES;
    if (!normalizedPayload) {
        return null;
    }

    const requiredGroups = Math.ceil(normalizedPrefixByteLength / 3);
    const requiredCharacters = requiredGroups * 4;
    try {
        const bytes = decodeBase64ToBytes(normalizedPayload.slice(0, requiredCharacters));
        return bytes.slice(0, normalizedPrefixByteLength);
    } catch {
        return null;
    }
}

function isHostedBlogMediaMimeType(mimeType) {
    return BLOG_ALLOWED_HOSTED_MEDIA_MIME_TYPES.has(String(mimeType || '').trim().toLowerCase());
}

function isMp4MimeType(mimeType) {
    return String(mimeType || '').trim().toLowerCase() === 'video/mp4';
}

function normalizeBlogImageDataUrl(dataUrl) {
    const match = BLOG_IMAGE_DATA_URL_PATTERN.exec(String(dataUrl || '').trim());
    if (!match) {
        return '';
    }

    const mimeType = match[1].toLowerCase();
    const base64Payload = match[2].replace(/\s+/g, '');
    return `data:${mimeType};base64,${base64Payload}`;
}

function createBlogStableBlockKey(value) {
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) {
        return '';
    }

    let hash = 2166136261;
    for (let index = 0; index < normalizedValue.length; index += 1) {
        hash ^= normalizedValue.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }

    return `${normalizedValue.length}:${(hash >>> 0).toString(16)}`;
}

function createBlogImageKey(dataUrl) {
    const normalizedValue = normalizeBlogImageDataUrl(dataUrl) || String(dataUrl || '').trim();
    return createBlogStableBlockKey(normalizedValue);
}

function createBlogTextBlockKey(lines) {
    const normalizedLines = Array.isArray(lines)
        ? lines.map(line => String(line ?? ''))
        : String(lines || '').replace(/\r\n/g, '\n').split('\n');
    return createBlogStableBlockKey(normalizedLines.join('\n'));
}

function isBlogEntryTimestampLine(line) {
    return /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z]$/.test(String(line || '').trim());
}

function isSafeBlogImageDataUrl(dataUrl) {
    const normalizedDataUrl = normalizeBlogImageDataUrl(dataUrl);
    if (!normalizedDataUrl || normalizedDataUrl.length > BLOG_MAX_IMAGE_DATA_URL_LENGTH) {
        return false;
    }

    const match = BLOG_IMAGE_DATA_URL_PATTERN.exec(normalizedDataUrl);
    if (!match) {
        return false;
    }

    const mimeType = match[1].toLowerCase();
    if (!BLOG_ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
        return false;
    }

    const prefixBytes = decodeBase64PrefixToBytes(match[2], BLOG_MEDIA_SIGNATURE_PREFIX_BYTES);
    return Boolean(prefixBytes) && mediaMimeTypesMatch(mimeType, detectSupportedMediaMimeTypeFromBytes(prefixBytes));
}

function isSafeBlogImageSource(source) {
    if (isSafeBlogImageDataUrl(source)) {
        return true;
    }

    if (/^blob:/i.test(String(source || '').trim())) {
        return true;
    }

    return isSafeHostedBlogImageUrl(source);
}

function normalizeBlogImageUrl(imageUrl) {
    try {
        const parsed = new URL(String(imageUrl || '').trim(), window.location.href);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return '';
        }
        return parsed.toString();
    } catch {
        return '';
    }
}

function getTrustedBlogImageOrigins() {
    const origins = new Set([window.location.origin]);
    [BLOG_POST_API_URL, BLOG_STAGE_IMAGE_API_URL, BLOG_DELETE_IMAGE_API_URL].forEach(url => {
        try {
            origins.add(new URL(url, window.location.href).origin);
        } catch {
            // Ignore malformed configured URLs.
        }
    });
    return origins;
}

function isSafeHostedBlogImageUrl(imageUrl) {
    const normalizedImageUrl = normalizeBlogImageUrl(imageUrl);
    if (!normalizedImageUrl) {
        return false;
    }

    try {
        const parsed = new URL(normalizedImageUrl);
        if (!getTrustedBlogImageOrigins().has(parsed.origin)) {
            return false;
        }

        return /\/api\/blog\/media\//.test(parsed.pathname);
    } catch {
        return false;
    }
}

function parseCompactBlogImageBlockLines(imageLines) {
    if (!Array.isArray(imageLines) || imageLines.length < 3) {
        return null;
    }

    const mimeTypeMatch = /^mime:(.+)$/i.exec(String(imageLines[0] || '').trim());
    const byteLengthMatch = /^bytes:(\d+)$/i.exec(String(imageLines[1] || '').trim());
    const encodedPayload = imageLines.slice(2).join('').trim();
    if (!mimeTypeMatch || !byteLengthMatch || !encodedPayload) {
        return null;
    }

    const mimeType = mimeTypeMatch[1].trim().toLowerCase();
    const byteLength = Number.parseInt(byteLengthMatch[1], 10);
    if (!BLOG_ALLOWED_IMAGE_MIME_TYPES.has(mimeType) || !Number.isInteger(byteLength) || byteLength <= 0) {
        return null;
    }

    const imageBytes = decodeZ85ToBytes(encodedPayload, byteLength);
    if (!imageBytes) {
        return null;
    }

    if (!mediaMimeTypesMatch(mimeType, detectSupportedMediaMimeTypeFromBytes(imageBytes.slice(0, BLOG_MEDIA_SIGNATURE_PREFIX_BYTES)))) {
        return null;
    }

    return {
        mimeType,
        encodedPayload,
        src: URL.createObjectURL(new Blob([imageBytes], { type: mimeType }))
    };
}

function parseHostedBlogImageBlockLines(imageLines) {
    if (!Array.isArray(imageLines) || imageLines.length < 4) {
        return null;
    }

    const blockData = Object.create(null);
    for (const line of imageLines) {
        const match = /^([a-z-]+):([\s\S]+)$/i.exec(String(line || '').trim());
        if (!match) {
            return null;
        }

        blockData[match[1].toLowerCase()] = match[2].trim();
    }

    const src = normalizeBlogImageUrl(blockData.src);
    const mimeType = String(blockData.mime || '').trim().toLowerCase();
    if (!src || !isHostedBlogMediaMimeType(mimeType) || !isSafeHostedBlogImageUrl(src)) {
        return null;
    }

    return {
        src,
        mimeType,
        mediaType: isMp4MimeType(mimeType) ? 'video' : 'image'
    };
}

function decodeZ85ToBytes(encodedPayload, byteLength) {
    const payload = String(encodedPayload || '').trim();
    if (!payload || payload.length % 5 !== 0 || !Number.isInteger(byteLength) || byteLength <= 0) {
        return null;
    }

    const output = new Uint8Array(byteLength);
    let outputIndex = 0;

    for (let index = 0; index < payload.length; index += 5) {
        let value = 0;

        for (let characterIndex = 0; characterIndex < 5; characterIndex += 1) {
            const alphabetIndex = BLOG_Z85_CHAR_TO_VALUE[payload[index + characterIndex]];
            if (!Number.isInteger(alphabetIndex) || alphabetIndex < 0) {
                return null;
            }
            value = (value * 85) + alphabetIndex;
        }

        const bytes = [
            Math.floor(value / 16777216) % 256,
            Math.floor(value / 65536) % 256,
            Math.floor(value / 256) % 256,
            value % 256
        ];

        for (const byte of bytes) {
            if (outputIndex >= byteLength) {
                break;
            }
            output[outputIndex] = byte;
            outputIndex += 1;
        }
    }

    return outputIndex === byteLength ? output : null;
}

function encodeBytesToZ85(bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
        return '';
    }

    const paddedLength = Math.ceil(bytes.length / 4) * 4;
    const padded = new Uint8Array(paddedLength);
    padded.set(bytes);
    const segments = [];
    let segment = [];

    for (let index = 0; index < padded.length; index += 4) {
        let value =
            (padded[index] * 16777216) +
            ((padded[index + 1] || 0) << 16) +
            ((padded[index + 2] || 0) << 8) +
            (padded[index + 3] || 0);
        const chunk = new Array(5);

        for (let characterIndex = 4; characterIndex >= 0; characterIndex -= 1) {
            chunk[characterIndex] = BLOG_Z85_ALPHABET[value % 85];
            value = Math.floor(value / 85);
        }

        segment.push(chunk.join(''));
        if (segment.length >= 4096) {
            segments.push(segment.join(''));
            segment = [];
        }
    }

    if (segment.length > 0) {
        segments.push(segment.join(''));
    }

    return segments.join('');
}

async function buildCompactGifImageAttachment(file) {
    const arrayBuffer = await readFileAsArrayBuffer(file);
    const imageBytes = new Uint8Array(arrayBuffer);
    const encodedPayload = encodeBytesToZ85(imageBytes);
    if (!encodedPayload) {
        return {
            error: 'post: unable to prepare gif for upload'
        };
    }

    if (encodedPayload.length > BLOG_DIRECT_POST_IMAGE_DATA_URL_LENGTH) {
        const staged = await stageBlogUploadPayload(encodedPayload, 'compact gif upload');
        if (!staged.ok) {
            return { error: staged.error };
        }

        return {
            stagedUploadToken: staged.token,
            imageEncoding: 'z85',
            mimeType: 'image/gif',
            byteLength: imageBytes.length,
            fileName: file.name || 'image'
        };
    }

    return {
        imageEncoding: 'z85',
        mimeType: 'image/gif',
        byteLength: imageBytes.length,
        encodedPayload,
        fileName: file.name || 'image'
    };
}

async function buildPostMediaAttachmentFromFile(file) {
    if (!file) {
        return { error: 'post: no media selected' };
    }

    const signatureBytes = await readFileSignatureBytes(file);
    const detectedMimeType = detectSupportedMediaMimeTypeFromBytes(signatureBytes);
    if (!BLOG_ALLOWED_POST_MEDIA_MIME_TYPES.has(detectedMimeType)) {
        return { error: `post: media must be ${BLOG_SUPPORTED_POST_MEDIA_TYPES_LABEL}` };
    }

    const declaredMimeType = normalizeSupportedMediaMimeType(file.type);
    const dataUrl = declaredMimeType && mediaMimeTypesMatch(declaredMimeType, detectedMimeType)
        ? await readFileAsDataUrl(file)
        : createDataUrlFromBytes(new Uint8Array(await readFileAsArrayBuffer(file)), detectedMimeType);
    const mimeType = getDataUrlMimeType(dataUrl);
    if (!BLOG_ALLOWED_POST_MEDIA_MIME_TYPES.has(mimeType)) {
        return { error: `post: media must be ${BLOG_SUPPORTED_POST_MEDIA_TYPES_LABEL}` };
    }

    if (dataUrl.length > BLOG_MAX_IMAGE_DATA_URL_LENGTH) {
        return {
            error: isMp4MimeType(mimeType)
                ? 'post: selected mp4 is too large to upload right now'
                : 'post: selected image is too large to store in blog.txt as base64'
        };
    }

    if (isMp4MimeType(mimeType)) {
        const staged = await stageBlogUploadPayload(dataUrl, 'mp4 upload');
        if (!staged.ok) {
            return { error: staged.error };
        }

        return {
            stagedUploadToken: staged.token,
            mimeType,
            fileName: file.name || 'media'
        };
    }

    if (dataUrl.length > BLOG_DIRECT_POST_IMAGE_DATA_URL_LENGTH) {
        const staged = await stageBlogUploadPayload(
            dataUrl,
            mimeType === 'image/gif' ? 'gif upload' : 'image upload'
        );
        if (!staged.ok) {
            return { error: staged.error };
        }

        return {
            stagedUploadToken: staged.token,
            mimeType,
            fileName: file.name || 'media'
        };
    }

    return {
        dataUrl,
        mimeType,
        fileName: file.name || 'media'
    };
}

async function buildUserpicImageSource(file) {
    if (!file) {
        return {
            ok: false,
            error: 'userpic: no image selected'
        };
    }

    if (Number(file.size || 0) > USERPIC_MAX_FILE_BYTES) {
        return {
            ok: false,
            error: 'userpic: selected image must be 8 MB or smaller'
        };
    }

    const signatureBytes = await readFileSignatureBytes(file);
    const detectedMimeType = detectSupportedMediaMimeTypeFromBytes(signatureBytes);
    if (!BLOG_ALLOWED_IMAGE_MIME_TYPES.has(detectedMimeType)) {
        return {
            ok: false,
            error: `userpic: selected file must be a ${USERPIC_SUPPORTED_IMAGE_TYPES_LABEL} image`
        };
    }

    const declaredMimeType = normalizeSupportedMediaMimeType(file.type);
    const imageSource = declaredMimeType && mediaMimeTypesMatch(declaredMimeType, detectedMimeType)
        ? file
        : createDataUrlFromBytes(new Uint8Array(await readFileAsArrayBuffer(file)), detectedMimeType);
    if (!imageSource) {
        return {
            ok: false,
            error: 'userpic: unable to process selected image'
        };
    }

    const image = await decodeSelectedImage(imageSource);
    const { sourceWidth, sourceHeight } = getAsciiSourceDimensions(image);
    if (sourceWidth > USERPIC_MAX_SOURCE_WIDTH || sourceHeight > USERPIC_MAX_SOURCE_HEIGHT) {
        return {
            ok: false,
            error: `userpic: selected image dimensions must be ${USERPIC_MAX_SOURCE_WIDTH}x${USERPIC_MAX_SOURCE_HEIGHT} or smaller`
        };
    }

    return {
        ok: true,
        image
    };
}

async function selectPostMediaAttachments(requiredCount = 1) {
    const normalizedCount = Number.isInteger(requiredCount) && requiredCount > 0
        ? requiredCount
        : 1;
    const uploadCore = await ensureBlogUploadCoreReady();
    const selection = uploadCore?.collectIncrementalPostMediaFiles
        ? await uploadCore.collectIncrementalPostMediaFiles(
            pickerOptions => selectUserImageFiles({
                accept: pickerOptions.accept,
                exactCount: pickerOptions.exactCount,
                multiple: pickerOptions.multiple
            }),
            normalizedCount,
            {
                accept: BLOG_POST_FILE_ACCEPT
            }
        )
        : await (async () => {
            const selectedFiles = [];

            while (selectedFiles.length < normalizedCount) {
                const remainingCount = normalizedCount - selectedFiles.length;
                const files = await selectUserImageFiles({
                    accept: BLOG_POST_FILE_ACCEPT,
                    exactCount: remainingCount,
                    multiple: remainingCount > 1
                });

                if (files.length === 0) {
                    break;
                }

                if (files.length > remainingCount) {
                    return {
                        ok: false,
                        files: [...selectedFiles, ...files],
                        error: `post: upload cancelled; expected ${remainingCount} more media item${remainingCount === 1 ? '' : 's'} but received ${files.length}`
                    };
                }

                selectedFiles.push(...files);
            }

            return {
                ok: selectedFiles.length === normalizedCount,
                files: selectedFiles,
                error: selectedFiles.length === 0
                    ? 'post: no media selected'
                    : `post: upload cancelled; expected ${normalizedCount} media item${normalizedCount === 1 ? '' : 's'} but received ${selectedFiles.length}`
            };
        })();

    if (!selection.ok) {
        return { error: selection.error };
    }

    const attachments = [];
    for (const file of selection.files) {
        const attachment = await buildPostMediaAttachmentFromFile(file);
        if (attachment.error) {
            return attachment;
        }
        attachments.push(attachment);
    }

    return { attachments };
}

async function stageBlogUploadPayload(payload, payloadLabel = 'image upload') {
    const normalizedPayload = typeof payload === 'string' ? payload : '';
    if (!normalizedPayload) {
        return {
            ok: false,
            error: `post: unable to prepare ${payloadLabel}`
        };
    }

    const uploadId = createBlogUploadId();
    const totalChunks = Math.ceil(normalizedPayload.length / BLOG_STAGED_IMAGE_CHUNK_LENGTH);
    if (totalChunks > BLOG_MAX_STAGED_IMAGE_CHUNKS) {
        return {
            ok: false,
            error: `post: selected ${payloadLabel} is too large to stage for upload right now`
        };
    }

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
        const chunk = normalizedPayload.slice(
            chunkIndex * BLOG_STAGED_IMAGE_CHUNK_LENGTH,
            (chunkIndex + 1) * BLOG_STAGED_IMAGE_CHUNK_LENGTH
        );
        let response;

        try {
            response = await fetch(BLOG_STAGE_IMAGE_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uploadId,
                    chunkIndex,
                    totalChunks,
                    chunk
                })
            });
        } catch (error) {
            return {
                ok: false,
                error: `post: unable to stage ${payloadLabel} chunk ${chunkIndex + 1} of ${totalChunks}`
            };
        }

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            return {
                ok: false,
                error: payload.error || `post: unable to stage ${payloadLabel} chunk ${chunkIndex + 1} of ${totalChunks}`
            };
        }
    }

    return {
        ok: true,
        token: uploadId
    };
}

function createBlogUploadId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }

    return `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function date_command() {
    return [new Date().toString()];
}

function echo_command(args) {
    return [args.join(' ')];
}

function parseAstrologyFortunes(source) {
    const match = source.match(/(?:const|let|var)\s+FORTUNE_COOKIE_RESP\s*=\s*(\[[\s\S]*?\]);/);
    if (!match) {
        throw new Error('fortune array not found');
    }
    const fortunes = JSON.parse(match[1]);
    if (!Array.isArray(fortunes) || fortunes.length === 0) {
        throw new Error('fortune array empty');
    }
    return fortunes;
}

async function fortune_command() {
    for (const source of ASTROLOGY_FORTUNE_SOURCES) {
        try {
            const response = await fetch(source.url, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`request failed with status ${response.status}`);
            }
            const html = await source.parseResponse(response);
            const fortunes = parseAstrologyFortunes(html);
            return [fortunes[Math.floor(Math.random() * fortunes.length)]];
        } catch (error) {
            console.error(`fortune fetch failed for ${source.url}`, error);
        }
    }

    return ['fortune: unable to retrieve a live fortune right now'];
}

function github_command() {
    window.open('https://github.com/0x00C0DE', '_blank');
    return [];
}

function history_command() {
    const commandHistory = typeof window.getTerminalCommandHistory === 'function'
        ? window.getTerminalCommandHistory()
        : [];
    if (commandHistory.length === 0) {
        return [];
    }
    const output = [];
    commandHistory.slice(-20).forEach((cmd, i) => {
        output.push(`  ${(i + 1).toString().padStart(3)}: ${cmd}`);
    });
    return output;
}

function instagram_command() {
    window.open('https://www.instagram.com/smallmediumpizza/', '_blank');
    return [];
}

function linkedin_command() {
    window.open('https://www.linkedin.com/in/braden-lee-7074491b0/', '_blank');
    return [];
}

function ls_command() {
    return [TEXT_FILES.join('  ')];
}

async function video_command(args) {
    if (typeof window.showVideo === 'function') {
        return window.showVideo(args);
    }
    return window.showMovie(args);
}

async function movie_command(args) {
    return video_command(args);
}

async function mypic_command(args) {
    const width = args[0] ? parseInt(args[0], 10) : 100;
    const height = args[1] ? parseInt(args[1], 10) : 90;
    const img = new Image();
    img.src = normalizeImgurImage('https://imgur.com/KHiJtUI');
    img.setAttribute('crossOrigin', 'anonymous');
    await img.decode();
    return renderImageToAscii(img, width, height);
}

async function picture_command(args) {
    return mypic_command(args);
}

function pretext_command(args) {
    if (args[0] && args[0].toLowerCase() === 'lab') {
        window.open(buildPretextLabHref(args.slice(1).join(' ')), '_self');
        return [];
    }

    return [
        'pretext: terminal text wrapping is active on this page',
        'pretext: plain terminal output and echoed commands now flow through the Pretext layout engine',
        'pretext: run `pretext lab` to open the standalone layout lab'
    ];
}

async function authenticateGodlikeSession() {
    if (canCurrentUserManageBlogEntries()) {
        return { ok: true };
    }

    const password = window.prompt('Enter godlike password');
    if (password === null) {
        return {
            ok: false,
            error: 'authentication cancelled'
        };
    }

    try {
        const response = await fetch(TERMINAL_SU_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                password,
                target: 'godlike'
            })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            return {
                ok: false,
                error: payload.error || 'unable to authenticate godlike right now'
            };
        }

        setGodlikePassword(password);
        return { ok: true };
    } catch (error) {
        console.error('godlike authentication failed', error);
        return {
            ok: false,
            error: 'unable to authenticate godlike right now'
        };
    }
}

async function su_command(args) {
    const target = resolveSupportedSuTarget(args);
    if (!target) {
        return [
            'su: unsupported user target',
            'usage: su',
            '       su guest',
            '       su godlike'
        ];
    }

    if (target === 'godlike') {
        const authentication = await authenticateGodlikeSession();
        if (!authentication.ok) {
            return [`su: ${authentication.error}`];
        }
    }

    setTerminalSessionState(applyTerminalSessionCommand('su', args));
    return [];
}

async function post_command(args) {
    const { includeImage, text } = parsePostArgs(args);
    if (!text && !includeImage) {
            return [
                'post: missing entry content',
                'usage: post Your blog entry goes here',
                '       post first [image] second [image] third',
                '       omit [image] for text-only posts',
                `       media types: ${BLOG_SUPPORTED_POST_MEDIA_TYPES_LABEL}`
            ];
        }

    try {
        const templateBlocks = parsePostTemplateBlocks(text, includeImage);
        const resolved = await resolvePostContentBlocks(templateBlocks);
        if (resolved.error) {
            return [resolved.error];
        }

        const turnstileToken = await requestTurnstileToken();

        const response = await fetch(BLOG_POST_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contentBlocks: resolved.contentBlocks,
                turnstileToken
            })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            return [`post: ${payload.error || 'unable to append entry right now'}`];
        }

          const output = ['post: blog entry appended successfully'];
          const imageCount = resolved.contentBlocks.filter(block => block.type === 'image').length;
          if (imageCount > 0) {
              output.push(`post: attached ${imageCount} media item${imageCount === 1 ? '' : 's'} in the entry`);
          }
        if (payload.commitUrl) {
            output.push({
                type: 'text-link',
                prefix: 'post: ',
                href: payload.commitUrl,
                text: 'view commit',
                newTab: true
            });
        }
        return output;
    } catch (error) {
        console.error('post failed', error);
        const message = typeof error?.message === 'string' && error.message.trim()
            ? error.message.trim()
            : 'backend unavailable right now';
        return [`post: ${message}`];
    }
}

function getQrTotpUsage() {
    return [
        'qr-totp usage:',
        '  qr-totp --generate-qr --issuer=ExampleApp --username=alice --email=alice@example.com',
        '  qr-totp --get-otp',
        '  qr-totp --show',
        '  qr-totp --verify=123456',
        '  qr-totp --clear'
    ];
}

function parseQrTotpArgs(args) {
    const options = {
        action: null,
        issuer: '',
        username: '',
        email: '',
        verifyCode: ''
    };

    const setAction = action => {
        if (options.action && options.action !== action) {
            return `qr-totp: choose exactly one action at a time`;
        }
        options.action = action;
        return null;
    };

    for (const arg of args) {
        if (arg === '--generate-qr') {
            const error = setAction('generate');
            if (error) {
                return { error };
            }
            continue;
        }
        if (arg === '--get-otp') {
            const error = setAction('otp');
            if (error) {
                return { error };
            }
            continue;
        }
        if (arg === '--show') {
            const error = setAction('show');
            if (error) {
                return { error };
            }
            continue;
        }
        if (arg === '--clear') {
            const error = setAction('clear');
            if (error) {
                return { error };
            }
            continue;
        }
        if (arg.startsWith('--verify=')) {
            const error = setAction('verify');
            if (error) {
                return { error };
            }
            options.verifyCode = arg.slice('--verify='.length).trim();
            continue;
        }
        if (arg.startsWith('--issuer=')) {
            options.issuer = arg.slice('--issuer='.length).trim();
            continue;
        }
        if (arg.startsWith('--username=')) {
            options.username = arg.slice('--username='.length).trim();
            continue;
        }
        if (arg.startsWith('--email=')) {
            options.email = arg.slice('--email='.length).trim();
            continue;
        }

        return { error: `qr-totp: unrecognized option ${arg}` };
    }

    if (!options.action) {
        return { error: 'qr-totp: choose one of --generate-qr, --get-otp, --show, --verify=123456, or --clear' };
    }

    if (options.action === 'generate') {
        const missing = [];
        if (!options.issuer) {
            missing.push('--issuer=...');
        }
        if (!options.username) {
            missing.push('--username=...');
        }
        if (!options.email) {
            missing.push('--email=...');
        }
        if (missing.length > 0) {
            return { error: `qr-totp: --generate-qr requires ${missing.join(', ')}` };
        }
    }

    if (options.action === 'verify') {
        if (!/^\d{6}$/.test(options.verifyCode)) {
            return { error: 'qr-totp: --verify requires a 6-digit code, for example --verify=123456' };
        }
    }

    return { options };
}

function validateQrTotpEnrollment(enrollment) {
    if (!enrollment || typeof enrollment !== 'object') {
        return null;
    }
    const { issuer, username, email, secret, createdAt } = enrollment;
    if (
        typeof issuer !== 'string' ||
        typeof username !== 'string' ||
        typeof email !== 'string' ||
        typeof secret !== 'string' ||
        !secret
    ) {
        return null;
    }

    return {
        issuer,
        username,
        email,
        secret: secret.toUpperCase(),
        createdAt: typeof createdAt === 'string' ? createdAt : new Date().toISOString()
    };
}

function loadQrTotpEnrollment() {
    return validateQrTotpEnrollment(window[QR_TOTP_MEMORY_KEY]) || null;
}

function saveQrTotpEnrollment(enrollment) {
    const normalized = validateQrTotpEnrollment(enrollment);
    if (!normalized) {
        throw new Error('invalid enrollment payload');
    }

    window[QR_TOTP_MEMORY_KEY] = normalized;
    return 'memory';
}

function clearQrTotpEnrollment() {
    delete window[QR_TOTP_MEMORY_KEY];
}

function encodeBase32(bytes) {
    let bits = 0;
    let value = 0;
    let output = '';

    bytes.forEach(byte => {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            output += QR_TOTP_BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    });

    if (bits > 0) {
        output += QR_TOTP_BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
}

function decodeBase32(secret) {
    let bits = 0;
    let value = 0;
    const output = [];
    const normalized = secret.toUpperCase().replace(/=+$/g, '');

    for (const char of normalized) {
        const index = QR_TOTP_BASE32_ALPHABET.indexOf(char);
        if (index === -1) {
            throw new Error('secret contains invalid base32 characters');
        }

        value = (value << 5) | index;
        bits += 5;
        if (bits >= 8) {
            output.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }

    return new Uint8Array(output);
}

function generateQrTotpSecret() {
    if (!window.crypto || typeof window.crypto.getRandomValues !== 'function') {
        throw new Error('secure random generation is unavailable in this browser');
    }

    const bytes = new Uint8Array(QR_TOTP_SECRET_BYTES);
    window.crypto.getRandomValues(bytes);
    return encodeBase32(bytes);
}

function buildQrTotpOtpauthUrl(enrollment) {
    const label = encodeURIComponent(`${enrollment.issuer}:${enrollment.email}`);
    return `otpauth://totp/${label}?secret=${enrollment.secret}&issuer=${encodeURIComponent(enrollment.issuer)}&username=${encodeURIComponent(enrollment.username)}`;
}

function buildQrTotpImageUrl(otpauthUrl) {
    return `https://quickchart.io/qr?text=${encodeURIComponent(otpauthUrl)}&size=280&format=svg&margin=2&ecLevel=H`;
}

async function generateQrTotpCode(secret, timestampMs = Date.now()) {
    if (!window.crypto || !window.crypto.subtle) {
        throw new Error('Web Crypto is unavailable in this browser');
    }

    const counter = BigInt(Math.floor(timestampMs / 1000 / QR_TOTP_STEP_SECONDS));
    const counterBytes = new Uint8Array(8);
    let value = counter;

    for (let index = counterBytes.length - 1; index >= 0; index -= 1) {
        counterBytes[index] = Number(value & 255n);
        value >>= 8n;
    }

    const key = await window.crypto.subtle.importKey(
        'raw',
        decodeBase32(secret),
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
    );

    const signature = new Uint8Array(await window.crypto.subtle.sign('HMAC', key, counterBytes));
    const offset = signature[signature.length - 1] & 15;
    const binary =
        ((signature[offset] & 127) << 24) |
        ((signature[offset + 1] & 255) << 16) |
        ((signature[offset + 2] & 255) << 8) |
        (signature[offset + 3] & 255);

    return {
        otp: String(binary % (10 ** QR_TOTP_CODE_DIGITS)).padStart(QR_TOTP_CODE_DIGITS, '0'),
        secondsRemaining: QR_TOTP_STEP_SECONDS - (Math.floor(timestampMs / 1000) % QR_TOTP_STEP_SECONDS)
    };
}

async function verifyQrTotpCode(secret, candidate) {
    const now = Date.now();
    for (const stepOffset of [-1, 0, 1]) {
        const windowTime = now + stepOffset * QR_TOTP_STEP_SECONDS * 1000;
        const current = await generateQrTotpCode(secret, windowTime);
        if (current.otp === candidate) {
            return { valid: true, driftSteps: stepOffset };
        }
    }

    return { valid: false, driftSteps: null };
}

function buildQrTotpViewerHint(enrollment, storageMode = '') {
    const storedMessage = storageMode === 'memory'
        ? 'available only until this page is refreshed or closed'
        : 'saved in this browser';
    return `${enrollment.issuer} / ${enrollment.username} / ${enrollment.email} - scan this QR or save it (${storedMessage})`;
}

function openQrTotpViewer(enrollment, options = {}) {
    const otpauthUrl = buildQrTotpOtpauthUrl(enrollment);
    const qrUrl = buildQrTotpImageUrl(otpauthUrl);
    if (typeof window.showImageStill === 'function') {
        window.showImageStill(qrUrl, {
            title: options.title || 'qr-totp',
            hint: options.hint || 'scan this QR with your authenticator app, or save it to your device',
            download: {
                filename: options.filename || 'qr-totp-enrollment.svg',
                label: options.downloadLabel || 'save'
            }
        });
    } else {
        window.open(getSafeTerminalHref(qrUrl), '_blank', 'noopener');
    }
}

async function qr_totp_command(args) {
    const parsed = parseQrTotpArgs(args);
    if (parsed.error) {
        return [parsed.error, ...getQrTotpUsage()];
    }

    const { options } = parsed;

    if (options.action === 'clear') {
        clearQrTotpEnrollment();
        return ['qr-totp: cleared the saved enrollment from this browser'];
    }

    if (options.action === 'generate') {
        const enrollment = {
            issuer: options.issuer,
            username: options.username,
            email: options.email,
            secret: generateQrTotpSecret(),
            createdAt: new Date().toISOString()
        };
        const storageMode = saveQrTotpEnrollment(enrollment);
        openQrTotpViewer(enrollment, {
            title: 'qr-totp enrollment',
            hint: buildQrTotpViewerHint(enrollment, storageMode),
            filename: `${enrollment.issuer}-${enrollment.username}-qr.svg`
                .replace(/[^a-z0-9-_]+/gi, '-')
                .replace(/^-+|-+$/g, '')
                .toLowerCase() || 'qr-totp-enrollment.svg'
        });
        return [];
    }

    const enrollment = loadQrTotpEnrollment();
    if (!enrollment) {
        return [
            'qr-totp: no enrolled secret found in this browser',
            'run `qr-totp --generate-qr --issuer=ExampleApp --username=alice --email=alice@example.com` first'
        ];
    }

    if (options.action === 'show') {
        openQrTotpViewer(enrollment, {
            title: 'qr-totp enrollment',
            hint: buildQrTotpViewerHint(enrollment)
        });
        return [];
    }

    if (options.action === 'otp') {
        const current = await generateQrTotpCode(enrollment.secret);
        return [
            `qr-totp: current otp for ${enrollment.username} is ${current.otp}`,
            `refreshes in: ${current.secondsRemaining}s`
        ];
    }

    if (options.action === 'verify') {
        const verification = await verifyQrTotpCode(enrollment.secret, options.verifyCode);
        if (!verification.valid) {
            return [`qr-totp: ${options.verifyCode} is not valid for the current enrollment`];
        }

        if (verification.driftSteps === 0) {
            return [`qr-totp: ${options.verifyCode} is valid for the current 30-second window`];
        }

        const direction = verification.driftSteps < 0 ? 'previous' : 'next';
        return [`qr-totp: ${options.verifyCode} is valid in the ${direction} 30-second window`];
    }

    return getQrTotpUsage();
}

async function userpic_command(args) {
    const width = args[0] ? parseInt(args[0], 10) : 160;
    const height = args[1] ? parseInt(args[1], 10) : null;

    const file = await selectUserImageFile();

    try {
        const preparedImage = await buildUserpicImageSource(file);
        if (!preparedImage.ok) {
            return [preparedImage.error];
        }

        const asciiLines = await renderImageToAscii(preparedImage.image, width, height);
        showAsciiStill(asciiLines, {
            title: 'userpic',
            download: {
                filename: buildAsciiDownloadFilename(file),
                label: 'save'
            }
        });
        return [];
    } catch (error) {
        console.error('userpic failed', error);
        return ['userpic: unable to process selected image'];
    }
}

function generateVisitorId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    const randomChunk = Math.random().toString(36).slice(2);
    return `visitor-${Date.now().toString(36)}-${randomChunk}`;
}

function getCurrentVisitId() {
    if (!visitorCounterState.visitId) {
        visitorCounterState.visitId = generateVisitorId().replace(/^visitor-/, 'visit-');
    }
    return visitorCounterState.visitId;
}

function getPersistentVisitorId() {
    if (visitorCounterState.visitorId) {
        return visitorCounterState.visitorId;
    }

    try {
        const stored = window.localStorage.getItem('siteVisitorId');
        if (stored) {
            visitorCounterState.visitorId = stored;
            return stored;
        }
    } catch (error) {
        console.warn('visitor id storage unavailable', error);
    }

    const nextId = generateVisitorId();
    visitorCounterState.visitorId = nextId;

    try {
        window.localStorage.setItem('siteVisitorId', nextId);
    } catch (error) {
        console.warn('unable to persist visitor id', error);
    }

    return nextId;
}

function getDefaultVisitorStats() {
    return {
        visits: 0,
        uniqueVisitors: 0,
        onSite: 0
    };
}

function getCurrentVisitorStats() {
    return visitorCounterState.stats || getDefaultVisitorStats();
}

function formatVisitorDigits(value, width = 7) {
    const safeValue = Math.max(0, Number.isFinite(value) ? Math.floor(value) : 0);
    return String(safeValue).padStart(width, '0');
}

function createVisitorDigitsFragment(value, width = 7) {
    const digits = formatVisitorDigits(value, width);
    const fragment = document.createDocumentFragment();
    const firstNonZeroIndex = digits.search(/[1-9]/);
    const zeroCutoff = firstNonZeroIndex === -1 ? digits.length - 1 : firstNonZeroIndex;

    digits.split('').forEach((digit, index) => {
        const span = document.createElement('span');
        span.className = digit === '0' && index < zeroCutoff ? 'visitor-digit visitor-digit-dim' : 'visitor-digit';
        span.textContent = digit;
        fragment.append(span);
    });

    return fragment;
}

function buildVisitorWidgetElement(stats = null) {
    const currentStats = stats || getCurrentVisitorStats();
    const widget = document.createElement('div');
    widget.className = 'visitor-widget';
    widget.setAttribute('data-visitor-counter', '');

    const rows = [
        ['Visits:', 'visits'],
        ['Uniq. Visitors:', 'uniqueVisitors'],
        ['On-site:', 'onSite']
    ];

    rows.forEach(([labelText, fieldName]) => {
        const row = document.createElement('div');
        row.className = 'visitor-widget-row';

        const label = document.createElement('span');
        label.className = 'visitor-label';
        label.textContent = labelText;

        const value = document.createElement('span');
        value.className = 'visitor-value';
        value.setAttribute('data-visitor-field', fieldName);
        value.append(createVisitorDigitsFragment(currentStats[fieldName]));

        row.append(label, value);
        widget.append(row);
    });

    return widget;
}

function renderVisitorCounter() {
    const elements = document.querySelectorAll('[data-visitor-counter]');
    const currentStats = getCurrentVisitorStats();

    if (elements.length) {
        elements.forEach(element => {
            element.querySelectorAll('[data-visitor-field]').forEach(field => {
                const fieldName = field.getAttribute('data-visitor-field');
                field.replaceChildren(createVisitorDigitsFragment(currentStats[fieldName]));
            });
        });
    }

    if (typeof window.refreshTerminalVisitorStats === 'function') {
        window.refreshTerminalVisitorStats();
    }
}

function isValidVisitorStats(payload) {
    return ['visits', 'uniqueVisitors', 'onSite'].every(key => typeof payload?.[key] === 'number');
}

function extractVisitorStats(payload) {
    return {
        visits: payload.visits,
        uniqueVisitors: payload.uniqueVisitors,
        onSite: payload.onSite
    };
}

async function fetchVisitorStats() {
    if (visitorCounterState.pendingStats) {
        return visitorCounterState.pendingStats;
    }

    visitorCounterState.pendingStats = fetch(VISITOR_COUNT_API_URL, {
        method: 'GET',
        cache: 'no-store'
    })
        .then(async response => {
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !isValidVisitorStats(payload)) {
                throw new Error(payload.error || `request failed with status ${response.status}`);
            }
            visitorCounterState.stats = extractVisitorStats(payload);
            renderVisitorCounter();
            return visitorCounterState.stats;
        })
        .catch(error => {
            console.error('visitor counter failed', error);
            renderVisitorCounter();
            throw error;
        })
        .finally(() => {
            visitorCounterState.pendingStats = null;
        });

    return visitorCounterState.pendingStats;
}

async function sendVisitorTrack(action = 'heartbeat') {
    const response = await fetch(VISITOR_TRACK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            visitorId: getPersistentVisitorId(),
            visitId: getCurrentVisitId(),
            action
        }),
        cache: 'no-store'
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !isValidVisitorStats(payload)) {
        throw new Error(payload.error || `request failed with status ${response.status}`);
    }

    visitorCounterState.stats = extractVisitorStats(payload);
    renderVisitorCounter();
    return visitorCounterState.stats;
}

function sendVisitorLeave() {
    if (!visitorCounterState.initialized || visitorCounterState.leaveSent) {
        return;
    }

    visitorCounterState.leaveSent = true;
    if (visitorCounterState.stats && visitorCounterState.stats.onSite > 0) {
        visitorCounterState.stats = {
            ...visitorCounterState.stats,
            onSite: Math.max(0, visitorCounterState.stats.onSite - 1)
        };
        renderVisitorCounter();
    }
    const payload = JSON.stringify({
        visitId: getCurrentVisitId()
    });
    let beaconSent = false;

    try {
        if (navigator.sendBeacon) {
            const body = new Blob([payload], { type: 'application/json' });
            beaconSent = navigator.sendBeacon(VISITOR_LEAVE_API_URL, body);
        }
    } catch (error) {
        console.warn('visitor leave beacon failed', error);
    }

    fetch(VISITOR_LEAVE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: payload,
        keepalive: true
    }).catch(() => null);

    if (!beaconSent && document.visibilityState !== 'hidden') {
        fetchVisitorStats().catch(() => null);
    }
}

function resumeVisitorTracking() {
    if (!visitorCounterState.initialized) {
        return;
    }

    if (document.visibilityState === 'hidden') {
        return;
    }

    visitorCounterState.leaveSent = false;
    sendVisitorTrack('heartbeat').catch(() => {
        fetchVisitorStats().catch(() => null);
    });
}

function handleVisitorVisibilityChange() {
    if (document.visibilityState === 'hidden') {
        sendVisitorLeave();
        return;
    }

    resumeVisitorTracking();
}

function initVisitorTracking() {
    if (!visitorCounterState.initialized) {
        visitorCounterState.initialized = true;
        sendVisitorTrack('visit').catch(() => {
            fetchVisitorStats().catch(() => null);
        });
        visitorCounterState.heartbeatId = window.setInterval(() => {
            sendVisitorTrack('heartbeat').catch(() => {
                fetchVisitorStats().catch(() => null);
            });
        }, VISITOR_HEARTBEAT_MS);
        visitorCounterState.statsPollId = window.setInterval(() => {
            fetchVisitorStats().catch(() => null);
        }, VISITOR_STATS_POLL_MS);
        fetchVisitorStats().catch(() => null);

        document.addEventListener('visibilitychange', handleVisitorVisibilityChange);
        window.addEventListener('pageshow', resumeVisitorTracking);
        window.addEventListener('focus', resumeVisitorTracking);
        window.addEventListener('pagehide', sendVisitorLeave);
        window.addEventListener('beforeunload', sendVisitorLeave);
    } else {
        renderVisitorCounter();
    }
}

async function visitors_command() {
    try {
        initVisitorTracking();
        const stats = visitorCounterState.stats || await fetchVisitorStats();
        fetchVisitorStats().catch(() => null);
        return [{ type: 'visitor-widget', stats }];
    } catch (error) {
        return [
            { type: 'visitor-widget' },
            'visitors: unable to retrieve the live visitor stats right now'
        ];
    }
}

function projects_command() {
    window.open('projects.html', '_self');
    return [];
}

window.renderTerminalLineContent = renderTerminalLineContent;
window.renderTerminalEditorialLineContent = renderTerminalEditorialLineContent;
window.buildVisitorWidgetElement = buildVisitorWidgetElement;
window.canCurrentUserManageBlogEntries = canCurrentUserManageBlogEntries;
window.isSafeBlogImageDataUrl = isSafeBlogImageDataUrl;
window.isSafeBlogImageSource = isSafeBlogImageSource;
window.deleteBlogEntryByTimestamp = deleteBlogEntryByTimestamp;
window.deleteBlogImageByBlockIndex = deleteBlogImageByBlockIndex;
window.deleteBlogTextBlockByContext = deleteBlogTextBlockByContext;
window.ensureTerminalSessionReady = ensureTerminalSessionReady;
window.getTerminalPromptSnapshot = getTerminalPromptSnapshot;
window.getTerminalSessionState = () => terminalSessionState;
window.getCurrentVisitorStats = getCurrentVisitorStats;
window.normalizeTerminalTextFilename = normalizeTextFilename;
window.setTerminalSessionState = setTerminalSessionState;
window.refreshTerminalSessionUi = refreshTerminalSessionUi;

function resume_command() {
    window.open('resume.pdf?v=20260413a', '_blank');
    return [];
}

function pwd_command() {
    return [getTerminalSessionPwd()];
}

function whoami_command() {
    return [getTerminalSessionUsername()];
}

function youtube_command() {
    window.open('https://www.youtube.com/channel/UCYOKNvGyqvRPnDnvmbE-1Xw', '_blank');
    return [];
}
