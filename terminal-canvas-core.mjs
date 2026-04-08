import { splitBannerWaveGlyphs } from './banner-wave-core.mjs';
import * as pretext from './pretext-browser.mjs';
import {
    layoutPreparedTerminalEditorialText,
    layoutPreparedTerminalText,
    prepareTerminalText,
    tokenizeTerminalText
} from './terminal-pretext-core.mjs';
import {
    advanceBinaryRainColumn,
    createBinaryRainColumns,
    getBinaryRainColumnFrame,
    shouldUseRootTerminalVisuals
} from './terminal-visuals-core.mjs';

const MONO_FONT_FAMILY = '"Courier New", Courier, monospace';
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
const DEFAULT_PROMPT_SNAPSHOT = Object.freeze({
    host: 'localhost',
    isGodlike: false,
    isRoot: false,
    mode: 'default',
    path: '/home/0x00C0DE/Unkn0wn',
    promptSymbol: '$',
    theme: 'default',
    user: 'guest'
});
const DEFAULT_VISITOR_STATS = Object.freeze({
    visits: 0,
    uniqueVisitors: 0,
    onSite: 0
});
const CURSOR_BLINK_INTERVAL_MS = 540;
const BACKGROUND_STEP_MS = 120;
const MEDIA_PLACEHOLDER_ASPECT_RATIO = 16 / 9;

const PALETTES = Object.freeze({
    default: {
        accent: '#ff6b78',
        background: '#000000',
        bannerFill: '#ff6b78',
        bannerGlow: '#ff6b78',
        bannerShadowFar: '#9a1c2d',
        bannerShadowNear: '#6a101c',
        block: 'rgba(12, 0, 1, 0.75)',
        border: 'rgba(255, 143, 153, 0.65)',
        command: '#ff4d4d',
        cursor: '#ff4d4d',
        helpCommand: '#fff1f1',
        helpSeparator: '#ff6b78',
        link: '#ff8585',
        linkUnderline: 'rgba(255, 133, 133, 0.92)',
        media: 'rgba(12, 0, 1, 0.75)',
        promptHost: '#ffb0b0',
        promptPath: '#ffd166',
        promptPunctuation: '#ff4d4d',
        promptUser: '#ff4d4d',
        scanline: 'rgba(0, 0, 0, 0.15)',
        scrollbarThumb: '#333333',
        scrollbarTrack: '#000000',
        text: '#ff6b78',
        textGlow: 'rgba(255, 214, 214, 0.72)',
        title: '#fff2f3',
        glow: 'rgba(85, 10, 16, 0.82)',
        widgetBackgroundBottom: 'rgba(10, 0, 1, 0.94)',
        widgetBackgroundTop: 'rgba(33, 0, 4, 0.96)',
        widgetDim: 'rgba(255, 179, 187, 0.16)',
        widgetInset: 'rgba(103, 13, 26, 0.95)',
        widgetLabel: '#ffb3bb',
        widgetLabelGlow: 'rgba(255, 95, 109, 0.35)',
        widgetOuterGlow: 'rgba(120, 15, 31, 0.18)',
        widgetValue: '#ff5f6d',
        widgetValueGlow: 'rgba(255, 95, 109, 0.45)'
    },
    root: {
        accent: '#ff5252',
        background: '#000000',
        bannerFill: '#ff6b78',
        bannerGlow: '#ff6b78',
        bannerShadowFar: '#9a1c2d',
        bannerShadowNear: '#6a101c',
        block: 'rgba(18, 0, 0, 0.76)',
        border: 'rgba(255, 84, 84, 0.32)',
        command: '#ffc0c0',
        cursor: '#ff5555',
        helpCommand: '#ffe4e4',
        helpSeparator: '#ff7575',
        link: '#ffe9e9',
        linkUnderline: 'rgba(255, 196, 196, 0.92)',
        media: 'rgba(24, 0, 0, 0.84)',
        promptHost: '#ff9b9b',
        promptPath: '#ffd2d2',
        promptPunctuation: '#ff6f6f',
        promptUser: '#ff3636',
        scanline: 'rgba(255, 255, 255, 0.05)',
        scrollbarThumb: 'rgba(255, 90, 90, 0.54)',
        scrollbarTrack: 'rgba(255, 90, 90, 0.14)',
        text: '#ff5962',
        textGlow: 'rgba(255, 214, 214, 0.72)',
        title: '#ffe3e3',
        glow: 'rgba(255, 22, 22, 0.18)'
    },
    godlike: {
        accent: '#ffd46f',
        background: '#060400',
        bannerFill: '#ffd98a',
        bannerGlow: 'rgba(255, 207, 84, 0.88)',
        bannerShadowFar: '#8b670d',
        bannerShadowNear: '#5b4208',
        block: 'rgba(28, 18, 2, 0.8)',
        border: 'rgba(255, 214, 118, 0.26)',
        command: '#ffe7bc',
        cursor: '#ffe08a',
        helpCommand: '#fff1cd',
        helpSeparator: '#ffd060',
        link: '#fff5dd',
        linkUnderline: 'rgba(255, 232, 174, 0.92)',
        media: 'rgba(40, 26, 4, 0.86)',
        promptHost: '#ffdd97',
        promptPath: '#fff0c2',
        promptPunctuation: '#ffcd5f',
        promptUser: '#ffd870',
        scanline: 'rgba(255, 241, 211, 0.05)',
        scrollbarThumb: 'rgba(255, 214, 118, 0.5)',
        scrollbarTrack: 'rgba(255, 214, 118, 0.12)',
        text: '#f7d78c',
        textGlow: 'rgba(255, 232, 182, 0.28)',
        title: '#fff7de',
        glow: 'rgba(184, 128, 30, 0.22)'
    },
    kali: {
        accent: '#a8c2ff',
        background: '#090d16',
        block: 'rgba(8, 12, 22, 0.78)',
        border: 'rgba(168, 194, 255, 0.24)',
        command: '#dce7ff',
        cursor: '#b9ceff',
        helpCommand: '#e8efff',
        helpSeparator: '#90adff',
        link: '#f4f7ff',
        linkUnderline: 'rgba(214, 225, 255, 0.92)',
        media: 'rgba(8, 12, 22, 0.84)',
        promptHost: '#bfd2ff',
        promptPath: '#ebf2ff',
        promptPunctuation: '#94b0ff',
        promptUser: '#d7e3ff',
        scanline: 'rgba(255, 255, 255, 0.04)',
        scrollbarThumb: 'rgba(168, 194, 255, 0.44)',
        scrollbarTrack: 'rgba(168, 194, 255, 0.12)',
        text: '#d8e2ff',
        textGlow: 'rgba(196, 214, 255, 0.18)',
        title: '#f7f9ff',
        glow: 'rgba(60, 86, 150, 0.26)'
    }
});

const app = {
    binaryColumns: [],
    blockId: 0,
    blocks: [],
    canvas: null,
    commandHistory: [],
    contentHeight: 0,
    ctx: null,
    dpr: 1,
    editorialMediaRects: [],
    frameId: 0,
    historyIndex: 0,
    inputValue: '',
    interactiveRegions: [],
    isBooted: false,
    lastBackgroundStep: 0,
    measureCanvas: null,
    measureCtx: null,
    mediaCache: new Map(),
    pointerDrag: null,
    scratchCanvas: null,
    scrollTop: 0,
    viewer: null,
    viewportHeight: 0,
    viewportWidth: 0
};

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

function round(value) {
    return Math.round(value);
}

function buildFont(fontSize, weight = '400') {
    return `${weight} ${fontSize}px ${MONO_FONT_FAMILY}`;
}

function extractFontSizePx(font, fallback = 16) {
    const match = String(font || '').match(/(\d+(?:\.\d+)?)px/);
    return match ? Number(match[1]) : fallback;
}

function getPromptSnapshot() {
    if (typeof window.getTerminalPromptSnapshot === 'function') {
        const snapshot = window.getTerminalPromptSnapshot();
        if (snapshot && typeof snapshot === 'object') {
            return {
                ...DEFAULT_PROMPT_SNAPSHOT,
                ...snapshot
            };
        }
    }

    return { ...DEFAULT_PROMPT_SNAPSHOT };
}

