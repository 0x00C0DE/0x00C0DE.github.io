const PROMPT_USER = "guest";
const PROMPT_HOST = "localhost";
const PROMPT_PATH = "/home/0x00C0DE/Unkn0wn";
const DEFAULT_PROMPT_SNAPSHOT = Object.freeze({
    host: 'localhost',
    isRoot: false,
    mode: 'default',
    path: PROMPT_PATH,
    promptSymbol: '$',
    theme: 'default',
    user: PROMPT_USER
});

let commandHistory = [];
let historyIndex = -1;

const commandHandlers = new Map([
    ['help', help_command],
    ['banner', banner_command],
    ['cat', cat_command],
    ['date', date_command],
    ['echo', echo_command],
    ['fortune', fortune_command],
    ['github', github_command],
    ['history', history_command],
    ['instagram', instagram_command],
    ['linkedin', linkedin_command],
    ['ls', ls_command],
    ['movie', movie_command],
    ['picture', picture_command],
    ['pretext', pretext_command],
    ['post', post_command],
    ['projects', projects_command],
    ['pwd', pwd_command],
    ['qr-totp', qr_totp_command],
    ['resume', resume_command],
    ['su', su_command],
    ['userpic', userpic_command],
    ['visitors', visitors_command],
    ['whoami', whoami_command],
    ['youtube', youtube_command]
]);

function getPromptSnapshot() {
    if (typeof window.getTerminalPromptSnapshot === 'function') {
        return window.getTerminalPromptSnapshot();
    }

    return DEFAULT_PROMPT_SNAPSHOT;
}

function appendPrompt(container, beforeNode = null) {
    const snapshot = getPromptSnapshot();
    const prompt = document.createElement('span');
    prompt.className = 'terminal-prompt';
    const parts = [
        [getPromptUserClassName(snapshot), snapshot.user],
        ['header', '@'],
        ['prompt-host', snapshot.host],
        ['header', ':'],
        ['prompt-path', snapshot.path],
        ['header', `${snapshot.promptSymbol} `]
    ];

    parts.forEach(([className, text]) => {
        const span = document.createElement('span');
        span.className = className;
        span.textContent = text;
        prompt.append(span);
    });

    if (beforeNode) {
        container.insertBefore(prompt, beforeNode);
    } else {
        container.append(prompt);
    }
    return prompt;
}

function createBinaryRainColumnElement(column) {
    const element = document.createElement('div');
    element.className = 'terminal-binary-column';
    const state = {
        ...column,
        nextMutationAt: 0
    };
    element._binaryRainState = state;
    element.textContent = state.stream || '';
    element.style.left = `${state.leftPercent || 0}%`;
    element.style.animationDuration = `${state.durationMs || 9000}ms`;
    element.style.animationDelay = `${state.delayMs || 0}ms`;
    element.style.fontSize = `${state.fontSizePx || 16}px`;
    element.style.opacity = String(state.opacity || 0.2);
    element.style.setProperty('--binary-blur', `${state.blurPx || 0}px`);
    return element;
}

function renderBinaryRainBackground(layer) {
    if (!layer) {
        return;
    }

    const fragment = document.createDocumentFragment();
    const columns = createBinaryRainColumns({
        height: window.innerHeight,
        width: window.innerWidth
    });

    columns.forEach(column => {
        fragment.append(createBinaryRainColumnElement(column));
    });

    layer.replaceChildren(fragment);
}

function mutateBinaryRainColumns(now = Date.now()) {
    const layer = document.getElementById(BINARY_RAIN_LAYER_ID);
    if (!layer || layer.hidden) {
        return;
    }

    const columns = layer.querySelectorAll('.terminal-binary-column');
    columns.forEach(columnElement => {
        const state = columnElement._binaryRainState;
        if (!state) {
            return;
        }

        if (state.nextMutationAt > now) {
            return;
        }

        const updatedState = advanceBinaryRainColumn(state);
        updatedState.nextMutationAt = now + (updatedState.mutationIntervalMs || 120);
        columnElement._binaryRainState = updatedState;
        columnElement.textContent = updatedState.stream || '';
    });
}

function stopBinaryRainMutationLoop() {
    if (binaryRainMutationIntervalId !== null) {
        window.clearInterval(binaryRainMutationIntervalId);
        binaryRainMutationIntervalId = null;
    }
}

function startBinaryRainMutationLoop() {
    if (binaryRainMutationIntervalId !== null) {
        return;
    }

    binaryRainMutationIntervalId = window.setInterval(() => {
        mutateBinaryRainColumns(Date.now());
    }, 90);
}

