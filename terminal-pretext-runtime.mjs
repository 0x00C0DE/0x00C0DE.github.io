import * as pretext from './pretext-browser.mjs';
import { buildTerminalPretextLayout, tokenizeTerminalText } from './terminal-pretext-core.mjs';

const terminalPretextStates = new WeakMap();
const terminalPretextContainers = new Set();
let resizeFrameId = 0;

function buildPlainTextToken(text) {
    return {
        type: 'text',
        text,
        start: 0,
        end: text.length
    };
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
    const explicitLineHeight = parseFloat(styles.lineHeight);
    if (Number.isFinite(explicitLineHeight)) {
        return Math.max(1, Math.round(explicitLineHeight));
    }

    const fontSize = parseFloat(styles.fontSize);
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
    const layout = buildTerminalPretextLayout(pretext, {
        tokens: state.tokens,
        font,
        lineHeight,
        maxWidth: width,
        whiteSpace: state.whiteSpace
    });

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

    container.classList.add('terminal-pretext-enabled');
    container.replaceChildren(...rows);
    return true;
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
        container.classList.remove('terminal-pretext-enabled');
        container.replaceChildren(document.createTextNode('\u00A0'));
        return true;
    }

    const tokens = options.tokenizeLinks === false
        ? [buildPlainTextToken(safeText)]
        : tokenizeTerminalText(safeText, {
            normalizeTextFilename: options.normalizeTextFilename
        });

    terminalPretextStates.set(container, {
        tokens,
        buildLinkElement: options.buildLinkElement,
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
