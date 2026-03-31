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
const BLOG_MAX_POST_LENGTH = 500;
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
    return [
        ' ',
        '<div class="banner-art">0x00C0DE</div>',
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

async function renderImageToAscii(imageSource, width, height) {
    const context = getAsciiCanvasContext(width, height);
    context.drawImage(imageSource, 0, 0, width, height);
    return processImage(context, width, height);
}

async function selectUserImageFile() {
    const input = document.getElementById('user-image-input');
    if (!input) {
        throw new Error('user image input not found');
    }

    input.value = '';

    return new Promise(resolve => {
        let settled = false;

        const finish = file => {
            if (settled) {
                return;
            }
            settled = true;
            input.removeEventListener('change', handleChange);
            window.removeEventListener('focus', handleFocus);
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

        input.addEventListener('change', handleChange, { once: true });
        window.addEventListener('focus', handleFocus, { once: true });
        input.click();
    });
}

async function decodeSelectedImage(file) {
    const objectUrl = URL.createObjectURL(file);

    try {
        const image = new Image();
        image.src = objectUrl;
        await image.decode();
        return image;
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
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
    const width = args[0] ? parseInt(args[0], 10) : 100;
    const height = args[1] ? parseInt(args[1], 10) : 90;

    const file = await selectUserImageFile();
    if (!file) {
        return ['userpic: no image selected'];
    }

    try {
        const image = await decodeSelectedImage(file);
        return await renderImageToAscii(image, width, height);
    } catch (error) {
        console.error('userpic failed', error);
        return ['userpic: unable to process selected image'];
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
    return ['/home/0x00C0DE/Unk0wn'];
}

function whoami_command() {
    return ['guest'];
}

function youtube_command() {
    window.open('https://www.youtube.com/channel/UCYOKNvGyqvRPnDnvmbE-1Xw', '_blank');
    return [];
}