function clonePromptSnapshot(snapshot = null) {
    const source = snapshot && typeof snapshot === 'object' ? snapshot : getPromptSnapshot();
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

function getPalette(snapshot = getPromptSnapshot()) {
    if (snapshot.mode === 'kali') {
        return PALETTES.kali;
    }
    if (snapshot.isGodlike || String(snapshot.user || '').toLowerCase() === 'godlike') {
        return PALETTES.godlike;
    }
    if (snapshot.isRoot || String(snapshot.user || '').toLowerCase() === 'root') {
        return PALETTES.root;
    }
    return PALETTES.default;
}

function ensureMeasureContext() {
    if (!app.measureCanvas) {
        app.measureCanvas = document.createElement('canvas');
        app.measureCtx = app.measureCanvas.getContext('2d');
    }
    return app.measureCtx;
}

function measureTextWidth(text, font) {
    const ctx = ensureMeasureContext();
    ctx.font = font;
    return ctx.measureText(text).width;
}

function resolveMetrics() {
    const width = Math.max(320, app.viewportWidth || window.innerWidth || 1280);
    const narrow = width < 560;
    const fontSize = width < 440 ? 14 : width < 680 ? 15 : 18;
    const lineHeight = round(fontSize * (narrow ? 1.45 : 1.34));
    const paddingX = width < 480 ? 14 : width < 900 ? 18 : 24;
    const paddingY = width < 480 ? 14 : 18;
    const blockGap = width < 480 ? 8 : 10;
    const scrollbarWidth = 12;
    const contentWidth = Math.max(120, width - paddingX * 2 - scrollbarWidth);

    return {
        bannerSubtitleFont: buildFont(clamp(round(width * 0.0165), 18, 34), '700'),
        bannerTitleFont: buildFont(clamp(round(width * 0.072), 72, 144), '700'),
        blockGap,
        buttonFont: buildFont(clamp(fontSize - 1, 12, 17), '700'),
        commandFont: buildFont(fontSize, '400'),
        contentWidth,
        fontSize,
        helpGap: round(fontSize * 0.9),
        lineHeight,
        mediaMaxWidth: Math.min(contentWidth, 544),
        paddingX,
        paddingY,
        scrollbarWidth,
        subtitleFont: buildFont(clamp(round(fontSize * 1.1), 16, 24), '700'),
        textFont: buildFont(fontSize, '400'),
        titleFont: buildFont(clamp(round(fontSize * 1.9), 24, 40), '700'),
        viewerTop: round(fontSize * 2.8)
    };
}

function getButtonLayout(text, font) {
    return {
        font,
        text,
        width: measureTextWidth(text, font)
    };
}

function fitFontToWidth(text, font, width, minimumPx = 16, weight = '700') {
    const safeText = typeof text === 'string' ? text : String(text ?? '');
    let fontPx = extractFontSizePx(font, minimumPx);

    while (fontPx > minimumPx && measureTextWidth(safeText, buildFont(fontPx, weight)) > width) {
        fontPx -= 1;
    }

    return buildFont(fontPx, weight);
}

function measureGlyphRunWidth(glyphs, font, letterSpacing = 0) {
    if (!Array.isArray(glyphs) || glyphs.length === 0) {
        return 0;
    }

    return glyphs.reduce((total, glyph, index) => (
        total
        + measureTextWidth(glyph.text || '', font)
        + (index < glyphs.length - 1 ? letterSpacing : 0)
    ), 0);
}

function drawBannerGlyphRun(ctx, glyphs, originX, originY, font, palette, options = {}) {
    if (!Array.isArray(glyphs) || glyphs.length === 0) {
        return;
    }

    const fontPx = extractFontSizePx(font, 16);
    const letterSpacing = Number.isFinite(options.letterSpacing) ? options.letterSpacing : 0;
    const waveAmplitude = Number.isFinite(options.waveAmplitude) ? options.waveAmplitude : fontPx * 0.11;
    const phaseStep = Number.isFinite(options.phaseStep) ? options.phaseStep : 0.42;
    const periodMs = Number.isFinite(options.periodMs) ? options.periodMs : 3100;
    const nearShadowOffset = Number.isFinite(options.nearShadowOffset) ? options.nearShadowOffset : app.viewportWidth * 0.0012;
    const farShadowOffset = Number.isFinite(options.farShadowOffset) ? options.farShadowOffset : app.viewportWidth * 0.0024;
    const highlightBlur = Number.isFinite(options.highlightBlur) ? options.highlightBlur : app.viewportWidth * 0.0025;
    const glowBlur = Number.isFinite(options.glowBlur) ? options.glowBlur : app.viewportWidth * 0.007;
    const skewAmplitude = Number.isFinite(options.skewAmplitude) ? options.skewAmplitude : 0.05;
    const now = performance.now();
    const phaseBase = (now / periodMs) * Math.PI * 2;
    let cursorX = originX;

    glyphs.forEach((glyph, index) => {
        const text = glyph.text || '';
        const glyphWidth = measureTextWidth(text, font);
        const isWhitespace = /^\s+$/.test(text);
        const waveIndex = Number.isFinite(glyph.waveIndex) ? glyph.waveIndex : index;
        const waveOffset = glyph.isAnimated ? Math.sin(phaseBase + waveIndex * phaseStep) * waveAmplitude : 0;
        const skew = glyph.isAnimated ? Math.sin(phaseBase + waveIndex * phaseStep) * skewAmplitude : 0;

        if (!isWhitespace) {
            ctx.save();
            ctx.translate(cursorX, originY + waveOffset);
            ctx.transform(1, 0, skew, 1, 0, 0);
            ctx.font = font;
            ctx.textBaseline = 'top';
            ctx.globalAlpha = 1;
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;

            ctx.fillStyle = palette.bannerShadowFar || palette.promptPunctuation;
            ctx.fillText(text, farShadowOffset, farShadowOffset);

            ctx.fillStyle = palette.bannerShadowNear || palette.promptPunctuation;
            ctx.fillText(text, nearShadowOffset, nearShadowOffset);

            ctx.shadowColor = palette.bannerGlow || palette.accent;
            ctx.shadowBlur = glowBlur;
            ctx.fillStyle = palette.bannerFill || palette.accent;
            ctx.fillText(text, 0, 0);

            ctx.shadowColor = palette.title;
            ctx.shadowBlur = highlightBlur;
            ctx.fillText(text, 0, 0);

            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.fillStyle = palette.bannerFill || palette.accent;
            ctx.fillText(text, 0, 0);
            ctx.restore();
        }

        cursorX += glyphWidth + (index < glyphs.length - 1 ? letterSpacing : 0);
    });
}

function canManageBlogEntries() {
    return typeof window.canCurrentUserManageBlogEntries === 'function' && window.canCurrentUserManageBlogEntries();
}

function setDocumentFrame() {
    const background = getPalette().background;
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.documentElement.style.background = background;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.background = background;
    document.body.style.overflow = 'hidden';
}

function normalizeTextFilename(input) {
    if (typeof window.normalizeTerminalTextFilename === 'function') {
        return window.normalizeTerminalTextFilename(input);
    }

    const trimmed = typeof input === 'string' ? input.trim() : '';
    if (!trimmed) {
        return null;
    }

    const candidate = trimmed.toUpperCase().endsWith('.TXT') ? trimmed : `${trimmed}.txt`;
    return TEXT_FILE_LOOKUP.get(candidate.toUpperCase()) || null;
}

function buildPromptTokens(snapshot) {
    const safeSnapshot = clonePromptSnapshot(snapshot);
    const userRole = safeSnapshot.isGodlike ? 'prompt-godlike' : safeSnapshot.isRoot ? 'prompt-root' : 'prompt-user';
    const parts = [
        { role: userRole, text: safeSnapshot.user },
        { role: 'prompt-punctuation', text: '@' },
        { role: 'prompt-host', text: safeSnapshot.host },
        { role: 'prompt-punctuation', text: ':' },
        { role: 'prompt-path', text: safeSnapshot.path },
        { role: 'prompt-punctuation', text: `${safeSnapshot.promptSymbol} ` }
    ];
    let cursor = 0;
    return parts.map(part => {
        const token = {
            end: cursor + part.text.length,
            role: part.role,
            start: cursor,
            text: part.text,
            type: 'text'
        };
        cursor += part.text.length;
        return token;
    });
}

function getPromptWidth(snapshot, font) {
    const ctx = ensureMeasureContext();
    ctx.font = font;
    return buildPromptTokens(snapshot).reduce((width, token) => width + ctx.measureText(token.text).width, 0);
}

function buildTextToken(text, extra = {}) {
    const safeText = typeof text === 'string' ? text : String(text ?? '');
    return {
        ...extra,
        end: safeText.length,
        start: 0,
        text: safeText,
        type: 'text'
    };
}

function ensureSlot(block, slotName) {
    if (!block[slotName]) {
        block[slotName] = {
            key: null,
            value: null
        };
    }
    return block[slotName];
}

function ensurePrepared(block, slotName, key, options) {
    const slot = ensureSlot(block, slotName);
    if (slot.key === key && slot.value) {
        return slot.value;
    }
    slot.key = key;
    slot.value = prepareTerminalText(pretext, options);
    return slot.value;
}

function buildFragmentPlans(fragments, font) {
    const ctx = ensureMeasureContext();
    ctx.font = font;
    let cursorX = 0;
    const plans = [];

    (Array.isArray(fragments) ? fragments : []).forEach(fragment => {
        const text = typeof fragment?.text === 'string' ? fragment.text : '';
        if (!text) {
            return;
        }
        const width = ctx.measureText(text).width;
        plans.push({
            fragment,
            text,
            width,
            x: cursorX
        });
        cursorX += width;
    });

    return plans;
}

function resolveFragmentColor(fragment, palette, fallback) {
    if (fragment?.type === 'link') {
        return palette.link;
    }
    switch (fragment?.role) {
    case 'prompt-user':
    case 'prompt-root':
    case 'prompt-godlike':
        return palette.promptUser;
    case 'prompt-host':
        return palette.promptHost;
    case 'prompt-path':
        return palette.promptPath;
    case 'prompt-punctuation':
        return palette.promptPunctuation;
    case 'help-command':
        return palette.helpCommand;
    case 'help-separator':
        return palette.helpSeparator;
    case 'widget-label':
        return palette.widgetLabel || palette.text;
    case 'widget-value':
        return palette.widgetValue || palette.accent;
    case 'widget-dim':
        return palette.widgetDim || palette.text;
    default:
        return fallback || palette.text;
    }
}

function drawFragmentPlans(ctx, plans, originX, originY, lineHeight, font, palette, fallback) {
    ctx.font = font;
    ctx.textBaseline = 'top';
    ctx.shadowColor = palette.textGlow || 'transparent';
    ctx.shadowBlur = palette.textGlow ? Math.max(2, app.viewportWidth * 0.004) : 0;
    plans.forEach(plan => {
        ctx.fillStyle = resolveFragmentColor(plan.fragment, palette, fallback);
        ctx.fillText(plan.text, originX + plan.x, originY);
        if (plan.fragment?.type === 'link') {
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.strokeStyle = palette.linkUnderline;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(originX + plan.x, originY + lineHeight - 4);
            ctx.lineTo(originX + plan.x + plan.width, originY + lineHeight - 4);
            ctx.stroke();
            ctx.shadowColor = palette.textGlow || 'transparent';
            ctx.shadowBlur = palette.textGlow ? Math.max(2, app.viewportWidth * 0.004) : 0;
        }
    });
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
}

function buildTextLayout(block, text, width, font, lineHeight, options = {}) {
    const safeText = typeof text === 'string' ? text : String(text ?? '');
    const tokens = options.tokens || (
        options.tokenizeLinks === false
            ? (safeText ? [buildTextToken(safeText, options.tokenExtra)] : [])
            : tokenizeTerminalText(safeText, { normalizeTextFilename })
    );
    const cacheKey = JSON.stringify({
        font,
        text: tokens.map(token => ({
            href: token.href || '',
            newTab: Boolean(token.newTab),
            role: token.role || '',
            text: token.text || '',
            type: token.type || 'text'
        })),
        whiteSpace: options.whiteSpace || 'pre-wrap'
    });
    const prepared = ensurePrepared(
        block,
        options.slotName || '__text',
        cacheKey,
        {
            font,
            tokens,
            whiteSpace: options.whiteSpace || 'pre-wrap'
        }
    );
    const layout = layoutPreparedTerminalText(pretext, prepared, {
        lineHeight,
        maxWidth: width
    });
    const linePlans = (layout.lines.length > 0 ? layout.lines : [{ fragments: [] }]).map((line, index) => ({
        plans: buildFragmentPlans(line.fragments || [], font),
        y: index * lineHeight
    }));
    const hitRegions = [];
    linePlans.forEach(linePlan => {
        linePlan.plans.forEach(plan => {
            if (plan.fragment?.type !== 'link') {
                return;
            }
            hitRegions.push({
                action: 'link',
                data: plan.fragment,
                height: lineHeight,
                width: plan.width,
                x: plan.x,
                y: linePlan.y
            });
        });
    });

    return {
        height: Math.max(lineHeight, layout.height || linePlans.length * lineHeight || lineHeight),
        hitRegions,
        lineHeight,
        plans: linePlans,
        render(ctx, originX, originY, palette, fallback = null) {
            linePlans.forEach(linePlan => {
                drawFragmentPlans(ctx, linePlan.plans, originX, originY + linePlan.y, lineHeight, font, palette, fallback);
            });
        }
    };
}

function buildEditorialTextLayout(block, slotName, text, width, font, lineHeight, obstacles, options = {}) {
    const safeText = typeof text === 'string' ? text : String(text ?? '');
    if (!safeText) {
        return {
            height: lineHeight,
            hitRegions: [],
            plans: [],
            render() {},
            textHeight: lineHeight
        };
    }

    const tokens = options.tokens || (
        options.tokenizeLinks === false
            ? [buildTextToken(safeText, options.tokenExtra)]
            : tokenizeTerminalText(safeText, { normalizeTextFilename })
    );
    const cacheKey = JSON.stringify({
        font,
        text: tokens.map(token => ({
            href: token.href || '',
            newTab: Boolean(token.newTab),
            role: token.role || '',
            text: token.text || '',
            type: token.type || 'text'
        })),
        whiteSpace: options.whiteSpace || 'pre-wrap'
    });
    const prepared = ensurePrepared(block, slotName, cacheKey, {
        font,
        tokens,
        whiteSpace: options.whiteSpace || 'pre-wrap'
    });
    const layout = layoutPreparedTerminalEditorialText(pretext, prepared, {
        lineHeight,
        maxWidth: width,
        minSegmentWidth: options.minSegmentWidth || 18,
        obstacles
    });
    const linePlans = layout.lines.map(line => ({
        plans: buildFragmentPlans(line.fragments || [], font),
        x: line.x || 0,
        y: line.y || 0
    }));
    const hitRegions = [];
    linePlans.forEach(linePlan => {
        linePlan.plans.forEach(plan => {
            if (plan.fragment?.type !== 'link') {
                return;
            }
            hitRegions.push({
                action: 'link',
                data: plan.fragment,
                height: lineHeight,
                width: plan.width,
                x: linePlan.x + plan.x,
                y: linePlan.y
            });
        });
    });

    return {
        height: Math.max(lineHeight, Number(layout.textHeight) || Number(layout.height) || lineHeight),
        hitRegions,
        lineHeight,
        plans: linePlans,
        render(ctx, originX, originY, palette, fallback = null) {
            linePlans.forEach(linePlan => {
                drawFragmentPlans(ctx, linePlan.plans, originX + linePlan.x, originY + linePlan.y, lineHeight, font, palette, fallback);
            });
        },
        textHeight: Math.max(lineHeight, Number(layout.textHeight) || Number(layout.height) || lineHeight)
    };
}

function getLinePlanWidth(linePlan) {
    if (!linePlan || !Array.isArray(linePlan.plans) || linePlan.plans.length === 0) {
        return 0;
    }

    const lastPlan = linePlan.plans[linePlan.plans.length - 1];
    return (lastPlan?.x || 0) + (lastPlan?.width || 0);
}

function getLayoutPlanBounds(linePlans, lineHeight) {
    if (!Array.isArray(linePlans) || linePlans.length === 0) {
        return {
            height: lineHeight,
            maxX: 0,
            maxY: lineHeight,
            minX: 0,
            minY: 0,
            width: 0
        };
    }

    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = 0;
    let maxY = 0;
    linePlans.forEach(linePlan => {
        const lineX = Number.isFinite(linePlan?.x) ? linePlan.x : 0;
        const lineY = Number.isFinite(linePlan?.y) ? linePlan.y : 0;
        const lineWidth = getLinePlanWidth(linePlan);
        minX = Math.min(minX, lineX);
        minY = Math.min(minY, lineY);
        maxX = Math.max(maxX, lineX + lineWidth);
        maxY = Math.max(maxY, lineY + lineHeight);
    });

    return {
        height: Math.max(lineHeight, maxY - minY),
        maxX,
        maxY,
        minX: Number.isFinite(minX) ? minX : 0,
        minY: Number.isFinite(minY) ? minY : 0,
        width: Math.max(0, maxX - (Number.isFinite(minX) ? minX : 0))
    };
}

function hasGlobalEditorialObstacles(context = {}) {
    return Boolean(context.editorial && Array.isArray(context.globalObstacles) && context.globalObstacles.length > 0);
}

function getRelativeEditorialObstacles(context = {}, options = {}) {
    const blockTop = Number.isFinite(context.blockTop) ? context.blockTop : 0;
    const offsetY = Number.isFinite(options.offsetY) ? options.offsetY : 0;
    const excludeBlockId = typeof options.excludeBlockId === 'string' ? options.excludeBlockId : null;
    const source = Array.isArray(context.globalObstacles) ? context.globalObstacles : [];
    const obstacles = source
        .filter(obstacle => !(excludeBlockId && obstacle?.blockId === excludeBlockId))
        .map(obstacle => ({
            height: obstacle.height,
            width: obstacle.width,
            x: obstacle.x,
            y: obstacle.y
        }));
    return shiftObstacles(obstacles, blockTop + offsetY);
}

function layoutTextWithEditorialObstacles(block, slotName, text, width, font, lineHeight, context = {}, options = {}) {
    if (!hasGlobalEditorialObstacles(context)) {
        return buildTextLayout(block, text, width, font, lineHeight, {
            ...options,
            slotName
        });
    }

    return buildEditorialTextLayout(
        block,
        `${slotName}Editorial`,
        text,
        width,
        font,
        lineHeight,
        getRelativeEditorialObstacles(context, {
            excludeBlockId: options.excludeBlockId,
            offsetY: options.offsetY
        }),
        options
    );
}

function getCurrentVisitorStats() {
    if (typeof window.getCurrentVisitorStats === 'function') {
        const stats = window.getCurrentVisitorStats();
        if (stats && typeof stats === 'object') {
            return {
                visits: Number.isFinite(stats.visits) ? stats.visits : 0,
                uniqueVisitors: Number.isFinite(stats.uniqueVisitors) ? stats.uniqueVisitors : 0,
                onSite: Number.isFinite(stats.onSite) ? stats.onSite : 0
            };
        }
    }

    return { ...DEFAULT_VISITOR_STATS };
}

function formatVisitorLine(label, value) {
    const safeValue = Math.max(0, Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 0);
    return `${label} ${String(safeValue).padStart(7, '0')}`;
}

function formatVisitorDigits(value, width = 7) {
    const safeValue = Math.max(0, Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 0);
    return String(safeValue).padStart(width, '0');
}

function getVisitorDigitParts(value, width = 7) {
    const digits = formatVisitorDigits(value, width);
    const firstNonZeroIndex = digits.search(/[1-9]/);
    const zeroCutoff = firstNonZeroIndex === -1 ? digits.length - 1 : firstNonZeroIndex;

    return digits.split('').map((digit, index) => ({
        dim: index < zeroCutoff && digit === '0',
        text: digit
    }));
}

function normalizeMimeType(value) {
    return String(value || '').split(';')[0].trim().toLowerCase();
}

function inferMediaMimeType(src, fallback = '') {
    const normalizedFallback = normalizeMimeType(fallback);
    if (normalizedFallback) {
        return normalizedFallback;
    }

    const dataUrlMatch = String(src || '').match(/^data:([^;,]+)/i);
    if (dataUrlMatch) {
        return normalizeMimeType(dataUrlMatch[1]);
    }

    if (/\.gif(?:$|[?#])/i.test(String(src || ''))) {
        return 'image/gif';
    }

    return '';
}

function isAnimatedImageMimeType(mimeType) {
    return normalizeMimeType(mimeType) === 'image/gif';
}

function getMediaRenderSource(entry) {
    return entry?.animation?.frame || entry?.element || null;
}

function getAnimatedFrameDurationMs(frame) {
    const durationUs = Number(frame?.duration);
    if (durationUs > 0) {
        return Math.max(20, round(durationUs / 1000));
    }
    return 100;
}

function closeAnimatedMedia(entry) {
    if (!entry?.animation) {
        return;
    }

    if (entry.animation.frame && typeof entry.animation.frame.close === 'function') {
        entry.animation.frame.close();
    }
    if (entry.animation.decoder && typeof entry.animation.decoder.close === 'function') {
        entry.animation.decoder.close();
    }
    entry.animation = null;
}

function shouldDecodeAnimatedImage(entry) {
    return entry?.type === 'image'
        && typeof ImageDecoder === 'function'
        && isAnimatedImageMimeType(inferMediaMimeType(entry?.src, entry?.mimeType));
}

async function decodeAnimatedImageFrame(entry, frameIndex) {
    const animation = entry?.animation;
    if (!animation) {
        return;
    }
    if (animation.pending) {
        return animation.pending;
    }

    animation.pending = animation.decoder.decode({ frameIndex }).then(result => {
        const frame = result.image;
        const frameWidth = Number(frame?.displayWidth || frame?.codedWidth || 0);
        const frameHeight = Number(frame?.displayHeight || frame?.codedHeight || 0);
        if (frameWidth > 0 && frameHeight > 0) {
            entry.intrinsicWidth = frameWidth;
            entry.intrinsicHeight = frameHeight;
            entry.aspectRatio = frameWidth / frameHeight;
        }
        if (animation.frame && typeof animation.frame.close === 'function') {
            animation.frame.close();
        }
        animation.frame = frame;
        animation.nextFrameIndex = (frameIndex + 1) % animation.frameCount;
        animation.nextFrameAt = performance.now() + getAnimatedFrameDurationMs(frame);
        entry.ready = true;
    }).catch(error => {
        closeAnimatedMedia(entry);
        throw error;
    }).finally(() => {
        if (entry.animation === animation) {
            animation.pending = null;
        }
    });

    return animation.pending;
}

async function primeAnimatedImageEntry(entry) {
    if (!shouldDecodeAnimatedImage(entry) || entry.animation || entry.animationBootstrap) {
        return;
    }

    entry.animationBootstrap = fetch(entry.src).then(async response => {
        if (!response.ok) {
            throw new Error(`animated image fetch failed with status ${response.status}`);
        }

        const bytes = await response.arrayBuffer();
        const responseMimeType = normalizeMimeType(response.headers.get('content-type'));
        const mimeType = inferMediaMimeType(entry.src, responseMimeType || entry.mimeType);
        if (!isAnimatedImageMimeType(mimeType)) {
            return;
        }

        const decoder = new ImageDecoder({
            data: bytes,
            type: mimeType
        });
        await decoder.tracks.ready;
        const frameCount = Number(decoder.tracks.selectedTrack?.frameCount) || 1;
        if (frameCount <= 1) {
            decoder.close();
            return;
        }

        entry.mimeType = mimeType;
        entry.animation = {
            decoder,
            frame: null,
            frameCount,
            nextFrameAt: 0,
            nextFrameIndex: 0,
            pending: null
        };
        await decodeAnimatedImageFrame(entry, 0);
    }).catch(error => {
        console.warn('animated image decode unavailable', error);
        closeAnimatedMedia(entry);
    }).finally(() => {
        entry.animationBootstrap = null;
    });
}

function updateAnimatedMediaEntries(timestamp) {
    app.mediaCache.forEach(entry => {
        const animation = entry?.animation;
        if (!animation || animation.pending || timestamp < animation.nextFrameAt) {
            return;
        }
        void decodeAnimatedImageFrame(entry, animation.nextFrameIndex).catch(error => {
            console.warn('animated image frame decode failed', error);
        });
    });
}

function getMediaEntry(src, type = 'image', options = {}) {
    const cacheKey = `${type}:${src}`;
    const mimeType = inferMediaMimeType(src, options.mimeType);
    if (app.mediaCache.has(cacheKey)) {
        const existing = app.mediaCache.get(cacheKey);
        if (!existing.mimeType && mimeType) {
            existing.mimeType = mimeType;
            void primeAnimatedImageEntry(existing);
        }
        return existing;
    }

    const entry = {
        aspectRatio: MEDIA_PLACEHOLDER_ASPECT_RATIO,
        animation: null,
        animationBootstrap: null,
        element: null,
        intrinsicHeight: null,
        intrinsicWidth: null,
        mimeType,
        ready: false,
        src,
        type
    };

    if (type === 'video') {
        const video = document.createElement('video');
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.src = src;
        video.addEventListener('loadedmetadata', () => {
            if (video.videoWidth > 0 && video.videoHeight > 0) {
                entry.intrinsicWidth = video.videoWidth;
                entry.intrinsicHeight = video.videoHeight;
                entry.aspectRatio = video.videoWidth / video.videoHeight;
                entry.ready = true;
            }
        });
        video.addEventListener('canplay', () => {
            entry.ready = true;
            video.play().catch(() => {});
        });
        entry.element = video;
    } else {
        const image = new Image();
        image.decoding = 'async';
        image.crossOrigin = 'anonymous';
        image.src = src;
        image.addEventListener('load', () => {
            if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                entry.intrinsicWidth = image.naturalWidth;
                entry.intrinsicHeight = image.naturalHeight;
                entry.aspectRatio = image.naturalWidth / image.naturalHeight;
                entry.ready = true;
            }
        });
        entry.element = image;
        void primeAnimatedImageEntry(entry);
    }

    app.mediaCache.set(cacheKey, entry);
    return entry;
}

function getMediaDimensions(entry, maxWidth, preferredWidth = null) {
    const aspectRatio = entry?.aspectRatio && entry.aspectRatio > 0 ? entry.aspectRatio : MEDIA_PLACEHOLDER_ASPECT_RATIO;
    const widthCap = Math.max(1, Math.min(maxWidth, preferredWidth || maxWidth));
    const intrinsicWidth = Number.isFinite(entry?.intrinsicWidth) && entry.intrinsicWidth > 0
        ? entry.intrinsicWidth
        : null;
    const width = intrinsicWidth
        ? Math.min(widthCap, intrinsicWidth)
        : widthCap;

    return {
        height: Math.max(1, round(width / aspectRatio)),
        width
    };
}

function normalizeLinkTarget(target) {
    if (typeof target !== 'string' || !target) {
        return '#';
    }

    try {
        const parsed = new URL(target, window.location.href);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.toString();
        }
    } catch {
        return '#';
    }

    return '#';
}

function activateLink(fragment) {
    if (!fragment || typeof fragment !== 'object') {
        return;
    }

    const href = typeof fragment.href === 'string' ? fragment.href : '';
    if (href.startsWith('?command=')) {
        const params = new URLSearchParams(href.slice(1));
        const command = params.get('command');
        if (command) {
            executeCommand(command);
        }
        return;
    }

    const safeHref = normalizeLinkTarget(href);
    if (safeHref === '#') {
        return;
    }

    window.open(safeHref, fragment.newTab ? '_blank' : '_self', fragment.newTab ? 'noopener,noreferrer' : undefined);
}

function layoutCommandEcho(block, width, metrics, showCursor = false, context = {}) {
    const promptSnapshot = clonePromptSnapshot(block.promptSnapshot);
    if (hasGlobalEditorialObstacles(context)) {
        const promptTokens = buildPromptTokens(promptSnapshot);
        const commandText = typeof block.commandLine === 'string' ? block.commandLine : '';
        const tokens = commandText
            ? [...promptTokens, buildTextToken(commandText)]
            : promptTokens;
        const textLayout = buildEditorialTextLayout(
            block,
            showCursor ? '__inputEchoEditorial' : '__commandEchoEditorial',
            tokens.map(token => token.text || '').join(''),
            width,
            metrics.commandFont,
            metrics.lineHeight,
            getRelativeEditorialObstacles(context),
            {
                tokens,
                whiteSpace: 'pre-wrap'
            }
        );

        return {
            height: Math.max(metrics.lineHeight, textLayout.textHeight),
            hitRegions: textLayout.hitRegions,
            plans: textLayout.plans,
            render(ctx, originX, originY, palette) {
                textLayout.render(ctx, originX, originY, palette, palette.command);

                if (!showCursor) {
                    return;
                }

                const now = performance.now();
                if (Math.floor(now / CURSOR_BLINK_INTERVAL_MS) % 2 === 1) {
                    return;
                }

                const lastLine = textLayout.plans[textLayout.plans.length - 1] || { plans: [], x: 0, y: 0 };
                const lastFragment = lastLine.plans[lastLine.plans.length - 1] || null;
                const cursorX = originX + (lastLine.x || 0) + (lastFragment ? lastFragment.x + lastFragment.width : 0);
                const cursorY = originY + (lastLine.y || 0);
                ctx.fillStyle = palette.cursor;
                ctx.fillRect(cursorX, cursorY + 2, 2, metrics.lineHeight - 4);
            }
        };
    }

    const promptWidth = getPromptWidth(promptSnapshot, metrics.commandFont);
    const textLayout = buildTextLayout(block, block.commandLine || '', Math.max(72, width - promptWidth), metrics.commandFont, metrics.lineHeight, {
        slotName: showCursor ? '__inputEcho' : '__commandEcho',
        tokenizeLinks: false
    });
    const promptPlans = buildFragmentPlans(buildPromptTokens(promptSnapshot), metrics.commandFont);

    return {
        height: Math.max(metrics.lineHeight, textLayout.height),
        hitRegions: [],
        render(ctx, originX, originY, palette) {
            drawFragmentPlans(ctx, promptPlans, originX, originY, metrics.lineHeight, metrics.commandFont, palette, palette.command);
            textLayout.render(ctx, originX + promptWidth, originY, palette, palette.command);

            if (!showCursor) {
                return;
            }

            const now = performance.now();
            if (Math.floor(now / CURSOR_BLINK_INTERVAL_MS) % 2 === 1) {
                return;
            }

            const lineCount = Math.max(1, Math.ceil(textLayout.height / metrics.lineHeight));
            const lastLine = textLayout.plans[lineCount - 1] || { plans: [] };
            const lastFragment = lastLine.plans[lastLine.plans.length - 1] || null;
            const cursorX = originX + promptWidth + (lastFragment ? lastFragment.x + lastFragment.width : 0);
            const cursorY = originY + (lineCount - 1) * metrics.lineHeight;
            ctx.fillStyle = palette.cursor;
            ctx.fillRect(cursorX, cursorY + 2, 2, metrics.lineHeight - 4);
        }
    };
}

function buildBannerGlyphLines(linePlans) {
    let nextWaveIndex = 0;
    return (Array.isArray(linePlans) ? linePlans : []).map(linePlan => {
        const lineText = (Array.isArray(linePlan?.plans) ? linePlan.plans : []).map(plan => plan.text || '').join('');
        const glyphs = splitBannerWaveGlyphs(lineText).map(glyph => {
            if (!glyph.isAnimated) {
                return glyph;
            }
            const nextGlyph = {
                ...glyph,
                waveIndex: nextWaveIndex
            };
            nextWaveIndex += 1;
            return nextGlyph;
        });
        return {
            glyphs,
            x: Number.isFinite(linePlan?.x) ? linePlan.x : 0,
            y: Number.isFinite(linePlan?.y) ? linePlan.y : 0
        };
    });
}

function layoutBanner(block, width, metrics, context = {}) {
    const titleText = block.data.title || '';
    const titleFont = fitFontToWidth(titleText, metrics.bannerTitleFont, width, 34, '700');
    const titleFontPx = extractFontSizePx(titleFont, extractFontSizePx(metrics.bannerTitleFont, metrics.fontSize * 3.8));
    const titleLetterSpacing = Math.max(0, round(titleFontPx * 0.06));
    const subtitleText = block.data.subtitle || '';
    const subtitleFont = fitFontToWidth(subtitleText, metrics.bannerSubtitleFont, width, 16, '700');
    const subtitleFontPx = extractFontSizePx(subtitleFont, extractFontSizePx(metrics.bannerSubtitleFont, metrics.lineHeight));
    const subtitleLetterSpacing = Math.max(0, round(subtitleFontPx * 0.04));
    const subtitleGap = subtitleText ? Math.max(2, round(app.viewportWidth * 0.0025)) : 0;

    if (hasGlobalEditorialObstacles(context)) {
        const titleLayout = buildEditorialTextLayout(
            block,
            '__bannerTitleEditorial',
            titleText,
            width,
            titleFont,
            metrics.lineHeight,
            getRelativeEditorialObstacles(context),
            {
                minSegmentWidth: 132,
                tokenizeLinks: false
            }
        );
        const titleGlyphLines = buildBannerGlyphLines(titleLayout.plans);
        const titleHeight = Math.max(titleLayout.textHeight, metrics.lineHeight * 2);
        const subtitleLayout = subtitleText
            ? buildEditorialTextLayout(
                block,
                '__bannerSubtitleEditorial',
                subtitleText,
                width,
                subtitleFont,
                metrics.lineHeight,
                getRelativeEditorialObstacles(context, {
                    offsetY: titleHeight + subtitleGap
                }),
                {
                    minSegmentWidth: 96,
                    tokenizeLinks: false
                }
            )
            : null;
        const subtitleGlyphLines = subtitleLayout ? buildBannerGlyphLines(subtitleLayout.plans) : [];
        const subtitleHeight = subtitleLayout ? subtitleLayout.textHeight : 0;

        return {
            height: titleHeight + (subtitleLayout ? subtitleHeight + subtitleGap : 0),
            hitRegions: [],
            render(ctx, originX, originY, palette) {
                titleGlyphLines.forEach(line => {
                    drawBannerGlyphRun(ctx, line.glyphs, originX + line.x, originY + line.y, titleFont, palette, {
                        glowBlur: app.viewportWidth * 0.007,
                        highlightBlur: app.viewportWidth * 0.0025,
                        letterSpacing: titleLetterSpacing,
                        nearShadowOffset: app.viewportWidth * 0.0012,
                        farShadowOffset: app.viewportWidth * 0.0024,
                        skewAmplitude: 0.05,
                        waveAmplitude: titleFontPx * 0.11
                    });
                });
                if (!subtitleLayout) {
                    return;
                }
                subtitleGlyphLines.forEach(line => {
                    drawBannerGlyphRun(ctx, line.glyphs, originX + round(app.viewportWidth * 0.002) + line.x, originY + titleHeight + subtitleGap + line.y, subtitleFont, palette, {
                        glowBlur: app.viewportWidth * 0.0045,
                        highlightBlur: app.viewportWidth * 0.0016,
                        letterSpacing: subtitleLetterSpacing,
                        nearShadowOffset: app.viewportWidth * 0.0008,
                        farShadowOffset: app.viewportWidth * 0.0016,
                        skewAmplitude: 0.036,
                        waveAmplitude: subtitleFontPx * 0.11
                    });
                });
            }
        };
    }

    const titleGlyphs = splitBannerWaveGlyphs(titleText);
    const titleHeight = Math.max(metrics.lineHeight * 2, round(titleFontPx * 0.88) + round(app.viewportWidth * 0.008));
    const subtitleGlyphs = splitBannerWaveGlyphs(subtitleText);
    const subtitleHeight = subtitleText ? Math.max(metrics.lineHeight, round(subtitleFontPx * 1) + round(app.viewportWidth * 0.003)) : 0;

    return {
        height: titleHeight + (subtitleText ? subtitleHeight + subtitleGap : 0),
        hitRegions: [],
        render(ctx, originX, originY, palette) {
            drawBannerGlyphRun(ctx, titleGlyphs, originX, originY, titleFont, palette, {
                glowBlur: app.viewportWidth * 0.007,
                highlightBlur: app.viewportWidth * 0.0025,
                letterSpacing: titleLetterSpacing,
                nearShadowOffset: app.viewportWidth * 0.0012,
                farShadowOffset: app.viewportWidth * 0.0024,
                skewAmplitude: 0.05,
                waveAmplitude: titleFontPx * 0.11
            });
            if (subtitleText) {
                drawBannerGlyphRun(ctx, subtitleGlyphs, originX + round(app.viewportWidth * 0.002), originY + titleHeight + subtitleGap, subtitleFont, palette, {
                    glowBlur: app.viewportWidth * 0.0045,
                    highlightBlur: app.viewportWidth * 0.0016,
                    letterSpacing: subtitleLetterSpacing,
                    nearShadowOffset: app.viewportWidth * 0.0008,
                    farShadowOffset: app.viewportWidth * 0.0016,
                    skewAmplitude: 0.036,
                    waveAmplitude: subtitleFontPx * 0.11
                });
            }
        }
    };
}

function layoutHelpEntry(block, width, metrics, context = {}) {
    const commandText = String(block.data.command || '');
    const separatorText = ' - ';
    if (hasGlobalEditorialObstacles(context)) {
        const tokens = [
            buildTextToken(commandText, { role: 'help-command' }),
            buildTextToken(separatorText, { role: 'help-separator' }),
            buildTextToken(block.data.description || '')
        ];
        return buildEditorialTextLayout(
            block,
            '__helpEditorial',
            `${commandText}${separatorText}${block.data.description || ''}`,
            width,
            metrics.textFont,
            metrics.lineHeight,
            getRelativeEditorialObstacles(context),
            {
                tokens
            }
        );
    }

    const commandWidth = Math.max(
        measureTextWidth('M'.repeat(Math.max(commandText.length, Number(block.data.commandWidth) || commandText.length)), metrics.textFont),
        measureTextWidth(commandText, metrics.textFont)
    );
    const separatorWidth = measureTextWidth(separatorText, metrics.textFont);
    const descriptionWidth = width - commandWidth - separatorWidth - metrics.helpGap;
    if (descriptionWidth < width * 0.35) {
        return buildTextLayout(block, `${commandText}${separatorText}${block.data.description || ''}`, width, metrics.textFont, metrics.lineHeight, {
            slotName: '__helpCollapsed'
        });
    }

    const description = buildTextLayout(block, block.data.description || '', descriptionWidth, metrics.textFont, metrics.lineHeight, {
        slotName: '__helpDescription',
        tokenizeLinks: false
    });

    return {
        height: Math.max(metrics.lineHeight, description.height),
        hitRegions: description.hitRegions.map(region => ({
            ...region,
            x: commandWidth + separatorWidth + metrics.helpGap + region.x
        })),
        render(ctx, originX, originY, palette) {
            ctx.font = metrics.textFont;
            ctx.textBaseline = 'top';
            ctx.fillStyle = palette.helpCommand;
            ctx.fillText(commandText, originX, originY);
            ctx.fillStyle = palette.helpSeparator;
            ctx.fillText(separatorText, originX + commandWidth + metrics.helpGap * 0.35, originY);
            description.render(ctx, originX + commandWidth + separatorWidth + metrics.helpGap, originY, palette, palette.text);
        }
    };
}

function buildVisitorRowTokens(label, value) {
    return [
        buildTextToken(`${label} `, { role: 'widget-label' }),
        ...getVisitorDigitParts(value).map(part => buildTextToken(part.text, {
            role: part.dim ? 'widget-dim' : 'widget-value'
        }))
    ];
}

function layoutVisitorWidget(block, width, metrics, context = {}) {
    const stats = block.data.stats || getCurrentVisitorStats();
    const rows = [
        { label: 'Visits:', value: stats.visits },
        { label: 'Uniq. Visitors:', value: stats.uniqueVisitors },
        { label: 'On-site:', value: stats.onSite }
    ];
    const labelFont = buildFont(clamp(metrics.fontSize + 1, 16, 20), '700');
    const valueFont = labelFont;
    const rowHeight = Math.max(metrics.lineHeight, round(extractFontSizePx(labelFont, metrics.fontSize) * 1.08));
    const labelWidth = Math.max(...rows.map(row => measureTextWidth(row.label, labelFont)));
    const valueWidth = measureTextWidth('0000000', valueFont);
    const boxWidth = Math.max(250, Math.min(width, round(labelWidth + valueWidth + 44)));

    if (hasGlobalEditorialObstacles(context)) {
        const paddingX = 10;
        const paddingTop = 8;
        const paddingBottom = 8;
        let cursorY = paddingTop;
        const rowLayouts = rows.map((row, index) => {
            const layout = buildEditorialTextLayout(
                block,
                `__visitorWidgetEditorial${index}`,
                `${row.label} ${formatVisitorDigits(row.value)}`,
                width,
                labelFont,
                rowHeight,
                getRelativeEditorialObstacles(context, {
                    offsetY: cursorY
                }),
                {
                    minSegmentWidth: 84,
                    tokens: buildVisitorRowTokens(row.label, row.value)
                }
            );
            const result = {
                bounds: getLayoutPlanBounds(layout.plans, rowHeight),
                layout,
                y: cursorY
            };
            cursorY += layout.textHeight;
            return result;
        });
        const aggregateBounds = rowLayouts.reduce((union, row) => {
            const top = row.y + row.bounds.minY;
            const bottom = row.y + row.bounds.maxY;
            return {
                maxX: Math.max(union.maxX, row.bounds.maxX),
                maxY: Math.max(union.maxY, bottom),
                minX: Math.min(union.minX, row.bounds.minX),
                minY: Math.min(union.minY, top)
            };
        }, {
            maxX: 0,
            maxY: paddingTop,
            minX: Number.POSITIVE_INFINITY,
            minY: paddingTop
        });
        const safeMinX = Number.isFinite(aggregateBounds.minX) ? aggregateBounds.minX : 0;
        const boxLeft = Math.max(0, safeMinX - paddingX);
        const boxTop = Math.max(0, aggregateBounds.minY - paddingTop);
        const boxRight = aggregateBounds.maxX + paddingX;
        const boxBottom = aggregateBounds.maxY + paddingBottom;
        const widgetWidth = Math.max(140, boxRight - boxLeft);
        const widgetHeight = Math.max(rowHeight + paddingTop + paddingBottom, boxBottom - boxTop);

        return {
            height: Math.max(widgetHeight, cursorY + paddingBottom),
            hitRegions: [],
            render(ctx, originX, originY, palette) {
                const background = ctx.createLinearGradient(originX + boxLeft, originY + boxTop, originX + boxLeft, originY + boxTop + widgetHeight);
                background.addColorStop(0, palette.widgetBackgroundTop || palette.block);
                background.addColorStop(1, palette.widgetBackgroundBottom || palette.block);
                ctx.shadowColor = palette.widgetOuterGlow || 'transparent';
                ctx.shadowBlur = 8;
                ctx.fillStyle = background;
                ctx.fillRect(originX + boxLeft, originY + boxTop, widgetWidth, widgetHeight);
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.strokeStyle = palette.border;
                ctx.lineWidth = 1;
                ctx.strokeRect(originX + boxLeft + 0.5, originY + boxTop + 0.5, widgetWidth - 1, widgetHeight - 1);
                ctx.strokeStyle = palette.widgetInset || palette.border;
                ctx.strokeRect(originX + boxLeft + 1.5, originY + boxTop + 1.5, widgetWidth - 3, widgetHeight - 3);

                rowLayouts.forEach(row => {
                    row.layout.render(ctx, originX, originY + row.y, palette);
                });
            }
        };
    }

    return {
        height: 12 + rows.length * rowHeight + 10,
        hitRegions: [],
        render(ctx, originX, originY, palette) {
            const background = ctx.createLinearGradient(originX, originY, originX, originY + 12 + rows.length * rowHeight + 10);
            background.addColorStop(0, palette.widgetBackgroundTop || palette.block);
            background.addColorStop(1, palette.widgetBackgroundBottom || palette.block);
            ctx.shadowColor = palette.widgetOuterGlow || 'transparent';
            ctx.shadowBlur = 8;
            ctx.fillStyle = background;
            ctx.fillRect(originX, originY, boxWidth, 12 + rows.length * rowHeight + 10);
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.strokeStyle = palette.border;
            ctx.lineWidth = 1;
            ctx.strokeRect(originX + 0.5, originY + 0.5, boxWidth - 1, 12 + rows.length * rowHeight + 9);
            ctx.strokeStyle = palette.widgetInset || palette.border;
            ctx.strokeRect(originX + 1.5, originY + 1.5, boxWidth - 3, 12 + rows.length * rowHeight + 7);

            rows.forEach((row, index) => {
                const baselineY = originY + 8 + index * rowHeight;
                const valueX = originX + boxWidth - 12 - valueWidth;
                ctx.font = labelFont;
                ctx.textBaseline = 'top';
                ctx.shadowColor = palette.widgetLabelGlow || palette.textGlow || 'transparent';
                ctx.shadowBlur = 3;
                ctx.fillStyle = palette.widgetLabel || palette.text;
                ctx.fillText(row.label, originX + 10, baselineY);

                let digitX = valueX;
                ctx.font = valueFont;
                getVisitorDigitParts(row.value).forEach(part => {
                    ctx.shadowColor = part.dim ? 'transparent' : (palette.widgetValueGlow || palette.textGlow || 'transparent');
                    ctx.shadowBlur = part.dim ? 0 : 6;
                    ctx.fillStyle = part.dim ? (palette.widgetDim || palette.text) : (palette.widgetValue || palette.accent);
                    ctx.fillText(part.text, digitX, baselineY);
                    digitX += measureTextWidth(part.text, valueFont);
                });
            });
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
        }
    };
}

function layoutStandaloneMedia(block, metrics) {
    const type = block.data.type === 'inline-video' ? 'video' : 'image';
    const entry = getMediaEntry(block.data.src, type, { mimeType: block.data.mimeType });
    const dimensions = getMediaDimensions(entry, metrics.mediaMaxWidth);
    const deleteButton = canManageBlogEntries() && block.data?.deletable
        ? getButtonLayout('[delete media]', metrics.buttonFont)
        : null;
    const buttonGap = deleteButton ? 8 : 0;

    return {
        height: dimensions.height + (deleteButton ? metrics.lineHeight + buttonGap : 0),
        hitRegions: [
            ...(deleteButton ? [{
                action: 'delete-media',
                data: block.data,
                height: metrics.lineHeight,
                width: deleteButton.width,
                x: 0,
                y: dimensions.height + buttonGap
            }] : [])
        ],
        render(ctx, originX, originY, palette) {
            ctx.fillStyle = palette.media;
            ctx.strokeStyle = palette.border;
            ctx.lineWidth = 1;
            ctx.fillRect(originX, originY, dimensions.width, dimensions.height);
            ctx.strokeRect(originX + 0.5, originY + 0.5, dimensions.width - 1, dimensions.height - 1);
            const source = getMediaRenderSource(entry);
            if (entry?.ready && source) {
                try {
                    ctx.drawImage(source, originX, originY, dimensions.width, dimensions.height);
                } catch {
                    // Ignore transient media draw issues.
                }
            } else {
                ctx.font = metrics.textFont;
                ctx.textBaseline = 'middle';
                ctx.fillStyle = palette.text;
                ctx.fillText(type === 'video' ? '[video loading]' : '[image loading]', originX + 12, originY + dimensions.height / 2);
            }

            if (deleteButton) {
                ctx.font = deleteButton.font;
                ctx.textBaseline = 'top';
                ctx.fillStyle = palette.accent;
                ctx.fillText(deleteButton.text, originX, originY + dimensions.height + buttonGap);
            }
        }
    };
}

function getEditorialMediaRects(block, width, metrics, headerHeight, blockTop = 0) {
    const segments = Array.isArray(block.data?.blocks) ? block.data.blocks : [];
    if (!block.editorialMediaState) {
        block.editorialMediaState = new Map();
    }

    let cursorY = headerHeight + metrics.blockGap;
    const mediaRects = [];
    segments.forEach((segment, segmentIndex) => {
        if (segment.type === 'blog-entry-text-block') {
            const lines = Array.isArray(segment.lines) ? segment.lines : [''];
            lines.forEach((lineText, lineIndex) => {
                if (!lineText) {
                    cursorY += metrics.lineHeight;
                    return;
                }
                const layout = buildTextLayout(block, lineText, width, metrics.textFont, metrics.lineHeight, {
                    slotName: `__blogEditorialSeed${segmentIndex}-${lineIndex}`
                });
                cursorY += layout.height;
            });
            cursorY += metrics.blockGap;
            return;
        }

        if (segment.type !== 'inline-image' && segment.type !== 'inline-video') {
            return;
        }

        const id = `${segment.imageKey || segment.src || `media-${segmentIndex}`}`;
        const type = segment.type === 'inline-video' ? 'video' : 'image';
        const entry = getMediaEntry(segment.src, type, { mimeType: segment.mimeType });
        const dimensions = getMediaDimensions(entry, metrics.mediaMaxWidth);
        const deleteButton = canManageBlogEntries() && segment?.deletable
            ? getButtonLayout('[delete media]', metrics.buttonFont)
            : null;
        const deleteGap = deleteButton ? 8 : 0;
        const existing = block.editorialMediaState.get(id);
        const maxX = Math.max(0, width - dimensions.width);
        const isPinned = Boolean(existing?.pinned);
        const anchorY = cursorY;
        const rect = {
            anchorY,
            block: segment,
            deleteButton,
            deleteGap,
            entry,
            height: dimensions.height,
            id,
            type,
            width: dimensions.width,
            x: isPinned && Number.isFinite(existing?.x)
                ? clamp(existing.x, 0, maxX)
                : 0,
            y: isPinned && Number.isFinite(existing?.y)
                ? Math.max(0, existing.y)
                : blockTop + anchorY
        };

        mediaRects.push(rect);
        block.editorialMediaState.set(id, {
            pinned: isPinned,
            x: rect.x,
            y: rect.y
        });
        cursorY += rect.height + (deleteButton ? metrics.lineHeight + deleteGap : 0) + metrics.blockGap;
    });

    return mediaRects;
}

function shiftObstacles(obstacles, deltaY) {
    return obstacles.map(obstacle => ({
        ...obstacle,
        y: obstacle.y - deltaY
    })).filter(obstacle => obstacle.y + obstacle.height > -64);
}

function layoutBlogEntry(block, width, metrics, editorial, context = {}) {
    const children = [];
    let cursorY = 0;
    const blockTop = Number.isFinite(context.blockTop) ? context.blockTop : 0;
    const deleteEntryButton = canManageBlogEntries() && block.data?.deletable
        ? getButtonLayout('[delete post]', metrics.buttonFont)
        : null;
    const flatHeader = buildTextLayout(block, block.data.text || '', width, metrics.textFont, metrics.lineHeight, {
        slotName: '__blogHeaderFlat',
        tokenizeLinks: false
    });
    const mediaRects = editorial ? getEditorialMediaRects(block, width, metrics, flatHeader.height, blockTop) : [];
    const localObstacleRects = mediaRects.map(rect => ({
        height: rect.height + 10,
        width: rect.width + 10,
        x: rect.x - 5,
        y: rect.y - blockTop - 5
    }));
    const obstacleRects = editorial
        ? [
            ...getRelativeEditorialObstacles(context, {
                excludeBlockId: block.id
            }),
            ...localObstacleRects
        ]
        : localObstacleRects;
    const header = editorial
        ? buildEditorialTextLayout(block, '__blogHeaderEditorial', block.data.text || '', width, metrics.textFont, metrics.lineHeight, shiftObstacles(obstacleRects, cursorY), {
            tokenizeLinks: false
        })
        : flatHeader;

    children.push({ layout: header, x: 0, y: cursorY });
    cursorY += (editorial ? header.textHeight : header.height) + metrics.blockGap;

    (Array.isArray(block.data.blocks) ? block.data.blocks : []).forEach((segment, segmentIndex) => {
        if (segment.type === 'blog-entry-text-block') {
            const lines = Array.isArray(segment.lines) ? segment.lines : [''];
            lines.forEach((lineText, lineIndex) => {
                if (!lineText) {
                    cursorY += metrics.lineHeight;
                    return;
                }
                const layout = editorial
                    ? buildEditorialTextLayout(block, `__blogEditorial${segmentIndex}-${lineIndex}`, lineText, width, metrics.textFont, metrics.lineHeight, shiftObstacles(obstacleRects, cursorY))
                    : buildTextLayout(block, lineText, width, metrics.textFont, metrics.lineHeight, {
                        slotName: `__blogFlat${segmentIndex}-${lineIndex}`
                    });
                children.push({ layout, x: 0, y: cursorY });
                cursorY += editorial ? layout.textHeight : layout.height;
            });
            cursorY += metrics.blockGap;
            return;
        }

        if (!editorial && (segment.type === 'inline-image' || segment.type === 'inline-video')) {
            const mediaLayout = layoutStandaloneMedia({ ...block, data: segment }, metrics);
            children.push({ layout: mediaLayout, x: 0, y: cursorY });
            cursorY += mediaLayout.height + metrics.blockGap;
        }
    });

    const hitRegions = [];
    children.forEach(child => {
        child.layout.hitRegions.forEach(region => {
            hitRegions.push({
                ...region,
                x: child.x + region.x,
                y: child.y + region.y
            });
        });
    });

    const contentBottom = Math.max(
        cursorY,
        ...[0, ...mediaRects.map(rect => rect.anchorY + rect.height + (rect.deleteButton ? metrics.lineHeight + rect.deleteGap : 0))]
    );
    const deleteEntryGap = deleteEntryButton ? Math.max(3, round(metrics.lineHeight * 0.18)) : 0;
    const deleteEntryY = deleteEntryButton ? contentBottom + deleteEntryGap : 0;

    if (deleteEntryButton) {
        hitRegions.push({
            action: 'delete-entry',
            data: {
                entryTimestamp: block.data.entryTimestamp,
                line: block.data
            },
            height: metrics.lineHeight,
            width: deleteEntryButton.width,
            x: 0,
            y: deleteEntryY
        });
    }

    return {
        editorialMediaRects: editorial ? mediaRects : [],
        height: deleteEntryButton ? deleteEntryY + metrics.lineHeight : contentBottom,
        hitRegions,
        render(ctx, originX, originY, palette) {
            children.forEach(child => {
                child.layout.render(ctx, originX + child.x, originY + child.y, palette);
            });

            if (deleteEntryButton) {
                ctx.font = deleteEntryButton.font;
                ctx.textBaseline = 'top';
                ctx.fillStyle = palette.accent;
                ctx.fillText(deleteEntryButton.text, originX, originY + deleteEntryY);
            }

        }
    };
}

function layoutTextLink(block, width, metrics, context = {}) {
    const prefix = typeof block.data.prefix === 'string' ? block.data.prefix : '';
    const text = block.data.text || block.data.href || '';
    const tokens = [];
    let cursor = 0;
    if (prefix) {
        tokens.push({
            end: cursor + prefix.length,
            start: cursor,
            text: prefix,
            type: 'text'
        });
        cursor += prefix.length;
    }
    tokens.push({
        end: cursor + text.length,
        href: block.data.href,
        newTab: Boolean(block.data.newTab),
        start: cursor,
        text,
        type: 'link'
    });
    return hasGlobalEditorialObstacles(context)
        ? buildEditorialTextLayout(block, '__textLinkEditorial', `${prefix}${text}`, width, metrics.textFont, metrics.lineHeight, getRelativeEditorialObstacles(context), {
            tokens
        })
        : buildTextLayout(block, `${prefix}${text}`, width, metrics.textFont, metrics.lineHeight, {
            slotName: '__textLink',
            tokens
        });
}

function isEditorialModeActive() {
    const snapshot = getPromptSnapshot();
    return Boolean(snapshot.isRoot || String(snapshot.user || '').toLowerCase() === 'root');
}

function layoutOutputBlock(block, width, metrics, context = {}) {
    if (block.kind === 'command') {
        return layoutCommandEcho(block, width, metrics, false, context);
    }

    if (typeof block.data === 'string') {
        return layoutTextWithEditorialObstacles(block, '__plainOutput', block.data, width, metrics.textFont, metrics.lineHeight, context);
    }

    if (!block.data || typeof block.data !== 'object') {
        return layoutTextWithEditorialObstacles(block, '__unknownOutput', String(block.data ?? ''), width, metrics.textFont, metrics.lineHeight, context, {
            tokenizeLinks: false
        });
    }

    switch (block.data.type) {
    case 'banner':
        return layoutBanner(block, width, metrics, context);
    case 'blog-entry':
        return layoutBlogEntry(block, width, metrics, isEditorialModeActive(), context);
    case 'blog-entry-header':
    case 'blog-entry-text':
        return layoutTextWithEditorialObstacles(block, '__blogEntryText', block.data.text || '', width, metrics.textFont, metrics.lineHeight, context);
    case 'help-entry':
        return layoutHelpEntry(block, width, metrics, context);
    case 'inline-image':
    case 'inline-video':
        return layoutStandaloneMedia(block, metrics);
    case 'text-link':
        return layoutTextLink(block, width, metrics, context);
    case 'visitor-widget':
        return layoutVisitorWidget(block, width, metrics, context);
    default:
        return layoutTextWithEditorialObstacles(
            block,
            '__defaultObjectOutput',
            typeof block.data.text === 'string' ? block.data.text : String(block.data ?? ''),
            width,
            metrics.textFont,
            metrics.lineHeight,
            context
        );
    }
}

function buildBlock(kind, data, extra = {}) {
    return {
        data,
        id: `block-${app.blockId += 1}`,
        kind,
        promptSnapshot: extra.promptSnapshot ? clonePromptSnapshot(extra.promptSnapshot) : null
    };
}

function refreshBinaryColumns() {
    const snapshot = getPromptSnapshot();
    if (!shouldUseRootTerminalVisuals(snapshot)) {
        app.binaryColumns = [];
        return;
    }

    app.binaryColumns = createBinaryRainColumns({
        height: app.viewportHeight,
        width: app.viewportWidth
    });
}

function advanceBinaryColumns(timestamp) {
    if (!app.binaryColumns.length) {
        return;
    }
    if (timestamp - app.lastBackgroundStep < BACKGROUND_STEP_MS) {
        return;
    }
    app.lastBackgroundStep = timestamp;
    app.binaryColumns = app.binaryColumns.map(column => advanceBinaryRainColumn(column));
}

function ensureCanvas() {
    if (!app.canvas) {
        app.canvas = document.getElementById('terminal-canvas');
    }
    if (!app.ctx) {
        app.ctx = app.canvas.getContext('2d');
    }
    if (!app.scratchCanvas) {
        app.scratchCanvas = document.getElementById('canvas') || document.createElement('canvas');
    }
}

function resizeCanvas() {
    ensureCanvas();
    app.viewportWidth = Math.max(1, window.innerWidth || 1);
    app.viewportHeight = Math.max(1, window.innerHeight || 1);
    app.dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    app.canvas.width = round(app.viewportWidth * app.dpr);
    app.canvas.height = round(app.viewportHeight * app.dpr);
    app.canvas.style.width = `${app.viewportWidth}px`;
    app.canvas.style.height = `${app.viewportHeight}px`;
    app.ctx.setTransform(app.dpr, 0, 0, app.dpr, 0, 0);
    setDocumentFrame();
    refreshBinaryColumns();
}

function clampScroll() {
    app.scrollTop = clamp(app.scrollTop, 0, Math.max(0, app.contentHeight - app.viewportHeight));
}

function scrollToBottom() {
    app.scrollTop = Math.max(0, app.contentHeight - app.viewportHeight);
}

function layoutScenePass(metrics, editorialSeedRects = []) {
    let cursorY = metrics.paddingY;
    const regions = [];
    const editorialRects = [];
    const editorial = isEditorialModeActive();

    app.blocks.forEach(block => {
        block.layout = layoutOutputBlock(block, metrics.contentWidth, metrics, {
            blockTop: cursorY,
            editorial,
            globalObstacles: editorialSeedRects
        });
        block.top = cursorY;
        block.bottom = cursorY + block.layout.height;
        block.layout.hitRegions.forEach(region => {
            regions.push({
                ...region,
                x: metrics.paddingX + region.x,
                y: cursorY + region.y
            });
        });
        if (Array.isArray(block.layout.editorialMediaRects)) {
            block.layout.editorialMediaRects.forEach(rect => {
                editorialRects.push({
                    ...rect,
                    blockId: block.id
                });
            });
        }
        cursorY += block.layout.height + metrics.blockGap;
    });

    const inputLayoutBlock = app.inputLayoutBlock || (app.inputLayoutBlock = { id: '__inputLayoutBlock' });
    inputLayoutBlock.commandLine = app.inputValue;
    inputLayoutBlock.promptSnapshot = getPromptSnapshot();
    const inputLayout = layoutCommandEcho(inputLayoutBlock, metrics.contentWidth, metrics, true, {
        blockTop: cursorY,
        editorial,
        globalObstacles: editorialSeedRects
    });
    const inputTop = cursorY;
    cursorY += inputLayout.height + metrics.paddingY;

    return {
        contentBottom: cursorY,
        editorialRects,
        inputLayout,
        inputTop,
        regions
    };
}

function relayoutScene() {
    const metrics = resolveMetrics();
    const nearBottom = app.scrollTop >= Math.max(0, app.contentHeight - app.viewportHeight - metrics.lineHeight * 2);
    let pass = layoutScenePass(metrics, []);
    if (isEditorialModeActive() && pass.editorialRects.length > 0) {
        pass = layoutScenePass(metrics, pass.editorialRects);
        pass = layoutScenePass(metrics, pass.editorialRects);
    }

    app.inputLayout = pass.inputLayout;
    app.inputTop = pass.inputTop;
    const editorialBottom = pass.editorialRects.reduce((maximum, rect) => (
        Math.max(maximum, rect.y + rect.height + (rect.deleteButton ? metrics.lineHeight + rect.deleteGap : 0))
    ), 0);
    const blockDeleteRegions = pass.regions.filter(region => region.action === 'delete-entry');
    const baseRegions = pass.regions.filter(region => region.action !== 'delete-entry');
    const editorialDragRegions = pass.editorialRects.map(rect => ({
        action: 'drag-media',
        data: {
            blockId: rect.blockId,
            mediaId: rect.id
        },
        height: rect.height,
        width: rect.width,
        x: metrics.paddingX + rect.x,
        y: rect.y
    }));
    const editorialDeleteRegions = pass.editorialRects
        .filter(rect => rect.deleteButton)
        .map(rect => ({
            action: 'delete-media',
            data: rect.block,
            height: metrics.lineHeight,
            width: rect.deleteButton.width,
            x: metrics.paddingX + rect.x,
            y: rect.y + rect.height + rect.deleteGap
        }));
    app.contentHeight = Math.max(app.viewportHeight, pass.contentBottom, editorialBottom + metrics.paddingY);
    app.editorialMediaRects = pass.editorialRects;
    app.interactiveRegions = [
        ...baseRegions,
        ...editorialDragRegions,
        ...blockDeleteRegions,
        ...editorialDeleteRegions
    ];

    if (nearBottom) {
        scrollToBottom();
    } else {
        clampScroll();
    }
}

function drawBackground(ctx, palette, timestamp) {
    ctx.clearRect(0, 0, app.viewportWidth, app.viewportHeight);
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, app.viewportWidth, app.viewportHeight);

    const glow = ctx.createRadialGradient(
        app.viewportWidth * 0.5,
        app.viewportHeight * 0.5,
        0,
        app.viewportWidth * 0.5,
        app.viewportHeight * 0.5,
        Math.max(app.viewportWidth, app.viewportHeight) * 1.2
    );
    glow.addColorStop(0, palette.glow);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, app.viewportWidth, app.viewportHeight);

    advanceBinaryColumns(timestamp);
    if (app.binaryColumns.length > 0) {
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        app.binaryColumns.forEach(column => {
            const glyphs = Array.isArray(column.cells) ? column.cells : [];
            if (glyphs.length === 0) {
                return;
            }

            const frame = getBinaryRainColumnFrame(column, {
                height: app.viewportHeight,
                timestamp
            });
            const x = app.viewportWidth * frame.x;

            ctx.save();
            ctx.font = buildFont(frame.fontSizePx, '700');
            ctx.globalAlpha = frame.opacity;
            ctx.fillStyle = palette.accent;
            ctx.shadowColor = palette.accent;
            ctx.shadowBlur = Math.max(6, frame.fontSizePx * 0.35);
            if ('filter' in ctx) {
                ctx.filter = frame.blurPx > 0 ? `blur(${frame.blurPx}px)` : 'none';
            }
            glyphs.forEach((glyph, index) => {
                const y = frame.y + index * frame.glyphHeight;
                if (y < -frame.glyphHeight * 2 || y > app.viewportHeight + frame.glyphHeight * 2) {
                    return;
                }
                ctx.fillText(glyph, x, y);
            });
            ctx.restore();
        });
        ctx.restore();
    }
}