function queueBinaryRainBackgroundRefresh() {
    if (binaryRainResizeTimeoutId !== null) {
        window.clearTimeout(binaryRainResizeTimeoutId);
    }

    binaryRainResizeTimeoutId = window.setTimeout(() => {
        if (!shouldUseRootTerminalVisuals(getPromptSnapshot())) {
            binaryRainResizeTimeoutId = null;
            return;
        }
        const layer = document.getElementById(BINARY_RAIN_LAYER_ID);
        renderBinaryRainBackground(layer);
        binaryRainResizeTimeoutId = null;
    }, 160);
}

function ensureBinaryRainBackground() {
    if (!document.body) {
        return null;
    }

    let layer = document.getElementById(BINARY_RAIN_LAYER_ID);
    if (!layer) {
        layer = document.createElement('div');
        layer.id = BINARY_RAIN_LAYER_ID;
        layer.className = 'terminal-binary-rain';
        document.body.prepend(layer);
    }
    layer.hidden = true;

    if (!binaryRainResizeBound) {
        window.addEventListener('resize', queueBinaryRainBackgroundRefresh);
        binaryRainResizeBound = true;
    }

    return layer;
}

function syncBinaryRainVisualState() {
    const snapshot = getPromptSnapshot();
    const enabled = shouldUseRootTerminalVisuals(snapshot);
    const layer = ensureBinaryRainBackground();
    if (!layer) {
        return;
    }

    layer.hidden = !enabled;

    if (!enabled) {
        stopBinaryRainMutationLoop();
        layer.replaceChildren();
        return;
    }

    if (!layer.firstChild) {
        renderBinaryRainBackground(layer);
    }
    mutateBinaryRainColumns(Date.now());
    startBinaryRainMutationLoop();
}

function refreshPrompt(container) {
    if (!container) {
        return null;
    }

    const firstChild = container.firstChild;
    const existingPrompt = container.querySelector(':scope > .terminal-prompt');
    if (existingPrompt) {
        existingPrompt.remove();
    }

    const insertBeforeNode = firstChild && firstChild.isConnected ? firstChild : container.firstChild;
    return appendPrompt(container, insertBeforeNode);
}

function refreshTerminalInputPrompt() {
    const terminal = document.getElementById('terminal');
    const inputLine = terminal ? terminal.querySelector('.input-line') : null;
    if (!inputLine) {
        return null;
    }

    return refreshPrompt(inputLine);
}

let bannerWaveReadyPromise = null;
let bannerWaveModule = null;
let terminalVisualsReadyPromise = null;
let terminalVisualsModule = null;
let binaryRainResizeTimeoutId = null;
let binaryRainResizeBound = false;
let binaryRainMutationIntervalId = null;
const BINARY_RAIN_LAYER_ID = 'terminal-binary-rain';

function fallbackSplitBannerWaveGlyphs(text) {
    const safeText = typeof text === 'string' ? text : String(text ?? '');
    let waveIndex = 0;

    return Array.from(safeText).map(glyph => {
        if (/^\s+$/.test(glyph)) {
            return {
                isAnimated: false,
                text: glyph,
                waveIndex: null
            };
        }

        const output = {
            isAnimated: true,
            text: glyph,
            waveIndex
        };
        waveIndex += 1;
        return output;
    });
}

function fallbackGetPromptUserClassName(snapshot) {
    return snapshot && snapshot.isRoot ? 'prompt-user prompt-user-root' : 'prompt-user';
}

function fallbackShouldUseRootTerminalVisuals(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
        return false;
    }

    return Boolean(snapshot.isRoot) || String(snapshot.user || '').trim().toLowerCase() === 'root';
}

function fallbackCreateBinaryRainColumns(options = {}) {
    const width = Number.isFinite(options.width) ? options.width : 1280;
    const height = Number.isFinite(options.height) ? options.height : 720;
    const columnCount = Math.max(12, Math.min(36, Math.floor(width / 46)));
    const glyphs = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ!?@#$%&*+-=<>[]{}';
    const columns = [];

    for (let index = 0; index < columnCount; index += 1) {
        const streamLength = Math.max(18, Math.floor(height / 18) + 8);
        const digits = [];
        for (let digitIndex = 0; digitIndex < streamLength; digitIndex += 1) {
            digits.push(glyphs.charAt((index + digitIndex) % glyphs.length));
        }
        columns.push({
            blurPx: index % 7 === 0 ? 0.9 : 0,
            cells: digits,
            delayMs: -index * 320,
            durationMs: 7200 + index * 170,
            fontSizePx: 16 + (index % 6) * 2,
            glyphs,
            leftPercent: Math.min(100, (index / columnCount) * 100),
            mutationIntervalMs: 120 + (index % 5) * 18,
            opacity: 0.18 + (index % 5) * 0.06,
            stream: digits.join('\n')
        });
    }

    return columns;
}

