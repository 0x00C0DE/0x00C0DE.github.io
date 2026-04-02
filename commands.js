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
const VISITOR_COUNT_API_URL = window.VISITOR_COUNT_API_URL || 'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors';
const VISITOR_TRACK_API_URL = window.VISITOR_TRACK_API_URL || 'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/track';
const VISITOR_LEAVE_API_URL = window.VISITOR_LEAVE_API_URL || 'https://0x00c0de-blog-append.0x00c0de.workers.dev/api/visitors/leave';
const BLOG_MAX_POST_LENGTH = 500;
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
const QR_TOTP_STORAGE_KEY = 'qrTotpEnrollmentV1';
const QR_TOTP_MEMORY_KEY = '__qrTotpEnrollmentV1';
const QR_TOTP_BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const QR_TOTP_SECRET_BYTES = 20;
const QR_TOTP_STEP_SECONDS = 30;
const QR_TOTP_CODE_DIGITS = 6;

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

function renderTerminalLineContent(container, line) {
    const text = typeof line === 'string' ? line : String(line ?? '');
    if (!text) {
        container.append(document.createTextNode('\u00A0'));
        return;
    }

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
    return lines;
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

function help_command() {
    return [
        'Available commands:',
        '  cat         - Display file contents',
        '  clear       - Clear the terminal screen',
        '  date        - Display current date and time',
        '  echo        - Display text',
        '  fortune     - Display a live fortune',
        '  github      - Open GitHub in a new tab',
        '  help        - Show this help message',
        '  history     - Show command history',
        '  linkedin    - Open LinkedIn in a new tab',
        '  ls          - List directory contents',
        '  movie w h   - Display your live camera footage as ASCII art at size w x h (press any key to stop)',
        '  picture w h - Display 0x00C0DE\'s picture as ASCII art at size w x h',
        '  post text   - Append a blog entry through the backend API (may take a short time to appear)',
        '  pwd         - Print working directory',
        '  qr-totp     - Browser QR enrollment + TOTP generator for the cs370 project',
        '  resume      - Open my resume PDF in a new tab',
        '  userpic w h - Upload or take your own picture and display it as ASCII art',
        '  visitors    - Display the live visitor stats widget',
        '  whoami      - Print current username',
        '  instagram   - Open Instagram in a new tab',
        '  projects    - Open the projects terminal page',
        '  youtube     - Open YouTube in a new tab'
    ];
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

async function selectUserImageFile() {
    const input = document.getElementById('user-image-input');
    if (!input) {
        throw new Error('user image input not found');
    }

    if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
    }

    input.value = '';
    input.removeAttribute('capture');

    return new Promise(resolve => {
        let settled = false;

        const finish = file => {
            if (settled) {
                return;
            }
            settled = true;
            input.removeEventListener('change', handleChange);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            resolve(file || null);
        };

        const handleChange = () => {
            finish(input.files && input.files[0] ? input.files[0] : null);
        };

        const handleFocus = () => {
            setTimeout(() => {
                if (!settled) {
                    finish(input.files && input.files[0] ? input.files[0] : null);
                }
            }, 400);
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                setTimeout(() => {
                    if (!settled) {
                        finish(input.files && input.files[0] ? input.files[0] : null);
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

function buildAsciiDownloadFilename(file) {
    const baseName = (file && file.name ? file.name : 'userpic')
        .replace(/\.[^.]+$/, '')
        .replace(/[^a-z0-9-_]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
    return `${baseName || 'userpic'}-ascii.png`;
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

async function post_command(args) {
    const text = args.join(' ').trim();
    if (!text) {
        return [
            'post: missing blog text',
            'usage: post Your blog entry goes here'
        ];
    }

    if (text.length > BLOG_MAX_POST_LENGTH) {
        return [`post: message exceeds ${BLOG_MAX_POST_LENGTH} characters`];
    }

    try {
        const response = await fetch(BLOG_POST_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            return [`post: ${payload.error || 'unable to append entry right now'}`];
        }

        const output = ['post: blog entry appended successfully'];
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
        return ['post: backend unavailable right now'];
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
    try {
        const stored = window.localStorage.getItem(QR_TOTP_STORAGE_KEY);
        if (stored) {
            const parsed = validateQrTotpEnrollment(JSON.parse(stored));
            if (parsed) {
                return parsed;
            }
        }
    } catch (error) {
        console.warn('unable to load qr-totp enrollment from localStorage', error);
    }

    return validateQrTotpEnrollment(window[QR_TOTP_MEMORY_KEY]) || null;
}

function saveQrTotpEnrollment(enrollment) {
    const normalized = validateQrTotpEnrollment(enrollment);
    if (!normalized) {
        throw new Error('invalid enrollment payload');
    }

    window[QR_TOTP_MEMORY_KEY] = normalized;
    try {
        window.localStorage.setItem(QR_TOTP_STORAGE_KEY, JSON.stringify(normalized));
        return 'localStorage';
    } catch (error) {
        console.warn('unable to persist qr-totp enrollment to localStorage', error);
        return 'memory';
    }
}

function clearQrTotpEnrollment() {
    delete window[QR_TOTP_MEMORY_KEY];
    try {
        window.localStorage.removeItem(QR_TOTP_STORAGE_KEY);
    } catch (error) {
        console.warn('unable to clear qr-totp enrollment from localStorage', error);
    }
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
        ? 'saved for this tab only'
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
        window.open(qrUrl, '_blank');
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
window.buildVisitorWidgetElement = buildVisitorWidgetElement;

function resume_command() {
    window.open('resume.pdf', '_blank');
    return [];
}

function pwd_command() {
    return ['/home/0x00C0DE/Unkn0wn'];
}

function whoami_command() {
    return ['guest'];
}

function youtube_command() {
    window.open('https://www.youtube.com/channel/UCYOKNvGyqvRPnDnvmbE-1Xw', '_blank');
    return [];
}