function drawScreenOverlay(ctx, palette) {
    ctx.save();
    ctx.fillStyle = palette.scanline || 'rgba(0, 0, 0, 0.15)';
    for (let y = 0; y < app.viewportHeight; y += 2) {
        ctx.fillRect(0, y, app.viewportWidth, 1);
    }
    ctx.restore();
}

function drawScrollbar(ctx, palette, metrics) {
    if (app.contentHeight <= app.viewportHeight + 2) {
        return;
    }

    const trackX = app.viewportWidth - metrics.scrollbarWidth + 2;
    const trackY = metrics.paddingY;
    const trackHeight = app.viewportHeight - metrics.paddingY * 2;
    const thumbHeight = Math.max(36, trackHeight * (app.viewportHeight / app.contentHeight));
    const maxTravel = Math.max(0, trackHeight - thumbHeight);
    const thumbY = trackY + maxTravel * (app.scrollTop / Math.max(1, app.contentHeight - app.viewportHeight));

    ctx.fillStyle = palette.scrollbarTrack;
    ctx.fillRect(trackX, trackY, metrics.scrollbarWidth - 4, trackHeight);
    ctx.fillStyle = palette.scrollbarThumb;
    ctx.fillRect(trackX, thumbY, metrics.scrollbarWidth - 4, thumbHeight);
}

