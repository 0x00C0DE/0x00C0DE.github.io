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
        "Use cat PROJECTS.txt to browse pinned work, or type help for the full command list."
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
        '  fortune     - Display a random fortune',
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

function cat_command(args) {
    if (!args[0]) {
        return ['cat: Missing file operand'];
    }
    const filename = args[0].toUpperCase();
    if (fileContents[filename]) {
        return fileContents[filename];
    }
    return [`cat: ${args[0]}: No such file or directory`];
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

function fortune_command() {
    const fortunes = [
        'Talk is cheap. Show me the code.',
        'The best way to predict the future is to invent it.',
        'I would tell you a joke about UDP, but you might not get it.',
        'Good software, like wine, takes time.',
        'There are only two hard things in Computer Science: cache invalidation and naming things.',
        'A bug is never just a bug. It is always a clue.'
    ];
    return [fortunes[Math.floor(Math.random() * fortunes.length)]];
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
    return ['README.txt  PROJECTS.txt  LINKS.txt  QR-TOTP.txt  PROPRTS.txt  AMR.txt  SHELLCODE.txt  SMALLSH.txt  BLOOM.txt'];
}

async function movie_command(args) {
    return showMovie(args);
}

async function picture_command(args) {
    const width = args[0] ? parseInt(args[0], 10) : 25;
    const height = args[1] ? parseInt(args[1], 10) : 23;
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
