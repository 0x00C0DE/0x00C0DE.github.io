const TEXT_FILES = Object.freeze([
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
const ASTROLOGY_FORTUNE_URL = 'https://www.astrology.com/compatibility/fortune-cookie.html';
const ASTROLOGY_FORTUNE_PROXY_URL = `https://api.allorigins.win/raw?url=${encodeURIComponent(ASTROLOGY_FORTUNE_URL)}`;

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
        '  fortune     - Display a live fortune from astrology.com',
        '  github      - Open GitHub in a new tab',
        '  help        - Show this help message',
        '  history     - Show command history',
        '  linkedin    - Open LinkedIn in a new tab',
        '  ls          - List directory contents',
        '  movie w h   - Show a movie of size w x h (press any key to stop)',
        '  picture w h - Display an ASCII picture at size w x h',
        '  pwd         - Print working directory',
        '  resume      - Open my resume PDF in a new tab',
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

function date_command() {
    return [new Date().toString()];
}

function echo_command(args) {
    return [args.join(' ')];
}

function parseAstrologyFortunes(source) {
    const match = source.match(/const\s+FORTUNE_COOKIE_RESP\s*=\s*(\[[\s\S]*?\]);/);
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
    try {
        const response = await fetch(ASTROLOGY_FORTUNE_PROXY_URL, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`request failed with status ${response.status}`);
        }
        const html = await response.text();
        const fortunes = parseAstrologyFortunes(html);
        return [fortunes[Math.floor(Math.random() * fortunes.length)]];
    } catch (error) {
        console.error('fortune fetch failed', error);
        return ['fortune: unable to retrieve astrology.com fortune right now'];
    }
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
    return ['linkedin: profile not configured'];
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
    const canvas = document.getElementById('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const img = new Image();
    img.src = normalizeImgurImage('https://imgur.com/KHiJtUI');
    img.setAttribute('crossOrigin', 'anonymous');
    await img.decode();
    context.drawImage(img, 0, 0, width, height);
    return processImage(context, width, height);
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
    return ['/home/0x00c0de/pub'];
}

function whoami_command() {
    return ['guest'];
}

function youtube_command() {
    window.open('https://www.youtube.com/channel/UCYOKNvGyqvRPnDnvmbE-1Xw', '_blank');
    return [];
}