function drawTerminalScene(timestamp) {
    relayoutScene();
    const ctx = app.ctx;
    const metrics = resolveMetrics();
    const palette = getPalette();
    drawBackground(ctx, palette, timestamp);

    ctx.save();
    ctx.translate(0, -app.scrollTop);
    app.blocks.forEach(block => {
        if (!block.layout) {
            return;
        }
        if (block.bottom < app.scrollTop - 64 || block.top > app.scrollTop + app.viewportHeight + 64) {
            return;
        }
        block.layout.render(ctx, metrics.paddingX, block.top, palette);
    });
    app.inputLayout.render(ctx, metrics.paddingX, app.inputTop, palette);
    app.editorialMediaRects.forEach(rect => {
        const rectBottom = rect.y + rect.height + (rect.deleteButton ? metrics.lineHeight + rect.deleteGap : 0);
        if (rectBottom < app.scrollTop - 64 || rect.y > app.scrollTop + app.viewportHeight + 64) {
            return;
        }

        const rectX = metrics.paddingX + rect.x;
        ctx.fillStyle = palette.media;
        ctx.strokeStyle = palette.border;
        ctx.lineWidth = 1;
        ctx.fillRect(rectX, rect.y, rect.width, rect.height);
        ctx.strokeRect(rectX + 0.5, rect.y + 0.5, rect.width - 1, rect.height - 1);
        const source = getMediaRenderSource(rect.entry);
        if (rect.entry?.ready && source) {
            try {
                ctx.drawImage(source, rectX, rect.y, rect.width, rect.height);
            } catch {
                // Ignore transient media draw failures.
            }
        } else {
            ctx.font = metrics.textFont;
            ctx.textBaseline = 'middle';
            ctx.fillStyle = palette.text;
            ctx.fillText(rect.type === 'video' ? '[video]' : '[image]', rectX + 12, rect.y + rect.height / 2);
        }

        if (rect.deleteButton) {
            ctx.font = rect.deleteButton.font;
            ctx.textBaseline = 'top';
            ctx.fillStyle = palette.accent;
            ctx.fillText(rect.deleteButton.text, rectX, rect.y + rect.height + rect.deleteGap);
        }
    });
    ctx.restore();
    drawScrollbar(ctx, palette, metrics);
    drawScreenOverlay(ctx, palette);
}