function fallbackAdvanceBinaryRainColumn(column) {
    const glyphs = typeof column?.glyphs === 'string' && column.glyphs
        ? column.glyphs
        : '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ!?@#$%&*+-=<>[]{}';
    const cells = Array.isArray(column?.cells)
        ? [...column.cells]
        : String(column?.stream || '')
            .split('\n')
            .filter(entry => entry.length > 0);

    if (cells.length === 0) {
        return {
            ...column,
            cells,
            stream: ''
        };
    }

    const mutationCount = Math.max(1, Math.round(cells.length * 0.14));
    for (let index = 0; index < mutationCount; index += 1) {
        const cellIndex = Math.floor(Math.random() * cells.length);
        const glyphIndex = Math.floor(Math.random() * glyphs.length);
        cells[cellIndex] = glyphs.charAt(glyphIndex);
    }

    return {
        ...column,
        cells,
        stream: cells.join('\n')
    };
}

function splitBannerWaveGlyphs(text) {
    if (bannerWaveModule && typeof bannerWaveModule.splitBannerWaveGlyphs === 'function') {
        return bannerWaveModule.splitBannerWaveGlyphs(text);
    }

    return fallbackSplitBannerWaveGlyphs(text);
}

function getPromptUserClassName(snapshot) {
    if (terminalVisualsModule && typeof terminalVisualsModule.getPromptUserClassName === 'function') {
        return terminalVisualsModule.getPromptUserClassName(snapshot);
    }

    return fallbackGetPromptUserClassName(snapshot);
}

function shouldUseRootTerminalVisuals(snapshot) {
    if (terminalVisualsModule && typeof terminalVisualsModule.shouldUseRootTerminalVisuals === 'function') {
        return terminalVisualsModule.shouldUseRootTerminalVisuals(snapshot);
    }

    return fallbackShouldUseRootTerminalVisuals(snapshot);
}

function createBinaryRainColumns(options = {}) {
    if (terminalVisualsModule && typeof terminalVisualsModule.createBinaryRainColumns === 'function') {
        return terminalVisualsModule.createBinaryRainColumns(options);
    }

    return fallbackCreateBinaryRainColumns(options);
}

function advanceBinaryRainColumn(column) {
    if (terminalVisualsModule && typeof terminalVisualsModule.advanceBinaryRainColumn === 'function') {
        return terminalVisualsModule.advanceBinaryRainColumn(column);
    }

    return fallbackAdvanceBinaryRainColumn(column);
}

function ensureBannerWaveReady() {
    if (bannerWaveReadyPromise) {
        return bannerWaveReadyPromise;
    }

    bannerWaveReadyPromise = import('./banner-wave-core.mjs')
        .then(module => {
            bannerWaveModule = module;
            return module;
        })
        .catch(error => {
            console.error('banner wave failed to load', error);
            return null;
        });

    return bannerWaveReadyPromise;
}

function ensureTerminalVisualsReady() {
    if (terminalVisualsReadyPromise) {
        return terminalVisualsReadyPromise;
    }

    terminalVisualsReadyPromise = import('./terminal-visuals-core.mjs')
        .then(module => {
            terminalVisualsModule = module;
            return module;
        })
        .catch(error => {
            console.error('terminal visuals failed to load', error);
            return null;
        });

    return terminalVisualsReadyPromise;
}

function appendBannerWaveText(container, text, className) {
    const wrapper = document.createElement('div');
    wrapper.className = className;

    splitBannerWaveGlyphs(text).forEach(glyph => {
        const span = document.createElement('span');
        span.className = glyph.isAnimated ? 'banner-wave-glyph' : 'banner-wave-gap';
        span.textContent = glyph.text;
        if (glyph.isAnimated) {
            span.style.setProperty('--wave-index', String(glyph.waveIndex));
        } else {
            span.textContent = '\u00A0';
        }
        wrapper.append(span);
    });

    container.append(wrapper);
    return wrapper;
}

function getSafeHref(href) {
    try {
        const parsed = new URL(href, window.location.href);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.toString();
        }
    } catch {
        // Fall through to a harmless default.
    }

    return '#';
}

