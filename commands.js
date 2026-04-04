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
const BLOG_STAGE_IMAGE_API_URL = window.BLOG_STAGE_IMAGE_API_URL || 'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/blog/upload-chunk';
const BLOG_DELETE_IMAGE_API_URL = window.BLOG_DELETE_IMAGE_API_URL || 'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/blog/delete-image';
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
const BLOG_MAX_IMAGE_ATTACHMENTS = 4;
const BLOG_SUPPORTED_POST_MEDIA_TYPES_LABEL = 'png/jpg/jpeg/webp/gif/mp4';
const BLOG_ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
const BLOG_ALLOWED_POST_MEDIA_MIME_TYPES = new Set([...BLOG_ALLOWED_IMAGE_MIME_TYPES, 'video/mp4']);
const BLOG_ALLOWED_HOSTED_MEDIA_MIME_TYPES = new Set(['image/gif', 'video/mp4']);
const BLOG_IMAGE_FILE_ACCEPT = 'image/*';
const BLOG_POST_FILE_ACCEPT = 'image/*,video/mp4';
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

let terminalPretextReadyPromise = null;
const TERMINAL_PRETEXT_RUNTIME_MODULE_URL = './terminal-pretext-runtime.mjs?v=20260404a';

function ensureTerminalPretextReady() {
    if (terminalPretextReadyPromise) {
        return terminalPretextReadyPromise;
    }

    terminalPretextReadyPromise = import(TERMINAL_PRETEXT_RUNTIME_MODULE_URL)
        .then(module => {
            window.renderTerminalEditorialTextWithPretext = module.renderTerminalEditorialTextWithPretext;
            window.renderTerminalTextWithPretext = module.renderTerminalTextWithPretext;
            window.rerenderTerminalPretextContainer = module.rerenderTerminalPretextContainer;
            return module;
        })
        .catch(error => {
            console.error('terminal pretext failed to load', error);
            return null;
        });

    return terminalPretextReadyPromise;
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
        ['movie [w h]', 'Display your live camera footage as ASCII art at size w x h (press any key to stop)'],
        ['picture [w h]', 'Display 0x00C0DE\'s picture as ASCII art at size w x h'],
        ['pretext [lab] [text]', 'Show terminal Pretext status or open the layout lab'],
        ['post <text>', 'Append a blog entry through the backend API (may take a short time to appear)'],
        ['post --image [text]', `Append a blog entry with a selected image or mp4 (${BLOG_SUPPORTED_POST_MEDIA_TYPES_LABEL})`],
        ['post hello [image] goodbye', `Insert a selected image or mp4 between text blocks (${BLOG_SUPPORTED_POST_MEDIA_TYPES_LABEL})`],
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

async function selectUserImageFiles(options = {}) {
    const input = document.getElementById('user-image-input');
    if (!input) {
        throw new Error('user image input not found');
    }

    const exactCount = Number.isInteger(options.exactCount) && options.exactCount > 0
        ? options.exactCount
        : null;
    const allowMultiple = Boolean(options.multiple || (exactCount && exactCount > 1));

    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }

    input.value = '';
    input.removeAttribute('capture');
    input.setAttribute('accept', typeof options.accept === 'string' && options.accept.trim()
        ? options.accept.trim()
        : BLOG_IMAGE_FILE_ACCEPT);
    input.multiple = allowMultiple;

    return new Promise(resolve => {
        let settled = false;

        const finish = files => {
            if (settled) {
                return;
            }
            settled = true;
            input.removeEventListener('change', handleChange);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            input.multiple = false;
            resolve(Array.isArray(files) ? files : []);
        };

        const resolveSelectedFiles = () => {
            const files = input.files ? Array.from(input.files).filter(Boolean) : [];
            if (exactCount && files.length !== exactCount) {
                finish(files);
                return;
            }

            finish(files);
        };

        const handleChange = () => {
            resolveSelectedFiles();
        };

        const handleFocus = () => {
            setTimeout(() => {
                if (!settled) {
                    resolveSelectedFiles();
                }
            }, 400);
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                setTimeout(() => {
                    if (!settled) {
                        resolveSelectedFiles();
                    }
                }, 400);
            }
        };

        input.addEventListener('change', handleChange, { once: true });
        window.addEventListener('focus', handleFocus, { once: true });
        document.addEventListener('visibilitychange', handleVisibilityChange);
        input.click();
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

async function decodeSelectedImage(file) {
    const dataUrl = await readFileAsDataUrl(file);
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

function getDataUrlMimeType(dataUrl) {
    const match = BLOG_IMAGE_DATA_URL_PATTERN.exec(dataUrl || '');
    return match ? match[1].toLowerCase() : '';
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

function createBlogImageKey(dataUrl) {
    const normalizedValue = normalizeBlogImageDataUrl(dataUrl) || String(dataUrl || '').trim();
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

    return BLOG_ALLOWED_IMAGE_MIME_TYPES.has(match[1].toLowerCase());
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

    const dataUrl = await readFileAsDataUrl(file);
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

async function selectPostMediaAttachments(requiredCount = 1) {
    const normalizedCount = Number.isInteger(requiredCount) && requiredCount > 0
        ? requiredCount
        : 1;
    const attachments = [];
    for (let index = 0; index < normalizedCount; index += 1) {
        const file = await selectUserImageFile({
            accept: BLOG_POST_FILE_ACCEPT
        });
        if (!file) {
            if (attachments.length === 0) {
                return { error: 'post: no media selected' };
            }

            return {
                error: `post: upload cancelled; expected ${normalizedCount} media item${normalizedCount === 1 ? '' : 's'} but received ${attachments.length}`
            };
        }

        const attachment = await buildPostMediaAttachmentFromFile(file);
        if (attachment.error) {
            return attachment;
        }
        attachments.push(attachment);

        if (index < normalizedCount - 1) {
            await new Promise(resolve => window.setTimeout(resolve, 0));
        }
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

async function movie_command(args) {
    return showMovie(args);
}

async function picture_command(args) {
    const width = args[0] ? parseInt(args[0], 10) : 100;
    const height = args[1] ? parseInt(args[1], 10) : 90;
    const img = new Image();
    img.src = normalizeImgurImage('https://imgur.com/KHiJtUI');
    img.setAttribute('crossOrigin', 'anonymous');
    await img.decode();
    return renderImageToAscii(img, width, height);
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
                'post: missing blog text',
                'usage: post Your blog entry goes here',
                '       post --image Optional caption text',
                '       post hello [image] goodbye',
                `       media types: ${BLOG_SUPPORTED_POST_MEDIA_TYPES_LABEL}`
            ];
        }

    try {
        const templateBlocks = parsePostTemplateBlocks(text, includeImage);
        const resolved = await resolvePostContentBlocks(templateBlocks);
        if (resolved.error) {
            return [resolved.error];
        }

        const response = await fetch(BLOG_POST_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contentBlocks: resolved.contentBlocks
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
    if (!file) {
        return ['userpic: no image selected'];
    }
    if (!file.type.startsWith('image/')) {
        return ['userpic: selected file is not an image'];
    }

    try {
        const image = await decodeSelectedImage(file);
        const asciiLines = await renderImageToAscii(image, width, height);
        showAsciiStill(asciiLines, {
            title: 'userpic',
            hint: 'drag to pan, pinch to zoom, save to download the ascii image',
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
    if (!elements.length) {
        return;
    }

    const currentStats = getCurrentVisitorStats();
    elements.forEach(element => {
        element.querySelectorAll('[data-visitor-field]').forEach(field => {
            const fieldName = field.getAttribute('data-visitor-field');
            field.replaceChildren(createVisitorDigitsFragment(currentStats[fieldName]));
        });
    });
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
window.ensureTerminalPretextReady = ensureTerminalPretextReady;
window.ensureTerminalSessionReady = ensureTerminalSessionReady;
window.getTerminalPromptSnapshot = getTerminalPromptSnapshot;
window.getTerminalSessionState = () => terminalSessionState;
window.setTerminalSessionState = setTerminalSessionState;
window.refreshTerminalSessionUi = refreshTerminalSessionUi;

function resume_command() {
    window.open('resume.pdf', '_blank');
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