function drawViewerScene(timestamp) {
    const ctx = app.ctx;
    const metrics = resolveMetrics();
    const palette = getPalette();
    drawBackground(ctx, palette, timestamp);
    if (!app.viewer) {
        return;
    }

    const x = metrics.paddingX;
    const y = metrics.paddingY;
    const width = metrics.contentWidth;
    const height = app.viewportHeight - metrics.paddingY * 2;
    ctx.fillStyle = palette.block;
    ctx.strokeStyle = palette.border;
    ctx.lineWidth = 1;
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

    const closeText = '[close]';
    const closeWidth = measureTextWidth(closeText, metrics.commandFont);
    ctx.font = metrics.titleFont;
    ctx.textBaseline = 'top';
    ctx.fillStyle = palette.title;
    ctx.fillText(app.viewer.title || 'viewer', x + 12, y + 12);
    ctx.font = metrics.commandFont;
    ctx.fillStyle = palette.accent;
    ctx.fillText(closeText, x + width - closeWidth - 14, y + 16);
    app.interactiveRegions = [{
        action: 'viewer-close',
        data: null,
        height: metrics.lineHeight,
        width: closeWidth,
        x: x + width - closeWidth - 14,
        y: y + 16
    }];

    if (app.viewer.hint) {
        ctx.fillStyle = palette.text;
        ctx.fillText(app.viewer.hint, x + 12, y + metrics.lineHeight + 22);
    }

    if (app.viewer.type === 'ascii' || app.viewer.type === 'movie') {
        ctx.fillStyle = palette.text;
        ctx.font = metrics.textFont;
        ctx.textBaseline = 'top';
        const lines = Array.isArray(app.viewer.lines) ? app.viewer.lines : [];
        lines.forEach((line, index) => {
            ctx.fillText(line, x + 14, y + metrics.viewerTop + index * metrics.lineHeight);
        });
    } else if (app.viewer.type === 'image') {
        const entry = getMediaEntry(app.viewer.src, 'image', { mimeType: app.viewer.mimeType });
        const source = getMediaRenderSource(entry);
        if (entry?.ready && source) {
            const dimensions = getMediaDimensions(entry, width - 28);
            ctx.drawImage(source, x + 14, y + metrics.viewerTop, dimensions.width, dimensions.height);
        } else {
            ctx.fillStyle = palette.text;
            ctx.font = metrics.textFont;
            ctx.textBaseline = 'top';
            ctx.fillText('[image loading]', x + 14, y + metrics.viewerTop);
        }
    }

    drawScreenOverlay(ctx, palette);
}

