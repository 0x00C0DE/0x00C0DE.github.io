import * as pretext from './pretext-browser.mjs';
import { buildTerminalEditorialLayout, buildTerminalPretextLayout, tokenizeTerminalText } from './terminal-pretext-core.mjs';

const terminalPretextStates = new WeakMap();
const terminalPretextContainers = new Set();
let resizeFrameId = 0;
let sharedGraphemeSegmenter = null;

function getGraphemeSegmenter() {
    if (sharedGraphemeSegmenter === null) {
        sharedGraphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    }

    return sharedGraphemeSegmenter;
}

function buildPlainTextToken(text) {
    return {
        type: 'text',
        text,
        start: 0,
        end: text.length
    };
}

function explodeTokensToGraphemeTokens(tokens) {
    if (!Array.isArray(tokens) || tokens.length === 0) {
        return [];
    }

    const graphemeTokens = [];
    tokens.forEach(token => {
        const safeText = typeof token?.text === 'string' ? token.text : String(token?.text ?? '');
        if (!safeText) {
            return;
        }

        const baseToken = { ...token };
        delete baseToken.text;
        delete baseToken.start;
        delete baseToken.end;

        let offset = Number.isFinite(token?.start) ? token.start : 0;
        for (const part of getGraphemeSegmenter().segment(safeText)) {
            const segment = part.segment;
            const nextOffset = offset + segment.length;
            graphemeTokens.push({
                ...baseToken,
                text: segment,
                start: offset,
                end: nextOffset
            });
            offset = nextOffset;
        }
    });

    return graphemeTokens;
}

function buildTokensForText(text, options = {}) {
    const tokens = options.tokenizeLinks === false
        ? [buildPlainTextToken(text)]
        : tokenizeTerminalText(text, {
            normalizeTextFilename: options.normalizeTextFilename
        });

    return options.characterGranularity
        ? explodeTokensToGraphemeTokens(tokens)
        : tokens;
}

function buildComputedFont(styles) {
    const prefix = [
        styles.fontStyle,
        styles.fontVariant,
        styles.fontWeight,
        styles.fontStretch
    ]
        .filter(value => value && value !== 'normal' && value !== '100%')
        .join(' ');

    return `${prefix ? `${prefix} ` : ''}${styles.fontSize} ${styles.fontFamily}`.trim();
}

function resolveLineHeight(styles) {
    const lineHeightValue = typeof styles.lineHeight === 'string'
        ? styles.lineHeight.trim()
        : '';
    const explicitLineHeight = parseFloat(lineHeightValue);
    const fontSize = parseFloat(styles.fontSize);
    if (Number.isFinite(explicitLineHeight)) {
        if (/^[0-9]*\.?[0-9]+$/.test(lineHeightValue) && Number.isFinite(fontSize) && fontSize > 0) {
            return Math.max(1, Math.round(explicitLineHeight * fontSize));
        }

        return Math.max(1, Math.round(explicitLineHeight));
    }

    if (Number.isFinite(fontSize)) {
        return Math.max(1, Math.round(fontSize * 1.2));
    }

    return 20;
}

