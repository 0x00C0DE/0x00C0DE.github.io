import * as pretext from './vendor/pretext/layout.js';
import {
    PRETEXT_DEFAULT_STATE,
    buildPretextLayout,
    buildPretextSearch,
    parsePretextStateFromSearch
} from './pretext-lab-core.mjs';

const SAMPLE_TEXTS = Object.freeze({
    terminal: 'Help output and project copy can now be explored in a dedicated Pretext lab before the text ever touches DOM measurement APIs.',
    multilingual: 'AGI 春天到了. بدأت الرحلة. Terminal layouts can mix ASCII, emoji, and multilingual copy while keeping wrapped line metrics explicit.',
    hardbreaks: 'First line stays visible.\nSecond line proves pre-wrap handling.\nThird line makes the line counter jump on purpose.'
});

const elements = {
    text: document.getElementById('pretext-text'),
    width: document.getElementById('pretext-width'),
    fontSize: document.getElementById('pretext-font-size'),
    lineHeight: document.getElementById('pretext-line-height'),
    whiteSpace: document.getElementById('pretext-white-space'),
    charCount: document.getElementById('char-count'),
    metricLines: document.getElementById('metric-lines'),
    metricHeight: document.getElementById('metric-height'),
    metricWidest: document.getElementById('metric-widest'),
    metricMode: document.getElementById('metric-mode'),
    previewWidthLabel: document.getElementById('preview-width-label'),
    previewFrame: document.getElementById('preview-frame'),
    previewLines: document.getElementById('preview-lines'),
    lineList: document.getElementById('line-list'),
    resetButton: document.getElementById('reset-button'),
    sampleButtons: Array.from(document.querySelectorAll('[data-sample]'))
};

function syncControls(state) {
    elements.text.value = state.text;
    elements.width.value = String(state.maxWidth);
    elements.fontSize.value = String(state.fontSize);
    elements.lineHeight.value = String(state.lineHeight);
    elements.whiteSpace.value = state.whiteSpace;
}

function readControlState() {
    return {
        text: elements.text.value,
        maxWidth: elements.width.value,
        fontSize: elements.fontSize.value,
        lineHeight: elements.lineHeight.value,
        whiteSpace: elements.whiteSpace.value
    };
}

function renderLinePreview(layout) {
    const lineNodes = layout.lines.length > 0
        ? layout.lines.map(line => {
            const row = document.createElement('div');
            row.className = 'preview-line';
            row.style.height = `${layout.lineHeight}px`;

            const number = document.createElement('span');
            number.className = 'preview-line-number';
            number.textContent = `${line.index + 1}`.padStart(2, '0');

            const text = document.createElement('span');
            text.textContent = line.text || ' ';

            row.append(number, text);
            return row;
        })
        : [document.createElement('div')];

    if (layout.lines.length === 0) {
        lineNodes[0].className = 'preview-line';
        lineNodes[0].style.height = `${layout.lineHeight}px`;
        lineNodes[0].textContent = ' ';
    }

    elements.previewLines.replaceChildren(...lineNodes);
}

function renderLineInventory(layout) {
    const items = layout.lines.length > 0
        ? layout.lines.map(line => {
            const item = document.createElement('li');
            item.className = 'line-list-item';

            const number = document.createElement('strong');
            number.textContent = `${line.index + 1}`.padStart(2, '0');

            const text = document.createElement('span');
            text.textContent = line.text || ' ';

            const width = document.createElement('span');
            width.className = 'line-list-width';
            width.textContent = `${line.width}px`;

            item.append(number, text, width);
            return item;
        })
        : [];

    elements.lineList.replaceChildren(...items);
}

function render() {
    const layout = buildPretextLayout(pretext, readControlState());
    syncControls(layout);

    elements.charCount.textContent = `${layout.text.length} chars`;
    elements.metricLines.textContent = String(layout.lineCount);
    elements.metricHeight.textContent = `${layout.height}px`;
    elements.metricWidest.textContent = `${layout.widestLineWidth}px`;
    elements.metricMode.textContent = layout.whiteSpace;
    elements.previewWidthLabel.textContent = `${layout.maxWidth}px measurement width • ${layout.font} • line-height ${layout.lineHeight}px`;
    elements.previewFrame.style.width = `${layout.maxWidth}px`;
    elements.previewLines.style.font = layout.font;
    elements.previewLines.style.lineHeight = `${layout.lineHeight}px`;
    elements.previewLines.style.minHeight = `${layout.height}px`;

    renderLinePreview(layout);
    renderLineInventory(layout);

    const nextSearch = buildPretextSearch(layout);
    const nextUrl = `${window.location.pathname}?${nextSearch}`;
    if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
        window.history.replaceState(null, '', nextUrl);
    }
}

function applySample(sampleKey) {
    const sampleText = SAMPLE_TEXTS[sampleKey];
    if (!sampleText) {
        return;
    }

    elements.text.value = sampleText;
    if (sampleKey === 'multilingual') {
        elements.whiteSpace.value = 'normal';
    } else if (sampleKey === 'hardbreaks') {
        elements.whiteSpace.value = 'pre-wrap';
    }
    render();
}

syncControls(parsePretextStateFromSearch(window.location.search));

elements.text.addEventListener('input', render);
elements.width.addEventListener('input', render);
elements.fontSize.addEventListener('input', render);
elements.lineHeight.addEventListener('input', render);
elements.whiteSpace.addEventListener('change', render);
elements.resetButton.addEventListener('click', () => {
    syncControls(PRETEXT_DEFAULT_STATE);
    render();
});

elements.sampleButtons.forEach(button => {
    button.addEventListener('click', () => {
        applySample(button.dataset.sample || '');
    });
});

if (document.fonts && typeof document.fonts.ready?.then === 'function') {
    document.fonts.ready.then(() => {
        render();
    });
}

render();