function frame(timestamp) {
    app.frameId = window.requestAnimationFrame(frame);
    updateAnimatedMediaEntries(timestamp);
    if (app.viewer?.type === 'movie') {
        updateMovieFrame();
    }
    if (app.viewer) {
        drawViewerScene(timestamp);
    } else {
        drawTerminalScene(timestamp);
    }
}

function startFrameLoop() {
    if (!app.frameId) {
        app.frameId = window.requestAnimationFrame(frame);
    }
}

function getCommandHandlers() {
    return new Map([
        ['help', window.help_command],
        ['banner', window.banner_command],
        ['cat', window.cat_command],
        ['date', window.date_command],
        ['echo', window.echo_command],
        ['fortune', window.fortune_command],
        ['github', window.github_command],
        ['history', window.history_command],
        ['instagram', window.instagram_command],
        ['linkedin', window.linkedin_command],
        ['ls', window.ls_command],
        ['movie', window.movie_command],
        ['picture', window.picture_command],
        ['pretext', window.pretext_command],
        ['post', window.post_command],
        ['projects', window.projects_command],
        ['pwd', window.pwd_command],
        ['qr-totp', window.qr_totp_command],
        ['resume', window.resume_command],
        ['su', window.su_command],
        ['userpic', window.userpic_command],
        ['visitors', window.visitors_command],
        ['whoami', window.whoami_command],
        ['youtube', window.youtube_command]
    ]);
}