function getSafeImageHref(href) {
    const safeHref = getSafeHref(href);
    if (safeHref === '#') {
        return '';
    }

    try {
        const parsed = new URL(safeHref);
        const hostname = parsed.hostname.toLowerCase();
        if (
            parsed.origin === window.location.origin ||
            hostname === 'quickchart.io' ||
            hostname.endsWith('.quickchart.io') ||
            hostname === 'i.imgur.com'
        ) {
            return parsed.toString();
        }
    } catch {
        return '';
    }

    return '';
}

function renderOutputObject(container, line) {
    if (!line || typeof line !== 'object') {
        container.textContent = String(line ?? '');
        return;
    }

    if (typeof line.entryTimestamp === 'string' && line.entryTimestamp) {
        container.dataset.blogEntryTimestamp = line.entryTimestamp;
    }

    if (line.type === 'banner') {
        appendBannerWaveText(container, line.title || '', 'banner-art');

        if (line.subtitle) {
            appendBannerWaveText(container, line.subtitle, 'banner-subtitle');
        }
        return;
    }

    if (line.type === 'visitor-widget' && typeof window.buildVisitorWidgetElement === 'function') {
        container.append(window.buildVisitorWidgetElement(line.stats));
        return;
    }

    if (line.type === 'text-link') {
        if (line.prefix) {
            container.append(document.createTextNode(line.prefix));
        }
        const anchor = document.createElement('a');
        anchor.href = getSafeHref(line.href || '#');
        anchor.textContent = line.text || line.href || '';
        if (line.newTab) {
            anchor.target = '_blank';
            anchor.rel = 'noreferrer';
        }
        container.append(anchor);
        return;
    }

    if (line.type === 'help-entry') {
        const entry = document.createElement('div');
        entry.className = 'terminal-help-entry';

        if (Number.isFinite(line.commandWidth) && line.commandWidth > 0) {
            entry.style.setProperty('--help-command-width', `${Math.round(line.commandWidth)}ch`);
        }

        const command = document.createElement('span');
        command.className = 'terminal-help-command';
        command.textContent = line.command || '';

        const separator = document.createElement('span');
        separator.className = 'terminal-help-separator';
        separator.textContent = '-';

        const description = document.createElement('span');
        description.className = 'terminal-help-description';
        if (typeof window.renderTerminalTextWithPretext === 'function') {
            window.renderTerminalTextWithPretext(description, line.description || '', {
                tokenizeLinks: false
            });
        } else {
            description.textContent = line.description || '';
        }

        entry.append(command, separator, description);
        container.append(entry);
        return;
    }

    if (line.type === 'blog-entry-header') {
        const wrapper = document.createElement('div');
        wrapper.className = 'terminal-blog-entry-header';

        const timestamp = document.createElement('span');
        timestamp.className = 'terminal-blog-entry-timestamp';
        timestamp.textContent = line.text || '';
        wrapper.append(timestamp);

        if (line.deletable && typeof window.deleteBlogEntryByTimestamp === 'function') {
            const actions = document.createElement('div');
            actions.className = 'terminal-inline-image-actions';

            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'terminal-inline-image-delete';
            deleteButton.textContent = 'delete post';

            const status = document.createElement('span');
            status.className = 'terminal-inline-image-status';

            deleteButton.addEventListener('click', async () => {
                const password = window.prompt('Enter delete password');
                if (password === null) {
                    return;
                }

                deleteButton.disabled = true;
                status.textContent = ' deleting...';

                try {
                    const result = await window.deleteBlogEntryByTimestamp(
                        typeof line.entryTimestamp === 'string' ? line.entryTimestamp : '',
                        password
                    );
                    if (!result.ok) {
                        status.textContent = ` ${result.error}`;
                        deleteButton.disabled = false;
                        return;
                    }

                    const matchingLines = [...document.querySelectorAll('.terminal-line[data-blog-entry-timestamp]')]
                        .filter(node => node.dataset.blogEntryTimestamp === line.entryTimestamp);
                    matchingLines.forEach(node => node.remove());
                } catch (error) {
                    status.textContent = ' unable to delete post right now';
                    deleteButton.disabled = false;
                }
            });

            actions.append(deleteButton, status);
            wrapper.append(actions);
        }

        container.append(wrapper);
        return;
    }

    if (line.type === 'blog-entry-text') {
        if (typeof window.renderTerminalLineContent === 'function') {
            window.renderTerminalLineContent(container, line.text || '');
        } else {
            container.textContent = typeof line.text === 'string' ? line.text : '';
        }
        return;
    }

    if (line.type === 'inline-image') {
        const isSafeSource = typeof window.isSafeBlogImageSource === 'function'
            ? window.isSafeBlogImageSource(line.src)
            : false;

        if (!isSafeSource) {
            container.textContent = '[invalid embedded image]';
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'terminal-inline-image-wrapper';

        if (line.deletable && typeof window.deleteBlogImageByBlockIndex === 'function') {
            const actions = document.createElement('div');
            actions.className = 'terminal-inline-image-actions';

            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'terminal-inline-image-delete';
            deleteButton.textContent = 'delete';

            const status = document.createElement('span');
            status.className = 'terminal-inline-image-status';

            deleteButton.addEventListener('click', async () => {
                const password = window.prompt('Enter delete password');
                if (password === null) {
                    return;
                }

                deleteButton.disabled = true;
                status.textContent = ' deleting...';

                try {
                    const result = await window.deleteBlogImageByBlockIndex(
                        line.imageBlockIndex,
                        password,
                        typeof line.imageKey === 'string' ? line.imageKey : '',
                        typeof line.src === 'string' ? line.src : '',
                        typeof line.entryTimestamp === 'string' ? line.entryTimestamp : '',
                        Number.isInteger(line.entryImageIndex) ? line.entryImageIndex : null,
                        typeof line.previousTextLine === 'string' ? line.previousTextLine : '',
                        typeof line.nextTextLine === 'string' ? line.nextTextLine : ''
                    );
                    if (!result.ok) {
                        status.textContent = ` ${result.error}`;
                        deleteButton.disabled = false;
                        return;
                    }

                    status.textContent = ' deleted';
                    deleteButton.remove();
                    image.remove();
                } catch (error) {
                    status.textContent = ' unable to delete image right now';
                    deleteButton.disabled = false;
                }
            });

            actions.append(deleteButton, status);
            wrapper.append(actions);
        }

        const image = document.createElement('img');
        image.className = 'terminal-inline-image';
        image.src = line.src;
        image.alt = line.alt || 'Embedded blog image';
        image.decoding = 'async';
        image.loading = 'lazy';
        wrapper.append(image);
        container.append(wrapper);
        return;
    }

    container.textContent = typeof line.text === 'string' ? line.text : String(line ?? '');
}

function renderOutputLine(container, line) {
    if (line && typeof line === 'object') {
        renderOutputObject(container, line);
        return;
    }

    if (typeof window.renderTerminalLineContent === 'function') {
        window.renderTerminalLineContent(container, line);
        return;
    }

    container.textContent = String(line ?? '');
}

function renderCommandEchoText(container, text) {
    const safeText = typeof text === 'string' ? text : String(text ?? '');
    if (!safeText) {
        container.textContent = '';
        return;
    }

    if (typeof window.renderTerminalTextWithPretext === 'function') {
        const handled = window.renderTerminalTextWithPretext(container, safeText, {
            tokenizeLinks: false,
            whiteSpace: 'pre'
        });
        if (handled) {
            return;
        }
    }

    container.textContent = safeText;
}

function renderAsciiLines(element, asciiLines) {
    const lines = Array.isArray(asciiLines) ? asciiLines : [];
    element.textContent = lines.join('\n');
}

function createAsciiViewerShell(options = {}) {
    const viewer = document.createElement('div');
    viewer.className = 'ascii-viewer';

    const toolbar = document.createElement('div');
    toolbar.className = 'ascii-toolbar';

    const title = document.createElement('span');
    title.className = 'ascii-title';
    title.textContent = options.title || 'ascii viewer';

    const actions = document.createElement('div');
    actions.className = 'ascii-actions';

    let saveButton = null;
    if (options.download) {
        saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.className = 'ascii-save';
        saveButton.id = 'ascii-save-button';
        saveButton.textContent = options.download.label || 'save';
        actions.append(saveButton);
    }

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'ascii-close';
    closeButton.id = 'ascii-close-button';
    closeButton.textContent = 'close';
    actions.append(closeButton);

    toolbar.append(title, actions);

    const hint = document.createElement('div');
    hint.className = 'ascii-hint';
    hint.textContent = options.hint || 'drag to pan, pinch to zoom';

    const scrollRegion = document.createElement('div');
    scrollRegion.className = 'ascii-scroll';
    scrollRegion.id = 'ascii-scroll-region';

    const asciiArt = document.createElement('div');
    asciiArt.id = 'asciiArt';
    scrollRegion.append(asciiArt);

    viewer.append(toolbar, hint, scrollRegion);

    return {
        viewer,
        asciiArt,
        scrollRegion,
        closeButton,
        saveButton
    };
}

function setupTerminal() {
    const terminal = document.getElementById("terminal");
    terminal.classList.remove("viewer-mode");
    terminal.innerHTML = '';
    const inputLine = document.createElement('div');
    inputLine.className = 'input-line';
    appendPrompt(inputLine);
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'terminal-input';
    input.id = 'command-input';
    input.autocomplete = 'off';
    inputLine.append(input);
    terminal.append(inputLine);
    terminal.scrollTop = 0;
    terminal.scrollLeft = 0;
    input.addEventListener("keydown", handleKeyDown);
    input.focus();
}

async function showMovie(args) {
    const width = args[0] ? args[0] : 160;
    const height = args[1] ? args[1] : 80;
    const terminal = document.getElementById("terminal");
    terminal.classList.add("viewer-mode");
    terminal.scrollTop = 0;
    terminal.scrollLeft = 0;
    terminal.replaceChildren();
    const viewer = createAsciiViewerShell({
        title: 'movie',
        hint: 'live camera ascii art, drag to pan, pinch to zoom'
    });
    const videoFeed = document.createElement('video');
    videoFeed.id = 'videoFeed';
    videoFeed.autoplay = true;
    videoFeed.playsInline = true;
    videoFeed.style.display = 'none';
    viewer.viewer.append(videoFeed);
    terminal.append(viewer.viewer);
    const canvas = document.getElementById("canvas");
    canvas.width = width;
    canvas.height = height;
    const asciiArtDiv = viewer.asciiArt;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    videoFeed.srcObject = stream;
    const intervalId = setInterval(function () {
        if (videoFeed.readyState === videoFeed.HAVE_ENOUGH_DATA) {
            context.drawImage(videoFeed, 0, 0, width, height);
            const asciiArt = processImage(context, width, height);
            renderAsciiLines(asciiArtDiv, asciiArt);
        }
    }, 200);

    const restoreTerminal = () => {
        stream.getTracks().forEach(track => track.stop());
        clearInterval(intervalId);
        document.removeEventListener("keydown", handleMovieKeyDown);
        viewer.closeButton.removeEventListener("click", restoreTerminal);
        setupTerminal();
    };

    const handleMovieKeyDown = event => {
        if (event.key === "Escape") {
            restoreTerminal();
        }
    };

    document.addEventListener("keydown", handleMovieKeyDown);
    viewer.closeButton.addEventListener("click", restoreTerminal);
}

function renderAsciiArtToCanvas(asciiLines, options = {}) {
    const lines = Array.isArray(asciiLines) ? asciiLines : [];
    const canvas = document.createElement("canvas");
    const scale = Math.max(1, Math.min(3, Math.ceil(window.devicePixelRatio || 1)));
    const fontSize = options.fontSize || 16;
    const lineHeight = Math.round(fontSize * 1.15);
    const horizontalPadding = options.horizontalPadding || 28;
    const verticalPadding = options.verticalPadding || 28;
    const fontFamily = '"Courier New", monospace';
    const context = canvas.getContext("2d");

    context.font = `${fontSize}px ${fontFamily}`;
    const maxLineWidth = lines.reduce((currentMax, line) => {
        return Math.max(currentMax, Math.ceil(context.measureText(line).width));
    }, 0);

    const logicalWidth = Math.max(320, maxLineWidth + horizontalPadding * 2);
    const logicalHeight = Math.max(200, lines.length * lineHeight + verticalPadding * 2);
    canvas.width = logicalWidth * scale;
    canvas.height = logicalHeight * scale;

    const renderContext = canvas.getContext("2d");
    renderContext.scale(scale, scale);
    renderContext.fillStyle = "#070001";
    renderContext.fillRect(0, 0, logicalWidth, logicalHeight);

    const glow = renderContext.createLinearGradient(0, 0, 0, logicalHeight);
    glow.addColorStop(0, "rgba(85, 10, 16, 0.82)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    renderContext.fillStyle = glow;
    renderContext.fillRect(0, 0, logicalWidth, logicalHeight);

    renderContext.font = `${fontSize}px ${fontFamily}`;
    renderContext.textBaseline = "top";
    renderContext.fillStyle = "#ff5f6d";

    lines.forEach((line, index) => {
        renderContext.fillText(line, horizontalPadding, verticalPadding + index * lineHeight);
    });

    return canvas;
}

function exportCanvasAsBlob(canvas, type = "image/png") {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (!blob) {
                reject(new Error("unable to export image"));
                return;
            }
            resolve(blob);
        }, type);
    });
}