function resolveContainerWidth(container) {
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

function buildLineFragmentNodes(documentRef, fragments, buildLinkElement) {
    const nodes = [];
    fragments.forEach(fragment => {
        if (fragment.type === 'link' && typeof buildLinkElement === 'function') {
            nodes.push(buildLinkElement(fragment));
            return;
        }

        nodes.push(documentRef.createTextNode(fragment.text));
    });
    return nodes;
}

function scheduleContainerRender(container) {
    if (typeof window.requestAnimationFrame !== 'function') {
        return;
    }

    const existingFrame = container.__terminalPretextFrameId;
    if (existingFrame) {
        window.cancelAnimationFrame(existingFrame);
    }

    container.__terminalPretextFrameId = window.requestAnimationFrame(() => {
        container.__terminalPretextFrameId = 0;
        rerenderTerminalPretextContainer(container);
    });
}

function renderTerminalPretextState(container, state) {
    if (!container.isConnected) {
        scheduleContainerRender(container);
        return false;
    }

    const width = resolveContainerWidth(container);
    if (width <= 0) {
        scheduleContainerRender(container);
        return false;
    }

    const styles = window.getComputedStyle(container);
    const font = buildComputedFont(styles);
    const lineHeight = resolveLineHeight(styles);
    const layout = state.mode === 'editorial'
        ? buildTerminalEditorialLayout(pretext, {
            tokens: state.tokens,
            font,
            lineHeight,
            maxWidth: width,
            minSegmentWidth: state.minSegmentWidth,
            obstacles: state.obstacles,
            whiteSpace: state.whiteSpace
        })
        : buildTerminalPretextLayout(pretext, {
            tokens: state.tokens,
            font,
            lineHeight,
            maxWidth: width,
            whiteSpace: state.whiteSpace
        });

    if (state.mode === 'editorial') {
        const rows = layout.lines.length > 0
            ? layout.lines.map(line => {
                const row = document.createElement('span');
                row.className = 'terminal-pretext-row terminal-pretext-editorial-row';
                row.style.lineHeight = `${lineHeight}px`;
                row.style.transform = `translate(${Math.round(line.x)}px, ${Math.round(line.y)}px)`;
                row.append(...buildLineFragmentNodes(document, line.fragments, state.buildLinkElement));
                return row;
            })
            : [];

        container.classList.add('terminal-pretext-enabled', 'terminal-pretext-editorial-enabled');
        const editorialHeight = Number.isFinite(layout.textHeight)
            ? layout.textHeight
            : layout.height;
        container.style.minHeight = `${Math.max(lineHeight, Math.ceil(editorialHeight || 0))}px`;
        container.replaceChildren(...rows);
        return layout;
    }

    const rows = layout.lines.length > 0
        ? layout.lines.map(line => {
            const row = document.createElement('span');
            row.className = 'terminal-pretext-row';
            row.style.minHeight = `${layout.lineHeight}px`;
            row.style.lineHeight = `${layout.lineHeight}px`;
            row.append(...buildLineFragmentNodes(document, line.fragments, state.buildLinkElement));
            return row;
        })
        : [document.createTextNode('\u00A0')];

    container.classList.remove('terminal-pretext-editorial-enabled');
    container.style.minHeight = '';
    container.classList.add('terminal-pretext-enabled');
    container.replaceChildren(...rows);
    return layout;
}

export function rerenderTerminalPretextContainer(container) {
    const state = terminalPretextStates.get(container);
    if (!state) {
        return false;
    }

    return renderTerminalPretextState(container, state);
}

export function renderTerminalTextWithPretext(container, text, options = {}) {
    const safeText = typeof text === 'string' ? text : String(text ?? '');
    if (!safeText) {
        container.classList.remove('terminal-pretext-enabled', 'terminal-pretext-editorial-enabled');
        container.style.minHeight = '';
        container.replaceChildren(document.createTextNode('\u00A0'));
        return true;
    }

    terminalPretextStates.set(container, {
        tokens: buildTokensForText(safeText, options),
        buildLinkElement: options.buildLinkElement,
        mode: 'standard',
        whiteSpace: options.whiteSpace || 'pre-wrap'
    });
    terminalPretextContainers.add(container);
    container.dataset.pretextTerminal = 'true';
    if (!container.isConnected) {
        scheduleContainerRender(container);
        return true;
    }
    return renderTerminalPretextState(container, terminalPretextStates.get(container));
}

export function renderTerminalEditorialTextWithPretext(container, text, options = {}) {
    const safeText = typeof text === 'string' ? text : String(text ?? '');
    terminalPretextStates.set(container, {
        tokens: buildTokensForText(safeText, options),
        buildLinkElement: options.buildLinkElement,
        minSegmentWidth: options.minSegmentWidth,
        mode: 'editorial',
        obstacles: Array.isArray(options.obstacles) ? options.obstacles : [],
        whiteSpace: options.whiteSpace || 'pre-wrap'
    });
    terminalPretextContainers.add(container);
    container.dataset.pretextTerminal = 'true';
    if (!container.isConnected) {
        scheduleContainerRender(container);
        return true;
    }
    return renderTerminalPretextState(container, terminalPretextStates.get(container));
}

function rerenderAllTerminalPretextContainers() {
    terminalPretextContainers.forEach(container => {
        if (!container.isConnected) {
            terminalPretextContainers.delete(container);
            terminalPretextStates.delete(container);
            return;
        }

        rerenderTerminalPretextContainer(container);
    });
}

window.addEventListener('resize', () => {
    if (resizeFrameId) {
        window.cancelAnimationFrame(resizeFrameId);
    }

    resizeFrameId = window.requestAnimationFrame(() => {
        resizeFrameId = 0;
        rerenderAllTerminalPretextContainers();
    });
});