function appendOutput(output) {
    if (!Array.isArray(output) || output.length === 0) {
        return;
    }
    output.forEach(line => {
        app.blocks.push(buildBlock('output', line));
    });
}

function appendCommandEcho(commandLine) {
    const block = buildBlock('command', null, {
        promptSnapshot: getPromptSnapshot()
    });
    block.commandLine = commandLine;
    app.blocks.push(block);
}

export async function executeCommand(commandLine) {
    const safeCommand = typeof commandLine === 'string' ? commandLine.trim() : '';
    if (!safeCommand) {
        return;
    }

    app.commandHistory.push(safeCommand);
    if (app.commandHistory.length > 100) {
        app.commandHistory.shift();
    }
    app.historyIndex = app.commandHistory.length;
    appendCommandEcho(safeCommand);

    const parts = safeCommand.split(/\s+/);
    const command = (parts[0] || '').toLowerCase();
    const args = parts.slice(1);

    if (command === 'clear') {
        setupTerminal();
        return;
    }

    let output = null;
    const handler = getCommandHandlers().get(command);
    if (typeof handler === 'function') {
        output = await handler(args);
    } else {
        output = [`bash: ${command}: command not found`];
    }

    appendOutput(output);
    app.inputValue = '';
    scrollToBottom();
}

export function setupTerminal() {
    app.viewer = null;
    app.blocks = [];
    app.inputValue = '';
    app.scrollTop = 0;
}

function updateMovieFrame() {
    const viewer = app.viewer;
    if (!viewer || viewer.type !== 'movie' || !viewer.ctx || !viewer.video) {
        return;
    }
    if (viewer.video.readyState < viewer.video.HAVE_ENOUGH_DATA) {
        return;
    }
    viewer.ctx.drawImage(viewer.video, 0, 0, viewer.width, viewer.height);
    if (typeof window.processImage === 'function') {
        viewer.lines = window.processImage(viewer.ctx, viewer.width, viewer.height);
    }
}