async function downloadAsciiArtImage(asciiLines, options = {}) {
    const canvas = renderAsciiArtToCanvas(asciiLines, options);
    const blob = await exportCanvasAsBlob(canvas, "image/png");
    const filename = options.filename || "ascii-art.png";
    await downloadBlob(blob, filename, options.title || "ASCII art image");
}

async function downloadBlob(blob, filename, title) {
    if (navigator.canShare && typeof File !== "undefined") {
        try {
            const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title
                });
                return;
            }
        } catch (error) {
            if (error && error.name !== "AbortError") {
                console.error("blob share failed", error);
            } else {
                return;
            }
        }
    }

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function downloadImageResource(imageUrl, options = {}) {
    const safeImageUrl = getSafeImageHref(imageUrl);
    if (!safeImageUrl) {
        throw new Error("image url is not allowed");
    }

    const response = await fetch(safeImageUrl, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`unable to fetch image resource (${response.status})`);
    }
    const blob = await response.blob();
    await downloadBlob(blob, options.filename || "image-download.svg", options.title || "Image download");
}

function showImageStill(imageUrl, options = {}) {
    const safeImageUrl = getSafeImageHref(imageUrl);
    if (!safeImageUrl) {
        throw new Error("image url is not allowed");
    }

    const terminal = document.getElementById("terminal");
    terminal.classList.add("viewer-mode");
    terminal.scrollTop = 0;
    terminal.scrollLeft = 0;
    terminal.replaceChildren();
    const viewer = createAsciiViewerShell(options);
    const image = document.createElement("img");
    image.className = "viewer-image";
    image.src = safeImageUrl;
    image.alt = options.title || "image viewer";
    image.decoding = "async";
    viewer.asciiArt.replaceChildren(image);
    terminal.append(viewer.viewer);
    viewer.scrollRegion.scrollTop = 0;
    viewer.scrollRegion.scrollLeft = 0;

    const restoreTerminal = () => {
        document.removeEventListener("keydown", handleImageKeyDown);
        viewer.closeButton.removeEventListener("click", restoreTerminal);
        if (viewer.saveButton) {
            viewer.saveButton.removeEventListener("click", handleImageSave);
        }
        setupTerminal();
    };

    const handleImageKeyDown = event => {
        if (event.key === "Escape") {
            restoreTerminal();
        }
    };

    const handleImageSave = async () => {
        try {
            if (viewer.saveButton) {
                viewer.saveButton.disabled = true;
                viewer.saveButton.textContent = "saving";
            }
            await downloadImageResource(safeImageUrl, {
                filename: options.download && options.download.filename ? options.download.filename : "image-download.svg",
                title: options.title || "Image download"
            });
        } catch (error) {
            console.error("image save failed", error);
        } finally {
            if (viewer.saveButton) {
                viewer.saveButton.disabled = false;
                viewer.saveButton.textContent = options.download && options.download.label ? options.download.label : "save";
            }
        }
    };

    document.addEventListener("keydown", handleImageKeyDown);
    viewer.closeButton.addEventListener("click", restoreTerminal);
    if (viewer.saveButton) {
        viewer.saveButton.addEventListener("click", handleImageSave);
    }
}

