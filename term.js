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

function clonePromptSnapshot(snapshot = null) {
    const source = snapshot && typeof snapshot === 'object'
        ? snapshot
        : getPromptSnapshot();
    return {
        host: typeof source.host === 'string' && source.host ? source.host : DEFAULT_PROMPT_SNAPSHOT.host,
        isGodlike: Boolean(source.isGodlike),
        isRoot: Boolean(source.isRoot),
        mode: typeof source.mode === 'string' && source.mode ? source.mode : DEFAULT_PROMPT_SNAPSHOT.mode,
        path: typeof source.path === 'string' && source.path ? source.path : DEFAULT_PROMPT_SNAPSHOT.path,
        promptSymbol: typeof source.promptSymbol === 'string' && source.promptSymbol ? source.promptSymbol : DEFAULT_PROMPT_SNAPSHOT.promptSymbol,
        theme: typeof source.theme === 'string' && source.theme ? source.theme : DEFAULT_PROMPT_SNAPSHOT.theme,
        user: typeof source.user === 'string' && source.user ? source.user : DEFAULT_PROMPT_SNAPSHOT.user
    };
}

function appendPromptWithSnapshot(container, snapshot, beforeNode = null) {
    const safeSnapshot = clonePromptSnapshot(snapshot);
    const prompt = document.createElement('span');
    prompt.className = 'terminal-prompt';
    const parts = [
        [getPromptUserClassName(safeSnapshot), safeSnapshot.user],
        ['header', '@'],
        ['prompt-host', safeSnapshot.host],
        ['header', ':'],
        ['prompt-path', safeSnapshot.path],
        ['header', `${safeSnapshot.promptSymbol} `]
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

function appendPrompt(container, beforeNode = null) {
    return appendPromptWithSnapshot(container, getPromptSnapshot(), beforeNode);
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
    if (snapshot && (snapshot.isGodlike || String(snapshot.user || '').trim().toLowerCase() === 'godlike')) {
        return 'prompt-user prompt-user-godlike';
    }

    return snapshot && snapshot.isRoot ? 'prompt-user prompt-user-root' : 'prompt-user';
}

function fallbackShouldUseRootTerminalVisuals(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
        return false;
    }

    const normalizedUser = String(snapshot.user || '').trim().toLowerCase();
    return Boolean(snapshot.isRoot || snapshot.isGodlike) || normalizedUser === 'root' || normalizedUser === 'godlike';
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

function canManageBlogEntries() {
    return typeof window.canCurrentUserManageBlogEntries === 'function'
        ? window.canCurrentUserManageBlogEntries()
        : false;
}

async function handleDeleteBlogEntryAction(deleteButton, status, line) {
    deleteButton.disabled = true;
    status.textContent = ' deleting...';

    try {
        const result = await window.deleteBlogEntryByTimestamp(
            typeof line.entryTimestamp === 'string' ? line.entryTimestamp : ''
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
}

function appendDeletePostActions(wrapper, line) {
    if (!line.deletable || !canManageBlogEntries() || typeof window.deleteBlogEntryByTimestamp !== 'function') {
        return;
    }

    const actions = document.createElement('div');
    actions.className = 'terminal-inline-image-actions';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'terminal-inline-image-delete';
    deleteButton.textContent = 'delete post';

    const status = document.createElement('span');
    status.className = 'terminal-inline-image-status';

    deleteButton.addEventListener('click', async () => {
        await handleDeleteBlogEntryAction(deleteButton, status, line);
    });

    actions.append(deleteButton, status);
    wrapper.append(actions);
}

async function handleDeleteBlogMediaAction(deleteButton, status, line, mediaElement) {
    deleteButton.disabled = true;
    status.textContent = ' deleting...';

    try {
        const result = await window.deleteBlogImageByBlockIndex(
            line.imageBlockIndex,
            '',
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
        if (mediaElement && typeof mediaElement.remove === 'function') {
            mediaElement.remove();
        }
    } catch (error) {
        status.textContent = ' unable to delete image right now';
        deleteButton.disabled = false;
    }
}

function appendDeleteMediaActions(wrapper, line, mediaElement) {
    if (!line.deletable || !canManageBlogEntries() || typeof window.deleteBlogImageByBlockIndex !== 'function') {
        return;
    }

    const actions = document.createElement('div');
    actions.className = 'terminal-inline-image-actions';

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'terminal-inline-image-delete';
    deleteButton.textContent = 'delete';

    const status = document.createElement('span');
    status.className = 'terminal-inline-image-status';

    deleteButton.addEventListener('click', async () => {
        await handleDeleteBlogMediaAction(deleteButton, status, line, mediaElement);
    });

    actions.append(deleteButton, status);
    wrapper.append(actions);
}

function syncTerminalSessionAwareLines() {
    if (!isRootSessionActive()) {
        stopEditorialAnimationLoop();
    }

    const lines = document.querySelectorAll('.terminal-line');
    lines.forEach(line => {
        if (line.__terminalRenderedObject && typeof line.__terminalRenderedObject === 'object') {
            line.replaceChildren();
            delete line.dataset.blogEntryTimestamp;
            renderOutputObject(line, line.__terminalRenderedObject);
            return;
        }

        if (typeof line.__terminalRenderedCommandText === 'string') {
            renderCommandLineEcho(
                line,
                line.__terminalRenderedCommandText,
                line.__terminalCommandPromptSnapshot
            );
            return;
        }

        if (typeof line.__terminalRenderedText !== 'string') {
            return;
        }

        line.replaceChildren();
        renderOutputLine(line, line.__terminalRenderedText);
    });

    if (isTerminalEditorialModeActive()) {
        syncAllBlogEditorialLayouts();
    }
}

function resetTerminalLinePresentation(container) {
    if (!container) {
        return;
    }

    container.classList.remove('terminal-pretext-enabled', 'terminal-pretext-editorial-enabled');
    container.style.minHeight = '';
    container.style.paddingLeft = '';
    container.style.paddingTop = '';
    container.style.position = '';

    const visitorWidget = container.querySelector(':scope > [data-visitor-counter]');
    if (visitorWidget) {
        visitorWidget.style.margin = '';
        visitorWidget.style.position = '';
        visitorWidget.style.left = '';
        visitorWidget.style.top = '';
        visitorWidget.style.transform = '';
    }
}

const editorialBlogEntryStates = new WeakMap();
const editorialBlogEntryContainers = new Set();
let editorialBlogResizeFrameId = 0;
let editorialBlogAnimationFrameId = 0;
const BLOG_EDITORIAL_MEDIA_GUTTER = 18;
const BLOG_EDITORIAL_MEDIA_ROW_MARGIN_TOP_REM = 0.15;
const BLOG_EDITORIAL_MEDIA_ROW_MARGIN_BOTTOM_REM = 0.4;
const TERMINAL_EDITORIAL_OVERLAY_CLASS = 'terminal-editorial-overlay';
const EDITORIAL_MEDIA_FLOAT_AMPLITUDE_X = 10;
const EDITORIAL_MEDIA_FLOAT_AMPLITUDE_Y = 14;
const EDITORIAL_MEDIA_FLOAT_PADDING = 22;

function isRootSessionActive() {
    const snapshot = getPromptSnapshot();
    if (!snapshot || typeof snapshot !== 'object') {
        return false;
    }

    return Boolean(snapshot.isRoot) || String(snapshot.user || '').trim().toLowerCase() === 'root';
}

function hasActiveEditorialBlogEntries() {
    let hasConnectedEntry = false;
    editorialBlogEntryContainers.forEach(container => {
        if (hasConnectedEntry) {
            return;
        }

        if (container?.isConnected && editorialBlogEntryStates.has(container)) {
            hasConnectedEntry = true;
        }
    });

    return hasConnectedEntry;
}

function isTerminalEditorialModeActive() {
    return isRootSessionActive() && hasActiveEditorialBlogEntries();
}

function formatEditorialVisitorValue(value, width = 7) {
    const safeValue = Math.max(0, Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 0);
    return String(safeValue).padStart(width, '0');
}

function clampEditorialNumber(value, minimum, maximum) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return minimum;
    }

    return Math.min(maximum, Math.max(minimum, numericValue));
}

function resolveEditorialContainerWidth(container) {
    if (!container) {
        return 0;
    }

    const ownWidth = container.clientWidth || container.getBoundingClientRect().width;
    if (ownWidth > 0) {
        return Math.floor(ownWidth);
    }

    if (container.parentElement) {
        const parentWidth = container.parentElement.clientWidth || container.parentElement.getBoundingClientRect().width;
        if (parentWidth > 0) {
            return Math.floor(parentWidth);
        }
    }

    return 0;
}

function resolveEditorialLineHeight(element) {
    const styles = window.getComputedStyle(element);
    const explicitLineHeight = parseFloat(styles.lineHeight);
    if (Number.isFinite(explicitLineHeight)) {
        return Math.max(18, Math.round(explicitLineHeight));
    }

    const fontSize = parseFloat(styles.fontSize);
    if (Number.isFinite(fontSize)) {
        return Math.max(18, Math.round(fontSize * 1.35));
    }

    return 24;
}

function resolveEditorialStageTopInTerminal(stage) {
    const terminal = document.getElementById('terminal');
    if (!stage || !terminal) {
        return 0;
    }

    const stageRect = stage.getBoundingClientRect();
    const terminalRect = terminal.getBoundingClientRect();
    return Math.max(0, Math.round(stageRect.top - terminalRect.top + terminal.scrollTop));
}

function resolveElementTopInTerminal(element) {
    const terminal = document.getElementById('terminal');
    if (!element || !terminal) {
        return 0;
    }

    const elementRect = element.getBoundingClientRect();
    const terminalRect = terminal.getBoundingClientRect();
    return Math.max(0, Math.round(elementRect.top - terminalRect.top + terminal.scrollTop));
}

function resolveElementLeftInTerminal(element) {
    const terminal = document.getElementById('terminal');
    if (!element || !terminal) {
        return 0;
    }

    const elementRect = element.getBoundingClientRect();
    const terminalRect = terminal.getBoundingClientRect();
    return Math.max(0, Math.round(elementRect.left - terminalRect.left + terminal.scrollLeft));
}

function resolveEditorialTerminalWidth() {
    const terminal = document.getElementById('terminal');
    if (!terminal) {
        return 0;
    }

    const width = terminal.clientWidth || terminal.getBoundingClientRect().width;
    return width > 0 ? Math.floor(width) : 0;
}

function ensureTerminalEditorialOverlay() {
    const terminal = document.getElementById('terminal');
    if (!terminal) {
        return null;
    }

    let overlay = terminal.querySelector(`.${TERMINAL_EDITORIAL_OVERLAY_CLASS}`);
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = TERMINAL_EDITORIAL_OVERLAY_CLASS;
        terminal.append(overlay);
    }

    overlay.style.height = `${Math.max(terminal.scrollHeight, terminal.clientHeight)}px`;
    return overlay;
}

function destroyBlogEditorialState(state) {
    if (!state) {
        return;
    }

    (Array.isArray(state.media) ? state.media : []).forEach(mediaState => {
        mediaState?.dom?.wrapper?.remove();
        mediaState.dom = null;
    });
    state.dom = null;
}

function disposeBlogEditorialState(container) {
    const state = editorialBlogEntryStates.get(container);
    if (!state) {
        editorialBlogEntryContainers.delete(container);
        return;
    }

    destroyBlogEditorialState(state);
    editorialBlogEntryStates.delete(container);
    editorialBlogEntryContainers.delete(container);
}

function getOrderedEditorialBlogContainers() {
    const terminal = document.getElementById('terminal');
    if (!terminal) {
        return [];
    }

    return [...terminal.querySelectorAll('.terminal-line')].filter(container => {
        const line = container.__terminalRenderedObject;
        return line && line.type === 'blog-entry' && editorialBlogEntryStates.has(container);
    });
}

function getOrderedTerminalObjectLines() {
    const terminal = document.getElementById('terminal');
    if (!terminal) {
        return [];
    }

    return [...terminal.querySelectorAll('.terminal-line')]
        .filter(container => container?.__terminalRenderedObject && typeof container.__terminalRenderedObject === 'object');
}

function getOrderedTerminalPlainTextLines() {
    const terminal = document.getElementById('terminal');
    if (!terminal) {
        return [];
    }

    return [...terminal.querySelectorAll('.terminal-line')]
        .filter(container => (
            !container.classList.contains('terminal-command-line')
            && !container.__terminalRenderedObject
            && typeof container.__terminalRenderedText === 'string'
        ));
}

function getOrderedTerminalCommandLines() {
    const terminal = document.getElementById('terminal');
    if (!terminal) {
        return [];
    }

    return [...terminal.querySelectorAll('.terminal-command-line')]
        .filter(container => typeof container.__terminalRenderedCommandText === 'string');
}

function getTerminalCommandShell(container) {
    return container?.querySelector(':scope > .terminal-command-shell') || null;
}

function getTerminalInputLine() {
    const terminal = document.getElementById('terminal');
    return terminal ? terminal.querySelector('.input-line') : null;
}

function getTerminalInputShell() {
    const inputLine = getTerminalInputLine();
    return inputLine?.querySelector(':scope > .input-line-shell') || null;
}

function resolveElementOuterMetrics(element) {
    if (!element) {
        return null;
    }

    const rect = element.getBoundingClientRect();
    const computedStyles = window.getComputedStyle(element);
    const marginLeft = Math.max(0, Number.parseFloat(computedStyles.marginLeft) || 0);
    const marginRight = Math.max(0, Number.parseFloat(computedStyles.marginRight) || 0);
    const marginTop = Math.max(0, Number.parseFloat(computedStyles.marginTop) || 0);
    const marginBottom = Math.max(0, Number.parseFloat(computedStyles.marginBottom) || 0);
    const width = Math.ceil(rect.width || element.offsetWidth || element.scrollWidth || 0);
    const height = Math.ceil(rect.height || element.offsetHeight || element.scrollHeight || 0);

    return {
        height,
        marginBottom,
        marginLeft,
        marginRight,
        marginTop,
        outerHeight: height + marginTop + marginBottom,
        outerWidth: width + marginLeft + marginRight,
        width
    };
}

function syncEditorialFlowBlockContainer(container, targetElement, obstacleRects = [], options = {}) {
    if (!container || !targetElement) {
        return;
    }

    resetTerminalLinePresentation(container);
    const metrics = resolveElementOuterMetrics(targetElement);
    if (!metrics || metrics.outerWidth <= 0 || metrics.outerHeight <= 0) {
        return;
    }

    const placement = resolveEditorialBlockPlacement(
        container,
        metrics.outerWidth,
        metrics.outerHeight,
        obstacleRects,
        {
            padding: options.padding,
            preferredX: Number.isFinite(Number(options.preferredX)) ? Number(options.preferredX) : metrics.marginLeft,
            preferredY: Number.isFinite(Number(options.preferredY)) ? Number(options.preferredY) : metrics.marginTop,
            verticalStep: options.verticalStep
        }
    );
    const paddingLeft = Math.max(0, Math.round(placement.x - metrics.marginLeft));
    const paddingTop = Math.max(0, Math.round(placement.y - metrics.marginTop));

    container.style.paddingLeft = paddingLeft > 0 ? `${paddingLeft}px` : '';
    container.style.paddingTop = paddingTop > 0 ? `${paddingTop}px` : '';
    container.style.minHeight = `${Math.max(metrics.outerHeight + paddingTop, placement.height)}px`;
}

function createEditorialMediaPlaceholderRow() {
    const row = document.createElement('div');
    row.className = 'terminal-blog-entry-media-row terminal-editorial-media-placeholder';
    return row;
}

function createEditorialTextBlockElement(className = 'terminal-editorial-text-block') {
    const element = document.createElement('div');
    element.className = className;
    return element;
}

function getBlogEntryMediaBlocks(line) {
    return Array.isArray(line?.blocks)
        ? line.blocks.filter(block => block && (block.type === 'inline-image' || block.type === 'inline-video'))
        : [];
}

function buildBlogEntrySignature(line) {
    const mediaSignature = getBlogEntryMediaBlocks(line)
        .map(block => `${block.imageKey || block.src}:${block.type}`)
        .join('|');
    const textSignature = Array.isArray(line?.blocks)
        ? line.blocks
            .filter(block => block?.type === 'blog-entry-text-block')
            .map(block => Array.isArray(block.lines) ? block.lines.join('\n') : '')
            .join('\n\n')
        : '';

    return `${line?.entryTimestamp || 'no-entry'}::${mediaSignature}::${textSignature.length}`;
}

function createBlogEditorialMediaState(block, index) {
    return {
        aspectRatio: block.type === 'inline-video' ? 16 / 9 : 4 / 3,
        block,
        docked: true,
        floatAmplitudeX: EDITORIAL_MEDIA_FLOAT_AMPLITUDE_X * (0.7 + Math.random() * 0.6),
        floatAmplitudeY: EDITORIAL_MEDIA_FLOAT_AMPLITUDE_Y * (0.65 + Math.random() * 0.55),
        floatPhaseX: Math.random() * Math.PI * 2,
        floatPhaseY: Math.random() * Math.PI * 2,
        floatSpeedX: 0.00055 + Math.random() * 0.00045,
        floatSpeedY: 0.00045 + Math.random() * 0.00035,
        id: `${block.imageKey || block.src || `media-${index}`}-${index}`,
        index,
        renderX: null,
        renderY: null,
        x: null,
        y: null
    };
}

function getBlogEditorialState(container, line) {
    const signature = buildBlogEntrySignature(line);
    let state = editorialBlogEntryStates.get(container);

    if (!state || state.signature !== signature) {
        destroyBlogEditorialState(state);
        state = {
            dom: null,
            drag: null,
            media: getBlogEntryMediaBlocks(line).map(createBlogEditorialMediaState),
            signature
        };
        editorialBlogEntryStates.set(container, state);
    }

    editorialBlogEntryContainers.add(container);
    return state;
}

function resolveEditorialMediaDimensions(mediaState, stageWidth) {
    const safeStageWidth = Math.max(140, stageWidth);
    const aspectRatio = mediaState.aspectRatio && mediaState.aspectRatio > 0
        ? mediaState.aspectRatio
        : (mediaState.block.type === 'inline-video' ? 16 / 9 : 4 / 3);
    const mediaElement = mediaState?.dom?.mediaElement || null;
    const computedStyles = mediaElement ? window.getComputedStyle(mediaElement) : null;
    const computedMaxWidth = computedStyles ? Number.parseFloat(computedStyles.maxWidth) : Number.NaN;
    const availableWidth = Math.max(
        1,
        Number.isFinite(computedMaxWidth) && computedMaxWidth > 0
            ? Math.min(safeStageWidth, computedMaxWidth)
            : safeStageWidth
    );
    const intrinsicWidth = mediaElement?.videoWidth
        || mediaElement?.naturalWidth
        || mediaElement?.clientWidth
        || availableWidth;
    const width = clampEditorialNumber(
        Math.round(Math.min(availableWidth, intrinsicWidth || availableWidth)),
        Math.min(140, availableWidth),
        availableWidth
    );
    const marginTop = computedStyles ? Math.max(0, Number.parseFloat(computedStyles.marginTop) || 0) : 0;
    const marginBottom = computedStyles ? Math.max(0, Number.parseFloat(computedStyles.marginBottom) || 0) : 0;
    const height = Math.max(1, Math.round(width / aspectRatio));

    return {
        height,
        marginBottom,
        marginTop,
        outerHeight: height + marginTop + marginBottom,
        width
    };
}

function resolveEditorialMediaRowSpacing() {
    const rootFontSize = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize);
    const rem = Number.isFinite(rootFontSize) && rootFontSize > 0 ? rootFontSize : 16;
    return {
        bottom: Math.round(rem * BLOG_EDITORIAL_MEDIA_ROW_MARGIN_BOTTOM_REM),
        top: Math.round(rem * BLOG_EDITORIAL_MEDIA_ROW_MARGIN_TOP_REM)
    };
}

function getAllBlogEditorialMediaStates() {
    return getOrderedEditorialBlogContainers().flatMap(container => {
        const state = editorialBlogEntryStates.get(container);
        return Array.isArray(state?.media) ? state.media : [];
    });
}

function buildRelativeEditorialObstacles(element, obstacleRects, padding = EDITORIAL_MEDIA_FLOAT_PADDING) {
    const maxWidth = resolveEditorialContainerWidth(element);
    if (!element || maxWidth <= 0 || !Array.isArray(obstacleRects) || obstacleRects.length === 0) {
        return [];
    }

    const elementLeft = resolveElementLeftInTerminal(element);
    const elementTop = resolveElementTopInTerminal(element);
    const horizontalPadding = Math.round(padding * 0.4);
    const verticalPadding = Math.round(padding * 0.35);

    return obstacleRects.reduce((relativeRects, rect) => {
        const relativeLeft = rect.x - elementLeft - horizontalPadding;
        const relativeRight = rect.x + rect.width - elementLeft + horizontalPadding;
        const relativeTop = rect.y - elementTop - verticalPadding;
        const relativeBottom = rect.y + rect.height - elementTop + verticalPadding;

        const clippedLeft = clampEditorialNumber(relativeLeft, 0, maxWidth);
        const clippedRight = clampEditorialNumber(relativeRight, 0, maxWidth);
        const clippedTop = Math.max(0, relativeTop);
        const clippedBottom = Math.max(0, relativeBottom);

        if (clippedRight <= clippedLeft || clippedBottom <= clippedTop) {
            return relativeRects;
        }

        relativeRects.push({
            height: clippedBottom - clippedTop,
            width: clippedRight - clippedLeft,
            x: clippedLeft,
            y: clippedTop
        });
        return relativeRects;
    }, []);
}

function syncEditorialTextContainer(element, text, obstacleRects, options = {}) {
    if (!element) {
        return {
            height: 0,
            lineCount: 0,
            lines: []
        };
    }

    if (typeof window.renderTerminalEditorialLineContent === 'function') {
        return window.renderTerminalEditorialLineContent(element, text, {
            ...options,
            characterGranularity: options.characterGranularity !== false,
            minSegmentWidth: Number.isFinite(Number(options.minSegmentWidth))
                ? Number(options.minSegmentWidth)
                : 8,
            obstacles: buildRelativeEditorialObstacles(element, obstacleRects, options.padding)
        }) || {
            height: element.getBoundingClientRect().height || 0,
            lineCount: 0,
            lines: []
        };
    }

    if (typeof window.renderTerminalLineContent === 'function') {
        window.renderTerminalLineContent(element, text);
    } else {
        element.textContent = text;
    }

    return {
        height: element.getBoundingClientRect().height || 0,
        lineCount: 0,
        lines: []
    };
}

function createBlogMediaElement(block, options = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = options.wrapperClass || 'terminal-inline-image-wrapper';

    let mediaElement = null;
    if (block.type === 'inline-video') {
        const video = document.createElement('video');
        video.className = options.videoClassName || 'terminal-inline-video';
        video.src = block.src;
        video.controls = options.showControls !== false;
        video.playsInline = true;
        video.preload = 'metadata';
        mediaElement = video;
        wrapper.append(video);
    } else {
        const image = document.createElement('img');
        image.className = options.imageClassName || 'terminal-inline-image';
        image.src = block.src;
        image.alt = block.alt || 'Embedded blog image';
        image.decoding = 'async';
        image.loading = 'lazy';
        mediaElement = image;
        wrapper.append(image);
    }

    if (options.enableDeleteActions) {
        appendDeleteMediaActions(wrapper, block, mediaElement);
    }

    return {
        mediaElement,
        wrapper
    };
}

function renderBlogEntryFlat(container, line) {
    disposeBlogEditorialState(container);

    const wrapper = document.createElement('article');
    wrapper.className = 'terminal-blog-entry';

    const header = document.createElement('div');
    header.className = 'terminal-blog-entry-header';

    const timestamp = document.createElement('span');
    timestamp.className = 'terminal-blog-entry-timestamp';
    timestamp.textContent = line.text || '';
    header.append(timestamp);
    appendDeletePostActions(header, line);
    wrapper.append(header);

    (Array.isArray(line.blocks) ? line.blocks : []).forEach(block => {
        if (block.type === 'blog-entry-text-block') {
            block.lines.forEach(textLine => {
                const row = document.createElement('div');
                row.className = textLine ? 'terminal-blog-entry-text-line' : 'terminal-blog-entry-text-line terminal-blog-entry-text-line-empty';
                if (textLine) {
                    if (typeof window.renderTerminalLineContent === 'function') {
                        window.renderTerminalLineContent(row, textLine);
                    } else {
                        row.textContent = textLine;
                    }
                } else {
                    row.textContent = '\u00A0';
                }
                wrapper.append(row);
            });
            return;
        }

        if (block.type === 'inline-image' || block.type === 'inline-video') {
            const mediaRow = document.createElement('div');
            mediaRow.className = 'terminal-blog-entry-media-row';

            const isSafeSource = typeof window.isSafeBlogImageSource === 'function'
                ? window.isSafeBlogImageSource(block.src)
                : false;
            if (!isSafeSource) {
                mediaRow.textContent = block.type === 'inline-video'
                    ? '[invalid embedded video]'
                    : '[invalid embedded image]';
                wrapper.append(mediaRow);
                return;
            }

            const { wrapper: mediaWrapper } = createBlogMediaElement(block, {
                enableDeleteActions: true
            });
            mediaRow.append(mediaWrapper);
            wrapper.append(mediaRow);
        }
    });

    container.append(wrapper);
}

function ensureBlogEditorialMediaAspectRatio(container, line, state, mediaState, mediaElement) {
    const applyMeasuredRatio = () => {
        const width = mediaElement.videoWidth || mediaElement.naturalWidth || mediaElement.clientWidth;
        const height = mediaElement.videoHeight || mediaElement.naturalHeight || mediaElement.clientHeight;
        if (!width || !height) {
            return;
        }

        mediaState.aspectRatio = width / height;
        syncAllBlogEditorialLayouts();
    };

    if (mediaState.block.type === 'inline-video') {
        mediaElement.addEventListener('loadedmetadata', applyMeasuredRatio, { once: true });
    } else if (mediaElement.complete && mediaElement.naturalWidth && mediaElement.naturalHeight) {
        applyMeasuredRatio();
    } else {
        mediaElement.addEventListener('load', applyMeasuredRatio, { once: true });
    }
}

function resolveAnimatedEditorialMediaPosition(mediaState, dimensions, now = window.performance?.now?.() || Date.now()) {
    const terminalWidth = resolveEditorialTerminalWidth();
    const maximumX = Math.max(0, terminalWidth - dimensions.width);
    const baseX = clampEditorialNumber(Number(mediaState.x) || 0, 0, maximumX);
    const baseY = clampEditorialNumber(Number(mediaState.y) || 0, 0, Number.MAX_SAFE_INTEGER);

    if (mediaState.docked || mediaState.isDragging) {
        return {
            x: baseX,
            y: baseY
        };
    }

    const animatedX = clampEditorialNumber(
        baseX + Math.sin(now * mediaState.floatSpeedX + mediaState.floatPhaseX) * mediaState.floatAmplitudeX,
        0,
        maximumX
    );
    const animatedY = Math.max(
        0,
        baseY + Math.cos(now * mediaState.floatSpeedY + mediaState.floatPhaseY) * mediaState.floatAmplitudeY
    );

    return {
        x: animatedX,
        y: animatedY
    };
}

function updateBlogEditorialMediaAnchors(state, now = window.performance?.now?.() || Date.now()) {
    if (!state) {
        return;
    }

    const terminalWidth = resolveEditorialTerminalWidth();
    state.media.forEach(mediaState => {
        const placeholder = mediaState.dom?.placeholder || null;
        if (!placeholder) {
            return;
        }

        const dimensions = resolveEditorialMediaDimensions(mediaState, terminalWidth);
        placeholder.style.height = `${Math.round(dimensions.outerHeight)}px`;
        placeholder.style.minHeight = `${Math.round(dimensions.outerHeight)}px`;
        if (mediaState.docked) {
            placeholder.classList.remove('is-floating');
            mediaState.dom?.wrapper?.classList.remove('is-floating');
            mediaState.x = resolveElementLeftInTerminal(placeholder);
            mediaState.y = resolveElementTopInTerminal(placeholder);
        } else {
            placeholder.classList.add('is-floating');
            mediaState.dom?.wrapper?.classList.add('is-floating');
            mediaState.x = clampEditorialNumber(Number(mediaState.x) || 0, 0, Math.max(0, terminalWidth - dimensions.width));
            mediaState.y = clampEditorialNumber(Number(mediaState.y) || 0, 0, Number.MAX_SAFE_INTEGER);
        }

        const animatedPosition = resolveAnimatedEditorialMediaPosition(mediaState, dimensions, now);
        mediaState.renderX = animatedPosition.x;
        mediaState.renderY = animatedPosition.y;
        applyBlogEditorialMediaPosition(mediaState, dimensions);
    });
}

function collectBlogEditorialObstacleRects() {
    return getAllBlogEditorialMediaStates().reduce((rects, mediaState) => {
        const wrapper = mediaState?.dom?.wrapper;
        if (!wrapper) {
            return rects;
        }

        const width = wrapper.getBoundingClientRect().width || wrapper.offsetWidth || 0;
        const height = wrapper.getBoundingClientRect().height || wrapper.offsetHeight || 0;
        if (width <= 0 || height <= 0) {
            return rects;
        }

        rects.push({
            height,
            width,
            x: Number.isFinite(mediaState.renderX) ? mediaState.renderX : (Number.isFinite(mediaState.x) ? mediaState.x : 0),
            y: Number.isFinite(mediaState.renderY) ? mediaState.renderY : (Number.isFinite(mediaState.y) ? mediaState.y : 0)
        });
        return rects;
    }, []);
}

function rectsOverlap(left, right) {
    return left.x < right.x + right.width
        && left.x + left.width > right.x
        && left.y < right.y + right.height
        && left.y + left.height > right.y;
}

function resolveEditorialBlockPlacement(container, blockWidth, blockHeight, obstacleRects = [], options = {}) {
    const maxWidth = resolveEditorialContainerWidth(container);
    const safeWidth = Math.max(1, Math.round(blockWidth));
    const safeHeight = Math.max(1, Math.round(blockHeight));
    const maximumX = Math.max(0, maxWidth - safeWidth);
    const preferredX = clampEditorialNumber(Number(options.preferredX) || 0, 0, maximumX);
    const preferredY = Math.max(0, Math.round(Number(options.preferredY) || 0));
    const verticalStep = Math.max(4, Math.round(Number(options.verticalStep) || (resolveEditorialLineHeight(container) * 0.5)));
    const relativeObstacles = buildRelativeEditorialObstacles(
        container,
        obstacleRects,
        Number.isFinite(Number(options.padding)) ? Number(options.padding) : EDITORIAL_MEDIA_FLOAT_PADDING
    );
    const scanLimit = Math.max(
        preferredY + safeHeight + verticalStep,
        ...relativeObstacles.map(rect => Math.ceil(rect.y + rect.height + safeHeight + verticalStep))
    );

    let bestPlacement = {
        x: preferredX,
        y: scanLimit
    };
    let bestScore = Number.POSITIVE_INFINITY;

    for (let y = preferredY; y <= scanLimit; y += verticalStep) {
        const overlappingRects = relativeObstacles.filter(rect => rect.y < y + safeHeight && rect.y + rect.height > y);
        const candidateXs = new Set([preferredX, 0]);
        overlappingRects.forEach(rect => {
            candidateXs.add(clampEditorialNumber(Math.round(rect.x + rect.width), 0, maximumX));
        });

        const orderedXs = [...candidateXs].sort((left, right) => Math.abs(left - preferredX) - Math.abs(right - preferredX));
        for (const x of orderedXs) {
            const candidateRect = {
                height: safeHeight,
                width: safeWidth,
                x,
                y
            };
            if (overlappingRects.some(rect => rectsOverlap(candidateRect, rect))) {
                continue;
            }

            const score = Math.abs(y - preferredY) * 3 + Math.abs(x - preferredX);
            if (score < bestScore) {
                bestScore = score;
                bestPlacement = { x, y };
            }
        }

        if (bestScore === 0) {
            break;
        }
    }

    return {
        height: bestPlacement.y + safeHeight,
        x: bestPlacement.x,
        y: bestPlacement.y
    };
}

function applyBlogEditorialMediaPosition(mediaState, dimensions) {
    if (!mediaState.dom?.wrapper || !mediaState.dom?.mediaElement) {
        return;
    }

    const renderX = Number.isFinite(mediaState.renderX) ? mediaState.renderX : mediaState.x;
    const renderY = Number.isFinite(mediaState.renderY) ? mediaState.renderY : mediaState.y;
    mediaState.dom.wrapper.style.width = `${Math.round(dimensions.width)}px`;
    mediaState.dom.wrapper.style.height = `${Math.round(dimensions.outerHeight)}px`;
    mediaState.dom.wrapper.style.transform = `translate(${Math.round(renderX || 0)}px, ${Math.round(renderY || 0)}px)`;
    mediaState.dom.mediaElement.style.width = `${Math.round(dimensions.width)}px`;
    mediaState.dom.mediaElement.style.height = `${Math.round(dimensions.height)}px`;
}

function stopEditorialAnimationLoop() {
    if (!editorialBlogAnimationFrameId) {
        return;
    }

    window.cancelAnimationFrame(editorialBlogAnimationFrameId);
    editorialBlogAnimationFrameId = 0;
}

function shouldAnimateEditorialMedia() {
    return getAllBlogEditorialMediaStates().some(mediaState => !mediaState.docked || mediaState.isDragging);
}

function queueEditorialAnimationLoop() {
    if (editorialBlogAnimationFrameId || !isTerminalEditorialModeActive() || !shouldAnimateEditorialMedia()) {
        return;
    }

    editorialBlogAnimationFrameId = window.requestAnimationFrame(() => {
        editorialBlogAnimationFrameId = 0;
        syncAllBlogEditorialLayouts();
        queueEditorialAnimationLoop();
    });
}

function syncAllBlogEditorialLayouts() {
    if (!isTerminalEditorialModeActive()) {
        stopEditorialAnimationLoop();
        return;
    }

    const overlay = ensureTerminalEditorialOverlay();
    const runLayoutPass = () => {
        const blogContainers = getOrderedEditorialBlogContainers();
        blogContainers.forEach(container => {
            if (!container.isConnected) {
                disposeBlogEditorialState(container);
                return;
            }

            const state = editorialBlogEntryStates.get(container);
            if (state) {
                updateBlogEditorialMediaAnchors(state);
            }
        });

        const obstacleRects = collectBlogEditorialObstacleRects();

        getOrderedTerminalObjectLines().forEach(container => {
            const line = container.__terminalRenderedObject;
            if (!line) {
                return;
            }

            if (line.type === 'blog-entry') {
                const state = editorialBlogEntryStates.get(container);
                if (state) {
                    syncBlogEditorialEntryLayout(container, line, state, obstacleRects);
                }
                return;
            }

            if (line.type === 'banner') {
                syncBannerEditorialLayout(container, line, obstacleRects);
                return;
            }

            if (line.type === 'visitor-widget') {
                syncVisitorWidgetEditorialLayout(container, line, obstacleRects);
            }
        });

        getOrderedTerminalPlainTextLines().forEach(container => {
            syncEditorialTextContainer(container, container.__terminalRenderedText, obstacleRects, {
                whiteSpace: 'pre-wrap'
            });
        });

        getOrderedTerminalCommandLines().forEach(container => {
            const shell = getTerminalCommandShell(container) || container;
            syncEditorialFlowBlockContainer(container, shell, obstacleRects, {
                padding: 14,
                verticalStep: 8
            });
        });

        const inputLine = getTerminalInputLine();
        const inputShell = getTerminalInputShell();
        if (inputLine && inputShell) {
            syncEditorialFlowBlockContainer(inputLine, inputShell, obstacleRects, {
                padding: 14,
                verticalStep: 8
            });
        }
    };

    runLayoutPass();
    runLayoutPass();

    if (overlay) {
        const terminal = document.getElementById('terminal');
        overlay.style.height = `${Math.max(terminal?.scrollHeight || 0, terminal?.clientHeight || 0)}px`;
    }

    queueEditorialAnimationLoop();
}

function syncBlogEditorialEntryLayout(container, line, state, obstacleRects = []) {
    if (!state?.dom?.wrapper) {
        return;
    }

    const overlay = ensureTerminalEditorialOverlay();
    if (overlay && state.dom.overlay !== overlay) {
        state.dom.overlay = overlay;
    }

    if (state.dom.timestamp) {
        syncEditorialTextContainer(state.dom.timestamp, line.text || '', obstacleRects, {
            minSegmentWidth: 12,
            tokenizeLinks: false,
            whiteSpace: 'pre-wrap'
        });
    }

    const textRows = Array.isArray(state.dom.textRows) ? state.dom.textRows : [];
    textRows.forEach(row => {
        if (!row?.element) {
            return;
        }

        if (!row.text) {
            row.element.classList.remove('terminal-pretext-enabled', 'terminal-pretext-editorial-enabled');
            row.element.style.minHeight = '';
            row.element.replaceChildren(document.createTextNode('\u00A0'));
            return;
        }

        syncEditorialTextContainer(row.element, row.text, obstacleRects, {
            whiteSpace: 'pre-wrap'
        });
    });
}

function buildBannerEditorialSignature(line) {
    return `${line?.title || ''}::${line?.subtitle || ''}`;
}

function mountBannerEditorial(container, line, state) {
    const title = createEditorialTextBlockElement('banner-art terminal-editorial-banner-text');
    container.append(title);

    let subtitle = null;
    if (line.subtitle) {
        subtitle = createEditorialTextBlockElement('banner-subtitle terminal-editorial-banner-text');
        container.append(subtitle);
    }

    state.dom = {
        subtitle,
        title
    };
}

function syncBannerEditorialLayout(container, line, obstacleRects = []) {
    if (!isTerminalEditorialModeActive()) {
        return;
    }

    let state = container.__terminalEditorialBannerState;
    const signature = buildBannerEditorialSignature(line);
    if (!state || state.signature !== signature || !state.dom?.title) {
        container.replaceChildren();
        state = { dom: null, signature };
        mountBannerEditorial(container, line, state);
        container.__terminalEditorialBannerState = state;
    }

    syncEditorialTextContainer(state.dom.title, line.title || '', obstacleRects, {
        minSegmentWidth: 18,
        tokenizeLinks: false,
        whiteSpace: 'pre-wrap'
    });

    if (state.dom.subtitle) {
        syncEditorialTextContainer(state.dom.subtitle, line.subtitle || '', obstacleRects, {
            minSegmentWidth: 14,
            tokenizeLinks: false,
            whiteSpace: 'pre-wrap'
        });
    }
}

function renderBannerEditorial(container, line) {
    syncBannerEditorialLayout(container, line, []);
}

function buildVisitorWidgetEditorialSignature(stats = null) {
    const safeStats = stats || {};
    return [
        safeStats.visits ?? '',
        safeStats.uniqueVisitors ?? '',
        safeStats.onSite ?? ''
    ].join(':');
}

function buildVisitorWidgetEditorialRows(stats = null) {
    const safeStats = stats || {};
    return [
        {
            className: 'visitor-widget-row visitor-widget-row-editorial',
            text: `Visits: ${formatEditorialVisitorValue(safeStats.visits)}`
        },
        {
            className: 'visitor-widget-row visitor-widget-row-editorial',
            text: `Uniq. Visitors: ${formatEditorialVisitorValue(safeStats.uniqueVisitors)}`
        },
        {
            className: 'visitor-widget-row visitor-widget-row-editorial',
            text: `On-site: ${formatEditorialVisitorValue(safeStats.onSite)}`
        }
    ];
}

function mountVisitorWidgetEditorial(container, line, state) {
    let widget = container.querySelector(':scope > [data-visitor-counter]');
    if (!widget && typeof window.buildVisitorWidgetElement === 'function') {
        widget = window.buildVisitorWidgetElement(line.stats);
        container.replaceChildren(widget);
    }

    state.dom = {
        widget
    };
}

function syncVisitorWidgetEditorialLayout(container, line, obstacleRects = []) {
    if (!isTerminalEditorialModeActive()) {
        return;
    }

    let state = container.__terminalEditorialVisitorState;
    const widget = container.querySelector(':scope > [data-visitor-counter]');
    if (!state || state.dom?.widget !== widget || !state.dom?.widget) {
        state = { dom: null };
        mountVisitorWidgetEditorial(container, line, state);
        container.__terminalEditorialVisitorState = state;
    }

    if (!state.dom?.widget) {
        return;
    }

    syncEditorialFlowBlockContainer(container, state.dom.widget, obstacleRects, {
        padding: 12,
        preferredX: 0,
        preferredY: 0,
        verticalStep: 8
    });
}

function renderVisitorWidgetEditorial(container, line) {
    syncVisitorWidgetEditorialLayout(container, line, []);
}

function mountBlogEditorialEntry(container, line, state) {
    const wrapper = document.createElement('article');
    wrapper.className = 'terminal-blog-entry terminal-editorial-entry';

    const header = document.createElement('div');
    header.className = 'terminal-blog-entry-header';

    const timestamp = createEditorialTextBlockElement('terminal-blog-entry-timestamp terminal-editorial-blog-header-text');
    header.append(timestamp);
    appendDeletePostActions(header, line);
    wrapper.append(header);

    const overlay = ensureTerminalEditorialOverlay();
    const mediaStatesByBlock = new Map(state.media.map(mediaState => [mediaState.block, mediaState]));
    const textRows = [];

    (Array.isArray(line.blocks) ? line.blocks : []).forEach(block => {
        if (block.type === 'blog-entry-text-block') {
            block.lines.forEach(textLine => {
                const row = document.createElement('div');
                row.className = textLine ? 'terminal-blog-entry-text-line' : 'terminal-blog-entry-text-line terminal-blog-entry-text-line-empty';
                wrapper.append(row);
                textRows.push({
                    element: row,
                    text: textLine || ''
                });
            });
            return;
        }

        if (block.type !== 'inline-image' && block.type !== 'inline-video') {
            return;
        }

        const mediaState = mediaStatesByBlock.get(block);
        if (!mediaState) {
            return;
        }

        const placeholder = createEditorialMediaPlaceholderRow();
        wrapper.append(placeholder);
        mediaState.dom = {
            ...(mediaState.dom || {}),
            placeholder
        };
    });

    state.media.forEach(mediaState => {
        let mediaWrapper = mediaState.dom?.wrapper || null;
        let mediaElement = mediaState.dom?.mediaElement || null;
        if (!mediaWrapper || !mediaElement) {
            const created = createBlogMediaElement(mediaState.block, {
                imageClassName: 'terminal-editorial-media-asset terminal-inline-image',
                showControls: true,
                videoClassName: 'terminal-editorial-media-asset terminal-inline-video',
                wrapperClass: 'terminal-editorial-media'
            });
            mediaWrapper = created.wrapper;
            mediaElement = created.mediaElement;

            const startDrag = event => {
                if (event.button !== 0 && event.pointerType !== 'touch') {
                    return;
                }

                event.preventDefault();
                mediaState.docked = false;
                mediaState.isDragging = true;
                state.drag = {
                    mediaId: mediaState.id,
                    originX: mediaState.x,
                    originY: mediaState.y,
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY
                };
                mediaElement.setPointerCapture(event.pointerId);
                mediaWrapper.classList.add('is-dragging');
                syncAllBlogEditorialLayouts();
            };

            const moveDrag = event => {
                if (!state.drag || state.drag.mediaId !== mediaState.id || state.drag.pointerId !== event.pointerId) {
                    return;
                }

                const terminalWidth = resolveEditorialTerminalWidth();
                const dimensions = resolveEditorialMediaDimensions(mediaState, terminalWidth);
                mediaState.x = clampEditorialNumber(
                    state.drag.originX + (event.clientX - state.drag.startX),
                    0,
                    Math.max(0, terminalWidth - dimensions.width)
                );
                mediaState.y = clampEditorialNumber(
                    state.drag.originY + (event.clientY - state.drag.startY),
                    0,
                    Number.MAX_SAFE_INTEGER
                );
                syncAllBlogEditorialLayouts();
            };

            const endDrag = event => {
                if (!state.drag || state.drag.mediaId !== mediaState.id || state.drag.pointerId !== event.pointerId) {
                    return;
                }

                mediaWrapper.classList.remove('is-dragging');
                mediaState.isDragging = false;
                state.drag = null;
                if (mediaElement.hasPointerCapture(event.pointerId)) {
                    mediaElement.releasePointerCapture(event.pointerId);
                }
                syncAllBlogEditorialLayouts();
            };

            mediaElement.addEventListener('pointerdown', startDrag);
            mediaElement.addEventListener('pointermove', moveDrag);
            mediaElement.addEventListener('pointerup', endDrag);
            mediaElement.addEventListener('pointercancel', endDrag);
        }

        overlay?.append(mediaWrapper);
        mediaState.dom = {
            ...mediaState.dom,
            mediaElement,
            wrapper: mediaWrapper
        };
        ensureBlogEditorialMediaAspectRatio(container, line, state, mediaState, mediaElement);
    });

    container.append(wrapper);
    state.dom = {
        overlay,
        textRows,
        timestamp,
        wrapper
    };
}

function renderBlogEntryEditorial(container, line) {
    const state = getBlogEditorialState(container, line);
    mountBlogEditorialEntry(container, line, state);
    syncAllBlogEditorialLayouts();
}

window.addEventListener('resize', () => {
    if (editorialBlogResizeFrameId) {
        window.cancelAnimationFrame(editorialBlogResizeFrameId);
    }

    editorialBlogResizeFrameId = window.requestAnimationFrame(() => {
        editorialBlogResizeFrameId = 0;
        let shouldSyncEditorialLayouts = false;
        editorialBlogEntryContainers.forEach(container => {
            if (!container.isConnected) {
                disposeBlogEditorialState(container);
                return;
            }

            const line = container.__terminalRenderedObject;
            if (!line || line.type !== 'blog-entry' || !isTerminalEditorialModeActive()) {
                return;
            }

            shouldSyncEditorialLayouts = true;
        });

        if (shouldSyncEditorialLayouts) {
            syncAllBlogEditorialLayouts();
        }
    });
});

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

    resetTerminalLinePresentation(container);
    delete container.__terminalRenderedText;
    delete container.__terminalRenderedCommandText;
    delete container.__terminalCommandPromptSnapshot;
    container.__terminalRenderedObject = line;

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

    if (line.type === 'blog-entry') {
        if (isRootSessionActive()) {
            renderBlogEntryEditorial(container, line);
        } else {
            renderBlogEntryFlat(container, line);
        }
        return;
    }

    if (line.type === 'blog-entry-header') {
        const wrapper = document.createElement('div');
        wrapper.className = 'terminal-blog-entry-header';

        const timestamp = document.createElement('span');
        timestamp.className = 'terminal-blog-entry-timestamp';
        timestamp.textContent = line.text || '';
        wrapper.append(timestamp);
        appendDeletePostActions(wrapper, line);

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

    if (line.type === 'inline-image' || line.type === 'inline-video') {
        const isSafeSource = typeof window.isSafeBlogImageSource === 'function'
            ? window.isSafeBlogImageSource(line.src)
            : false;

        if (!isSafeSource) {
            container.textContent = line.type === 'inline-video'
                ? '[invalid embedded video]'
                : '[invalid embedded image]';
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'terminal-inline-image-wrapper';
        let mediaElement = null;
        if (line.type === 'inline-video') {
            const video = document.createElement('video');
            video.className = 'terminal-inline-video';
            video.src = line.src;
            video.controls = true;
            video.playsInline = true;
            video.preload = 'metadata';
            mediaElement = video;
            wrapper.append(video);
        } else {
            const image = document.createElement('img');
            image.className = 'terminal-inline-image';
            image.src = line.src;
            image.alt = line.alt || 'Embedded blog image';
            image.decoding = 'async';
            image.loading = 'lazy';
            mediaElement = image;
            wrapper.append(image);
        }
        appendDeleteMediaActions(wrapper, line, mediaElement);
        container.append(wrapper);
        return;
    }

    container.textContent = typeof line.text === 'string' ? line.text : String(line ?? '');
}

function renderOutputLine(container, line) {
    if (line && typeof line === 'object') {
        delete container.__terminalRenderedText;
        renderOutputObject(container, line);
        return;
    }

    delete container.__terminalRenderedObject;
    delete container.dataset.blogEntryTimestamp;
    delete container.__terminalRenderedCommandText;
    delete container.__terminalCommandPromptSnapshot;
    container.__terminalRenderedText = String(line ?? '');
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

function renderCommandLineEcho(container, commandLine, promptSnapshot = null) {
    const safeCommandLine = typeof commandLine === 'string' ? commandLine : String(commandLine ?? '');
    const frozenPromptSnapshot = clonePromptSnapshot(promptSnapshot);

    resetTerminalLinePresentation(container);
    container.replaceChildren();
    delete container.__terminalRenderedObject;
    delete container.__terminalRenderedText;
    delete container.dataset.blogEntryTimestamp;
    container.__terminalRenderedCommandText = safeCommandLine;
    container.__terminalCommandPromptSnapshot = frozenPromptSnapshot;

    const shell = document.createElement('div');
    shell.className = 'terminal-command-shell';
    container.append(shell);

    appendPromptWithSnapshot(shell, frozenPromptSnapshot);
    const commandText = document.createElement('span');
    commandText.className = 'terminal-command-text';
    shell.append(commandText);
    renderCommandEchoText(commandText, safeCommandLine);
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
    const inputShell = document.createElement('div');
    inputShell.className = 'input-line-shell';
    inputLine.append(inputShell);
    appendPrompt(inputShell);
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'terminal-input';
    input.id = 'command-input';
    input.autocomplete = 'off';
    inputShell.append(input);
    terminal.append(inputLine);
    terminal.scrollTop = 0;
    terminal.scrollLeft = 0;
    input.addEventListener("keydown", handleKeyDown);
    input.addEventListener("input", () => {
        if (isTerminalEditorialModeActive()) {
            syncAllBlogEditorialLayouts();
        }
    });
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

function scheduleTerminalViewportRestore(terminal, scrollTop, scrollLeft = 0) {
    if (!terminal) {
        return;
    }

    const restoreViewport = () => {
        const maximumScrollTop = Math.max(0, terminal.scrollHeight - terminal.clientHeight);
        const maximumScrollLeft = Math.max(0, terminal.scrollWidth - terminal.clientWidth);
        terminal.scrollTop = Math.min(Math.max(0, scrollTop), maximumScrollTop);
        terminal.scrollLeft = Math.min(Math.max(0, scrollLeft), maximumScrollLeft);
    };

    restoreViewport();
    if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
            restoreViewport();
            window.requestAnimationFrame(restoreViewport);
        });
    }
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
    const promptSnapshot = clonePromptSnapshot(getPromptSnapshot());
    terminal.insertBefore(commandDiv, inputLine);
    renderCommandLineEcho(commandDiv, commandLine, promptSnapshot);

    const parts = commandLine.split(" ");
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);
    const shouldPreserveViewport = (
        cmd === 'cat' &&
        typeof args[0] === 'string' &&
        args[0].trim().toLowerCase() === 'blog.txt' &&
        isRootSessionActive()
    );
    const previousScrollTop = terminal.scrollTop;
    const previousScrollLeft = terminal.scrollLeft;

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

    if (isTerminalEditorialModeActive()) {
        syncAllBlogEditorialLayouts();
    }

    document.getElementById("command-input").value = "";
    if (shouldPreserveViewport) {
        scheduleTerminalViewportRestore(terminal, previousScrollTop, previousScrollLeft);
        return;
    }

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
window.syncTerminalSessionAwareLines = syncTerminalSessionAwareLines;
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
