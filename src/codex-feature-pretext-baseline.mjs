import './pretext-lab.mjs?v=20260403b';
import * as pretext from './pretext-browser.mjs';
import { buildPretextLayout } from './pretext-lab-core.mjs';
import { pinBaseline, baselineDeltas } from './codex-feature-pretext-baseline-core.mjs';

const byId = id => document.getElementById(id);
const comparison = byId('baseline-comparison');
const pin = byId('baseline-pin');
const clear = byId('baseline-clear');
let baseline = null;

function currentLayout() {
    return buildPretextLayout(pretext, {
        text: byId('pretext-text').value,
        maxWidth: byId('pretext-width').value,
        fontSize: byId('pretext-font-size').value,
        lineHeight: byId('pretext-line-height').value,
        whiteSpace: byId('pretext-white-space').value
    });
}

function updateDeltas() {
    if (!baseline) return;
    const deltas = baselineDeltas(currentLayout(), baseline);
    for (const [key, value] of Object.entries(deltas)) {
        byId(`baseline-delta-${key}`).textContent = `${value > 0 ? '+' : ''}${value}${key === 'lines' ? '' : 'px'}`;
    }
}

pin.addEventListener('click', () => {
    baseline = pinBaseline(currentLayout());
    const frame = byId('baseline-frame');
    frame.style.width = `${baseline.maxWidth}px`;
    const lines = byId('baseline-lines');
    lines.style.font = baseline.font;
    lines.style.lineHeight = `${baseline.lineHeight}px`;
    lines.style.minHeight = `${baseline.height}px`;
    lines.replaceChildren(...baseline.lines.map(line => {
        const row = document.createElement('div');
        row.className = 'preview-line';
        row.style.height = `${baseline.lineHeight}px`;
        const number = document.createElement('span');
        number.className = 'preview-line-number';
        number.textContent = String(line.index + 1).padStart(2, '0');
        const text = document.createElement('span');
        text.textContent = line.text || ' ';
        row.append(number, text);
        return row;
    }));
    byId('baseline-settings').textContent = `${baseline.maxWidth}px measurement width • ${baseline.font} • line-height ${baseline.lineHeight}px • ${baseline.whiteSpace}`;
    byId('baseline-metrics').textContent = `Pinned: ${baseline.lineCount} lines • height ${baseline.height}px • widest line ${baseline.widestLineWidth}px`;
    comparison.hidden = false;
    clear.disabled = false;
    pin.textContent = 'Replace baseline';
    byId('baseline-status').textContent = 'Baseline pinned. Edits update the current preview only.';
    updateDeltas();
});

clear.addEventListener('click', () => {
    baseline = null;
    comparison.hidden = true;
    byId('baseline-lines').replaceChildren();
    clear.disabled = true;
    pin.textContent = 'Pin baseline';
    byId('baseline-status').textContent = 'Baseline cleared.';
});

// Existing control handlers run at the target before these bubbling listeners.
for (const event of ['input', 'change', 'click']) {
    document.querySelector('.panels').addEventListener(event, updateDeltas);
}