function showAsciiStill(asciiLines, options = {}) {
    const terminal = document.getElementById("terminal");
    terminal.classList.add("viewer-mode");
    terminal.scrollTop = 0;
    terminal.scrollLeft = 0;
    terminal.replaceChildren();
    const viewer = createAsciiViewerShell(options);
    terminal.append(viewer.viewer);
    renderAsciiLines(viewer.asciiArt, asciiLines);
    viewer.scrollRegion.scrollTop = 0;
    viewer.scrollRegion.scrollLeft = 0;

    const restoreTerminal = () => {
        document.removeEventListener("keydown", handleAsciiKeyDown);
        viewer.closeButton.removeEventListener("click", restoreTerminal);
        if (viewer.saveButton) {
            viewer.saveButton.removeEventListener("click", handleAsciiSave);
        }
        setupTerminal();
    };

    const handleAsciiKeyDown = event => {
        if (event.key === "Escape") {
            restoreTerminal();
        }
    };

    const handleAsciiSave = async () => {
        try {
            if (viewer.saveButton) {
                viewer.saveButton.disabled = true;
                viewer.saveButton.textContent = "saving";
            }
            await downloadAsciiArtImage(asciiLines, {
                filename: options.download && options.download.filename ? options.download.filename : "ascii-art.png",
                title: options.title || "ASCII art image"
            });
        } catch (error) {
            console.error("ascii save failed", error);
        } finally {
            if (viewer.saveButton) {
                viewer.saveButton.disabled = false;
                viewer.saveButton.textContent = options.download && options.download.label ? options.download.label : "save";
            }
        }
    };

    document.addEventListener("keydown", handleAsciiKeyDown);
    viewer.closeButton.addEventListener("click", restoreTerminal);
    if (viewer.saveButton) {
        viewer.saveButton.addEventListener("click", handleAsciiSave);
    }
}

