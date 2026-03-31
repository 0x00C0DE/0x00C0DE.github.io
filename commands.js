const fileContents = {
    "README.txt": [
        "About me",
        "--------",
        "I am Braden, a software developer and Oregon State University Computer Science graduate.",
        "My work centers on Python, systems programming, security-adjacent tooling, and practical project building.",
        " ",
        "About this website",
        "------------------",
        "This website mimics an old unix terminal, following the interaction style of yangeorget.net.",
        "Use cat PROJECTS.txt to browse pinned work, or type help for the full command list.",
        "The fortune command pulls live fortune-cookie messages."
    ],
    "PROJECTS.txt": [
        "Pinned projects",
        "---------------",
        '<a href="project-proprts.html">PROPR Nearest Neighbor Crypto Trading System</a>  - Python, trading automation, neural-network workflows',
        '<a href="project-qr-totp.html">Secure QR-TOTP Authenticator</a>              - Python, QR provisioning, TOTP validation',
        '<a href="project-collision-avoidance.html">Autonomous Mobile Robot Collision Avoidance</a> - Python, robotics, vision',
        '<a href="project-shellcode-template.html">Shellcode Development Template</a>          - C, security, low-level experimentation',
        '<a href="project-smallsh.html">Unix Small Shell Implementation</a>            - C, Unix process management',
        '<a href="project-bloom-filters.html">Bloom Filter Password Screening</a>          - Python, algorithms, membership testing'
    ],
    "LINKS.txt": [
        "External links",
        "--------------",
        'GitHub    : <a href="https://github.com/0x00C0DE" target="_blank">https://github.com/0x00C0DE</a>',
        'Instagram : <a href="https://www.instagram.com/smallmediumpizza/" target="_blank">https://www.instagram.com/smallmediumpizza/</a>',
        'YouTube   : <a href="https://www.youtube.com/channel/UCYOKNvGyqvRPnDnvmbE-1Xw" target="_blank">https://www.youtube.com/channel/UCYOKNvGyqvRPnDnvmbE-1Xw</a>'
    ],
    "QR-TOTP.txt": [
        "Secure QR-TOTP Authenticator",
        "-----------------------------",
        "Python QR provisioning and time-based one-time password validation.",
        'Project page : <a href="project-qr-totp.html">project-qr-totp.html</a>',
        'Repository   : <a href="https://github.com/0x00C0DE/cs370-proj4-qr-totp" target="_blank">github.com/0x00C0DE/cs370-proj4-qr-totp</a>'
    ],
    "PROPRTS.txt": [
        "PROPR Nearest Neighbor Crypto Trading System",
        "--------------------------------------------",
        "Neural-network-powered crypto trading system focused on automation, execution workflows, and modular Python architecture.",
        'Project page : <a href="project-proprts.html">project-proprts.html</a>',
        'Repository   : <a href="https://github.com/0x00C0DE/PROPR-nn-crypto-trading-system" target="_blank">github.com/0x00C0DE/PROPR-nn-crypto-trading-system</a>'
    ],
    "AMR.txt": [
        "Autonomous Mobile Robot Collision Avoidance",
        "-------------------------------------------",
        "Vision and obstacle-detection tooling for safer robot navigation.",
        'Project page : <a href="project-collision-avoidance.html">project-collision-avoidance.html</a>',
        'Repository   : <a href="https://github.com/jwright303/Collision-Avoidance-For-Autonomous-Mobile-Robots" target="_blank">github.com/jwright303/Collision-Avoidance-For-Autonomous-Mobile-Robots</a>'
    ],
    "SHELLCODE.txt": [
        "Shellcode Development Template",
        "------------------------------",
        "Security-oriented starter framework for shellcode experimentation and low-level testing.",
        'Project page : <a href="project-shellcode-template.html">project-shellcode-template.html</a>',
        'Repository   : <a href="https://github.com/0x00C0DE/shellcode-template" target="_blank">github.com/0x00C0DE/shellcode-template</a>'
    ],
    "SMALLSH.txt": [
        "Unix Small Shell Implementation",
        "-------------------------------",
        "Compact Unix shell demonstrating process control and systems programming fundamentals.",
        'Project page : <a href="project-smallsh.html">project-smallsh.html</a>',
        'Repository   : <a href="https://github.com/0x00C0DE/CS344-assign3" target="_blank">github.com/0x00C0DE/CS344-assign3</a>'
    ],
    "BLOOM.txt": [
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
const VISITOR_HEARTBEAT_MS = 20000;
const TEXT_FILES = Object.freeze([
    'BLOG.txt',
    'README.txt',
    'PROJECTS.txt',
    'LINKS.txt',
    'QR-TOTP.txt',
    'PROPRTS.txt',
    'AMR.txt',
    'SHELLCODE.txt',
    'SMALLSH.txt',
    'BLOOM.txt'
]);

const TEXT_FILE_LOOKUP = new Map(TEXT_FILES.map(filename => [filename.toUpperCase(), filename]));
const visitorCounterState = {
    visitorId: null,
    visitId: null,
    stats: null,
    initialized: false,
    heartbeatId: null,
    pendingStats: null,
    leaveSent: false
};

function escapeHtml(text) {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function normalizeTextFilename(input) {
    const trimmed = input.trim();
    if (!trimmed) {
        return null;
    }
    const candidate = trimmed.toUpperCase().endsWith('.TXT') ? trimmed : `${trimmed}.txt`;
    return TEXT_FILE_LOOKUP.get(candidate.toUpperCase()) || null;
}

function linkifyTextLine(line) {
    if (!line) {
        return '&nbsp;';
    }

    let html = escapeHtml(line);

    html = html.replace(/\bhttps?:\/\/[^\s<]+/g, url => `<a href="${url}" target="_blank" rel="noreferrer">${url}</a>`);
    html = html.replace(/\b(project-[a-z0-9-]+\.html|projects\.html|resume\.pdf)\b/gi, match => {
        const attributes = match.toLowerCase().endsWith('.pdf') ? ' target="_blank" rel="noreferrer"' : '';
        return `<a href="${match}"${attributes}>${match}</a>`;
    });
    html = html.replace(/\b([A-Z0-9-]+\.txt)\b/g, match => {
        const normalized = TEXT_FILE_LOOKUP.get(match.toUpperCase());
        if (!normalized) {
            return match;
        }
        return `<a href="?command=${encodeURIComponent(`cat ${normalized}`)}">${normalized}</a>`;
    });

    return html;
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
    return lines.map(linkifyTextLine);
}

function banner_command() {
    setTimeout(() => {
        initVisitorTracking();
        renderVisitorCounter();
    }, 0);
    return [
        ' ',
        '<div class="banner-art">0x00C0DE</div>',
        buildVisitorWidgetMarkup(),
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
    if (url.includes('i.imgur.com/')) {
        return url;
    }
    const match = url.match(/imgur\.com\/([^./?#]+)/i);
    if (!match) {
        return url;
    }
    return `https://i.imgur.com/${match[1]}.jpg`;
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
            output.push(`post: <a href="${payload.commitUrl}" target="_blank" rel="noreferrer">view commit</a>`);
        }
        return output;
    } catch (error) {
        console.error('post failed', error);
        return ['post: backend unavailable right now'];
    }
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
    const digits = String(safeValue).padStart(width, '0');
    const firstNonZeroIndex = digits.search(/[1-9]/);
    const zeroCutoff = firstNonZeroIndex === -1 ? digits.length - 1 : firstNonZeroIndex;

    return digits
        .split('')
        .map((digit, index) => {
            const className = digit === '0' && index < zeroCutoff ? 'visitor-digit visitor-digit-dim' : 'visitor-digit';
            return `<span class="${className}">${digit}</span>`;
        })
        .join('');
}

function buildVisitorWidgetMarkup(stats = null) {
    const currentStats = stats || getCurrentVisitorStats();
    return `
        <div class="visitor-widget" data-visitor-counter>
            <div class="visitor-widget-row">
                <span class="visitor-label">Visits:</span>
                <span class="visitor-value" data-visitor-field="visits">${formatVisitorDigits(currentStats.visits)}</span>
            </div>
            <div class="visitor-widget-row">
                <span class="visitor-label">Uniq. Visitors:</span>
                <span class="visitor-value" data-visitor-field="uniqueVisitors">${formatVisitorDigits(currentStats.uniqueVisitors)}</span>
            </div>
            <div class="visitor-widget-row">
                <span class="visitor-label">On-site:</span>
                <span class="visitor-value" data-visitor-field="onSite">${formatVisitorDigits(currentStats.onSite)}</span>
            </div>
        </div>
    `.trim();
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
            field.innerHTML = formatVisitorDigits(currentStats[fieldName]);
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
    const payload = JSON.stringify({
        visitId: getCurrentVisitId()
    });

    try {
        if (navigator.sendBeacon) {
            const body = new Blob([payload], { type: 'application/json' });
            navigator.sendBeacon(VISITOR_LEAVE_API_URL, body);
            return;
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

        window.addEventListener('pagehide', sendVisitorLeave, { once: true });
        window.addEventListener('beforeunload', sendVisitorLeave, { once: true });
    } else {
        renderVisitorCounter();
    }
}

async function visitors_command() {
    try {
        initVisitorTracking();
        const stats = await fetchVisitorStats();
        return [buildVisitorWidgetMarkup(stats)];
    } catch (error) {
        return ['visitors: unable to retrieve the live visitor stats right now'];
    }
}

function projects_command() {
    window.open('projects.html', '_self');
    return [];
}

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