export async function showMovie(args = []) {
    ensureCanvas();
    const width = Number.isFinite(Number(args?.[0])) ? Math.max(24, Math.floor(Number(args[0]))) : 160;
    const height = Number.isFinite(Number(args?.[1])) ? Math.max(16, Math.floor(Number(args[1]))) : 80;
    const video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    app.scratchCanvas.width = width;
    app.scratchCanvas.height = height;
    const ctx = app.scratchCanvas.getContext('2d', { willReadFrequently: true });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    video.srcObject = stream;
    await video.play().catch(() => {});
    app.viewer = {
        ctx,
        height,
        hint: 'press Escape to close',
        lines: [],
        title: 'movie',
        type: 'movie',
        video,
        width
    };
    app.viewer.stop = () => {
        stream.getTracks().forEach(track => track.stop());
    };
    app.scrollTop = 0;
}

export function showAsciiStill(asciiLines, options = {}) {
    app.viewer = {
        hint: options.hint || 'press Escape to close',
        lines: Array.isArray(asciiLines) ? asciiLines : [],
        title: options.title || 'ascii viewer',
        type: 'ascii'
    };
    app.scrollTop = 0;
}

export function showImageStill(imageUrl, options = {}) {
    app.viewer = {
        hint: options.hint || 'press Escape to close',
        mimeType: options.mimeType || '',
        src: imageUrl,
        title: options.title || 'image viewer',
        type: 'image'
    };
    app.scrollTop = 0;
}

function closeViewer() {
    if (app.viewer?.type === 'movie' && typeof app.viewer.stop === 'function') {
        app.viewer.stop();
    }
    app.viewer = null;
    scrollToBottom();
}

function appendDeleteCommitResult(result, prefix) {
    if (!result?.commitUrl) {
        return;
    }

    appendOutput([{
        type: 'text-link',
        prefix,
        href: result.commitUrl,
        text: 'view commit',
        newTab: true
    }]);
    scrollToBottom();
}

function removeBlogEntryFromScene(entryTimestamp) {
    app.blocks = app.blocks.filter(block => !(
        block?.data
        && typeof block.data === 'object'
        && block.data.type === 'blog-entry'
        && String(block.data.entryTimestamp || '').trim() === String(entryTimestamp || '').trim()
    ));
}

function removeBlogMediaFromBlockData(target, imageKey) {
    if (!target || typeof target !== 'object') {
        return false;
    }

    if (Array.isArray(target.blocks)) {
        const nextBlocks = target.blocks.filter(block => String(block?.imageKey || '') !== String(imageKey || ''));
        const changed = nextBlocks.length !== target.blocks.length;
        if (changed) {
            target.blocks = nextBlocks;
        }
        return changed;
    }

    return false;
}

function removeBlogMediaFromScene(imageKey) {
    let removed = false;
    app.blocks = app.blocks
        .filter(block => {
            if (!block?.data || typeof block.data !== 'object') {
                return true;
            }

            if ((block.data.type === 'inline-image' || block.data.type === 'inline-video') && String(block.data.imageKey || '') === String(imageKey || '')) {
                removed = true;
                return false;
            }

            if (block.data.type === 'blog-entry') {
                removed = removeBlogMediaFromBlockData(block.data, imageKey) || removed;
                return true;
            }

            return true;
        });
    return removed;
}

async function handleDeleteEntry(target) {
    if (!target?.entryTimestamp || typeof window.deleteBlogEntryByTimestamp !== 'function') {
        return;
    }

    const result = await window.deleteBlogEntryByTimestamp(target.entryTimestamp);
    if (result?.ok) {
        removeBlogEntryFromScene(target.entryTimestamp);
        appendOutput([`post: deleted ${target.entryTimestamp}`]);
        appendDeleteCommitResult(result, 'post: ');
        scrollToBottom();
        return;
    }

    appendOutput([`post: ${result?.error || 'unable to delete post right now'}`]);
    scrollToBottom();
}

async function handleDeleteMedia(target) {
    if (!target || typeof window.deleteBlogImageByBlockIndex !== 'function') {
        return;
    }

    const result = await window.deleteBlogImageByBlockIndex(
        target.imageBlockIndex,
        '',
        target.imageKey || '',
        target.src || '',
        target.entryTimestamp || '',
        target.entryImageIndex ?? null,
        target.previousTextLine || '',
        target.nextTextLine || ''
    );

    if (result?.ok) {
        removeBlogMediaFromScene(target.imageKey || '');
        appendOutput(['post: deleted media item']);
        appendDeleteCommitResult(result, 'post: ');
        scrollToBottom();
        return;
    }

    appendOutput([`post: ${result?.error || 'unable to delete image right now'}`]);
    scrollToBottom();
}

function hitTest(clientX, clientY) {
    const rect = app.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top + (app.viewer ? 0 : app.scrollTop);
    return [...app.interactiveRegions].reverse().find(region => (
        x >= region.x
        && x <= region.x + region.width
        && y >= region.y
        && y <= region.y + region.height
    )) || null;
}

function onPointerDown(event) {
    const region = hitTest(event.clientX, event.clientY);
    if (!region) {
        return;
    }

    if (region.action === 'drag-media') {
        const block = app.blocks.find(item => item.id === region.data?.blockId);
        const mediaState = block?.editorialMediaState?.get(region.data?.mediaId);
        if (!mediaState) {
            return;
        }
        app.pointerDrag = {
            blockId: block.id,
            mediaId: region.data.mediaId,
            moved: false,
            originX: mediaState.x,
            originY: mediaState.y,
            pointerId: event.pointerId,
            startClientX: event.clientX,
            startClientY: event.clientY
        };
        if (typeof app.canvas.setPointerCapture === 'function') {
            app.canvas.setPointerCapture(event.pointerId);
        }
        return;
    }

    app.pointerDrag = {
        moved: false,
        pointerId: event.pointerId,
        region,
        startClientX: event.clientX,
        startClientY: event.clientY
    };
}

function onPointerMove(event) {
    if (!app.pointerDrag || app.pointerDrag.pointerId !== event.pointerId || !app.pointerDrag.mediaId) {
        return;
    }

    const deltaX = event.clientX - app.pointerDrag.startClientX;
    const deltaY = event.clientY - app.pointerDrag.startClientY;
    if (!app.pointerDrag.moved && Math.hypot(deltaX, deltaY) > 4) {
        app.pointerDrag.moved = true;
    }
    if (!app.pointerDrag.moved) {
        return;
    }

    const block = app.blocks.find(item => item.id === app.pointerDrag.blockId);
    const mediaState = block?.editorialMediaState?.get(app.pointerDrag.mediaId);
    if (!mediaState) {
        return;
    }

    mediaState.pinned = true;
    mediaState.x = Math.max(0, app.pointerDrag.originX + deltaX);
    mediaState.y = Math.max(0, app.pointerDrag.originY + deltaY);
}

function onPointerUp(event) {
    if (!app.pointerDrag || app.pointerDrag.pointerId !== event.pointerId) {
        return;
    }

    const drag = app.pointerDrag;
    app.pointerDrag = null;
    if (typeof app.canvas.hasPointerCapture === 'function' && app.canvas.hasPointerCapture(event.pointerId)) {
        app.canvas.releasePointerCapture(event.pointerId);
    }

    if (drag.mediaId) {
        return;
    }

    if (drag.moved || !drag.region) {
        return;
    }

    switch (drag.region.action) {
    case 'delete-entry':
        handleDeleteEntry(drag.region.data).catch(error => {
            console.error('delete entry failed', error);
            appendOutput(['post: unable to delete post right now']);
        });
        break;
    case 'delete-media':
        handleDeleteMedia(drag.region.data).catch(error => {
            console.error('delete media failed', error);
            appendOutput(['post: unable to delete image right now']);
        });
        break;
    case 'link':
        activateLink(drag.region.data);
        break;
    case 'viewer-close':
        closeViewer();
        break;
    default:
        break;
    }
}

function onPointerCancel(event) {
    if (!app.pointerDrag || app.pointerDrag.pointerId !== event.pointerId) {
        return;
    }

    if (typeof app.canvas.hasPointerCapture === 'function' && app.canvas.hasPointerCapture(event.pointerId)) {
        app.canvas.releasePointerCapture(event.pointerId);
    }
    app.pointerDrag = null;
}

function onWheel(event) {
    if (app.viewer) {
        return;
    }
    if (event.ctrlKey) {
        return;
    }
    app.scrollTop += event.deltaY;
    clampScroll();
    event.preventDefault();
}

function navigateHistory(delta) {
    if (!app.commandHistory.length) {
        return;
    }
    app.historyIndex = clamp((Number.isInteger(app.historyIndex) ? app.historyIndex : app.commandHistory.length) + delta, 0, app.commandHistory.length);
    app.inputValue = app.historyIndex >= app.commandHistory.length ? '' : app.commandHistory[app.historyIndex];
}

function autocompleteInput() {
    const partial = String(app.inputValue || '').toLowerCase();
    const matches = [...getCommandHandlers().keys()].filter(name => name.startsWith(partial));
    if (matches.length === 1) {
        app.inputValue = matches[0];
    }
}

function onPaste(event) {
    if (app.viewer) {
        return;
    }
    const pasted = event.clipboardData?.getData('text');
    if (!pasted) {
        return;
    }
    app.inputValue += pasted.replace(/\r\n/g, '\n').replace(/\n/g, ' ');
    scrollToBottom();
    event.preventDefault();
}

function onKeyDown(event) {
    if (app.viewer) {
        if (event.key === 'Escape') {
            closeViewer();
            event.preventDefault();
        }
        return;
    }

    switch (event.key) {
    case 'Enter': {
        const command = app.inputValue;
        app.inputValue = '';
        executeCommand(command);
        event.preventDefault();
        return;
    }
    case 'Backspace':
        app.inputValue = app.inputValue.slice(0, -1);
        scrollToBottom();
        event.preventDefault();
        return;
    case 'ArrowUp':
        navigateHistory(-1);
        event.preventDefault();
        return;
    case 'ArrowDown':
        navigateHistory(1);
        event.preventDefault();
        return;
    case 'Tab':
        autocompleteInput();
        event.preventDefault();
        return;
    case 'PageUp':
        app.scrollTop -= app.viewportHeight * 0.85;
        clampScroll();
        event.preventDefault();
        return;
    case 'PageDown':
        app.scrollTop += app.viewportHeight * 0.85;
        clampScroll();
        event.preventDefault();
        return;
    case 'Home':
        app.scrollTop = 0;
        event.preventDefault();
        return;
    case 'End':
        scrollToBottom();
        event.preventDefault();
        return;
    default:
        break;
    }

    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        app.inputValue += event.key;
        scrollToBottom();
        event.preventDefault();
    }
}

function bindEvents() {
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('paste', onPaste);
    app.canvas.addEventListener('wheel', onWheel, { passive: false });
    app.canvas.addEventListener('pointerdown', onPointerDown);
    app.canvas.addEventListener('pointermove', onPointerMove);
    app.canvas.addEventListener('pointerup', onPointerUp);
    app.canvas.addEventListener('pointercancel', onPointerCancel);
}

export function refreshTerminalInputPrompt() {
    scrollToBottom();
}

export function syncTerminalSessionAwareLines() {
    refreshBinaryColumns();
}

export function syncTerminalVisualEffects() {
    refreshBinaryColumns();
}

export function getPromptPath() {
    return getPromptSnapshot().path;
}

export function getPromptUser() {
    return getPromptSnapshot().user;
}

export function getPromptHost() {
    return getPromptSnapshot().host;
}

export async function bootTerminalSite(defaultCommand) {
    ensureCanvas();
    resizeCanvas();
    if (!app.isBooted) {
        bindEvents();
        startFrameLoop();
        app.isBooted = true;
    }

    if (typeof window.ensureTerminalSessionReady === 'function') {
        await window.ensureTerminalSessionReady();
    }
    if (typeof window.ensureTerminalPretextReady === 'function') {
        await window.ensureTerminalPretextReady();
    }

    setupTerminal();
    refreshBinaryColumns();
    const params = new URLSearchParams(window.location.search);
    await executeCommand(params.get('command') || defaultCommand);
}