async function handleKeyDown(e) {
    const input = e.target;
    if (e.key === "Enter") {
        const command = input.value.trim();
        await executeCommand(command);
    } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (historyIndex > 0) {
            historyIndex--;
            input.value = commandHistory[historyIndex];
        }
    } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex < commandHistory.length - 1) {
            historyIndex++;
            input.value = commandHistory[historyIndex];
        } else if (historyIndex === commandHistory.length - 1) {
            historyIndex = commandHistory.length;
            input.value = "";
        }
    } else if (e.key === "Tab") {
        e.preventDefault();
        const partial = input.value.toLowerCase();
        const matches = Array.from(commandHandlers.keys()).filter(cmd => cmd.startsWith(partial));
        if (matches.length === 1) {
            input.value = matches[0];
        }
    }
}

async function executeCommand(commandLine) {
    if (!commandLine) {
        return;
    }
    commandHistory.push(commandLine);
    if (commandHistory.length > 100) {
        commandHistory.shift();
    }
    historyIndex = commandHistory.length;
    const terminal = document.getElementById("terminal");
    const inputLine = terminal.querySelector(".input-line");
    const commandDiv = document.createElement("div");
    commandDiv.className = "terminal-line terminal-command-line";
    appendPrompt(commandDiv);
    terminal.insertBefore(commandDiv, inputLine);
    const commandText = document.createElement('span');
    commandText.className = 'terminal-command-text';
    commandDiv.append(commandText);
    renderCommandEchoText(commandText, commandLine);

    const parts = commandLine.split(" ");
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (cmd === "clear") {
        setupTerminal();
        return;
    }
    if (cmd === "movie") {
        showMovie(args);
        return;
    }

    let output = null;
    const commandHandler = commandHandlers.get(cmd);
    if (typeof commandHandler === 'function') {
        output = await commandHandler(args);
    } else {
        output = [`bash: ${cmd}: command not found`];
    }

    if (output && output.length > 0) {
        output.forEach(line => {
            const outputDiv = document.createElement("div");
            outputDiv.className = "terminal-line";
            if (typeof line === 'string' && (line.includes("not found") || line.includes("No such file") || line.includes("Unexpected"))) {
                outputDiv.classList.add("error");
            }
            terminal.insertBefore(outputDiv, inputLine);
            renderOutputLine(outputDiv, line);
        });
    }

    document.getElementById("command-input").value = "";
    terminal.scrollTop = terminal.scrollHeight;
}

document.addEventListener("click", () => {
    const input = document.getElementById("command-input");
    if (input) {
        input.focus();
    }
});

window.setupTerminal = setupTerminal;
window.executeCommand = executeCommand;
window.getPromptPath = () => getPromptSnapshot().path;
window.getPromptUser = () => getPromptSnapshot().user;
window.getPromptHost = () => getPromptSnapshot().host;
window.refreshTerminalInputPrompt = refreshTerminalInputPrompt;
window.syncTerminalVisualEffects = syncBinaryRainVisualState;
window.showAsciiStill = showAsciiStill;
window.showImageStill = showImageStill;
window.bootTerminalSite = async defaultCommand => {
    const urlParams = new URLSearchParams(window.location.search);
    const command = urlParams.get('command');

    if (typeof window.ensureTerminalSessionReady === 'function') {
        await window.ensureTerminalSessionReady();
    }

    await ensureBannerWaveReady();
    await ensureTerminalVisualsReady();

    if (typeof window.ensureTerminalPretextReady === 'function') {
        await window.ensureTerminalPretextReady();
    }

    ensureBinaryRainBackground();
    syncBinaryRainVisualState();
    setupTerminal();
    initVisitorTracking();
    executeCommand(command ? command : defaultCommand);
};
