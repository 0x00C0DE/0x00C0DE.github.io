import {
    findNearestBitcoinPoint,
    formatBitcoinTooltipTimestamp
} from './bitcoin-dashboard-core.mjs?v=20261111a';
import { drawBitcoinWorkspaceChart } from './bitcoin-workspace-chart.mjs?v=1';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const $ = id => document.getElementById(id);
const chart = $('chart');
const slider = $('observation');
const status = $('status');
const overlays = new Set(['projection']);
const requestedInterval = new URLSearchParams(location.search).get('interval')?.toLowerCase();
let interval = requestedInterval || '1m';
let model;
let panel;
let history = [];
let forecast = [];
let points = [];
let geometry;
let range = 'all';
let selectedIndex = 0;

function formatValue(value, format) {
    return Number.isFinite(value) ? format(value) : '—';
}

function percent(value, signed = false) {
    return formatValue(value, number => (signed && number > 0 ? '+' : '') + number.toFixed(2) + '%');
}

function usd(value) {
    return formatValue(value, number => money.format(number));
}

function bps(value) {
    return formatValue(value, number => number.toFixed(1) + ' bps');
}

function time(value) {
    return formatBitcoinTooltipTimestamp(value, { timeZone: model.timeZone });
}

function label(value) {
    if (!value) return '—';
    return value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' ');
}

function intervalMinutes(item) {
    return parseInt(item.intervalId, 10) * (item.intervalId.endsWith('h') ? 60 : 1);
}

function dataStatus(item) {
    return item.available ? label(item.risk?.status) : 'Unavailable';
}

function makeElement(tag, text) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    return element;
}

function definitionList(target, entries) {
    target.replaceChildren(...entries.map(([name, value, tone]) => {
        const row = makeElement('div');
        const detail = makeElement('dd', value);
        if (tone) detail.dataset.tone = tone;
        row.append(makeElement('dt', name), detail);
        return row;
    }));
}

function renderIntervals() {
    $('intervals').replaceChildren(...model.panels.map(item => {
        const button = makeElement('button', item.intervalId);
        button.type = 'button';
        button.dataset.interval = item.intervalId;
        button.setAttribute('aria-pressed', String(item.intervalId === interval));
        return button;
    }));
}

function renderComparison() {
    $('rows').replaceChildren(...model.panels.map(item => {
        const row = makeElement('tr');
        row.dataset.interval = item.intervalId;
        row.toggleAttribute('data-selected', item.intervalId === interval);
        const heading = makeElement('th');
        heading.scope = 'row';
        const button = makeElement('button', item.intervalId);
        button.type = 'button';
        button.dataset.interval = item.intervalId;
        button.setAttribute('aria-label', 'Open ' + item.intervalId + ' chart');
        button.setAttribute('aria-pressed', String(item.intervalId === interval));
        heading.append(button);
        row.append(heading);
        const cells = item.available
            ? [usd(item.latestPrice), percent(item.changePct, true), bps(item.spreadBps), percent(item.dataCoveragePct)]
            : ['—', '—', '—', '—'];
        cells.forEach((value, i) => {
            const cell = makeElement('td', value);
            if (item.available && i === 1 && item.changePct !== 0) {
                cell.dataset.tone = item.changePct > 0 ? 'up' : 'down';
            }
            row.append(cell);
        });
        const quality = makeElement('td', dataStatus(item));
        if (item.risk?.status !== 'ready') quality.dataset.tone = 'warning';
        row.append(quality);
        return row;
    }));
}

function renderSelection() {
    const point = points[selectedIndex];
    if (!point || !panel?.available) return;
    slider.value = String(selectedIndex);
    const historic = Number.isFinite(point.mid);
    const values = historic
        ? 'Historical observation · Mid ' + usd(point.mid) + ' · Bid ' + usd(point.bid) + ' · Ask ' + usd(point.ask)
        : 'Model projection · ' + usd(point.projectedPrice) + ' · Estimated range ' +
            usd(point.lowerPrice) + ' to ' + usd(point.upperPrice);
    const description = time(point.timestamp) + ' · ' + values;
    $('inspection').textContent = description;
    slider.setAttribute('aria-valuetext', description);
    geometry = drawBitcoinWorkspaceChart(chart, panel, history, forecast, overlays, point, model.timeZone);
}

function renderRange(preservePoint = false) {
    document.querySelectorAll('.chart-key [data-series]').forEach(item => {
        item.hidden = item.dataset.series !== 'mid' && !overlays.has(item.dataset.series);
    });
    const previous = preservePoint ? points[selectedIndex] : null;
    history = range === '60' ? panel.history.slice(-60) : panel.history;
    forecast = overlays.has('projection') ? panel.forecast : [];
    points = [...history, ...forecast];
    const nextIndex = points.indexOf(previous);
    selectedIndex = nextIndex >= 0 ? nextIndex : history.length - 1;
    slider.max = String(points.length - 1);
    slider.disabled = points.length < 2;
    renderSelection();
}

function renderPanel() {
    panel = model.panels.find(item => item.intervalId === interval);
    $('price-heading').textContent = 'BTC/USD · ' + interval;
    $('source-time').textContent = panel.available ? 'Latest observation ' + time(panel.updatedTimestamp) : 'Repository Bitcoin history';
    $('unavailable').hidden = panel.available;
    $('available').hidden = !panel.available;
    $('export').disabled = !panel.available;
    if (!panel.available) {
        $('unavailable').textContent = interval + ' history is unavailable.';
        geometry = null;
        return;
    }
    definitionList($('snapshot'), [
        ['Mid price', usd(panel.latestPrice)],
        ['Window return', percent(panel.changePct, true)],
        ['Bid / ask spread', bps(panel.spreadBps)],
        ['Realized volatility', bps(panel.volatilityBps)],
        ['Data quality', dataStatus(panel), panel.risk?.status === 'ready' ? '' : 'warning'],
        ['Coverage', percent(panel.dataCoveragePct)],
        ['Observations', panel.sampleCount.toLocaleString('en-US')],
        ['Market condition', label(panel.marketCondition)],
        ['Model signal', panel.status]
    ]);
    const risk = panel.risk;
    const backtest = panel.performance;
    definitionList($('diagnostics'), [
        ['95% historical VaR', percent(risk?.valueAtRisk95Pct)],
        ['Current drawdown', percent(risk?.currentDrawdownPct)],
        ['Directional accuracy', percent(backtest?.directionalAccuracyPct)],
        ['Skill vs. baseline', percent(backtest?.skillVsNaivePct, true)],
        ['Forecast MAE', usd(backtest?.mae)],
        ['Backtest predictions', backtest?.testCount ?? '—'],
        ['Window mean', usd(panel.referencePrice)],
        ['Buy / sell levels', usd(panel.buyTriggerPrice) + ' / ' + usd(panel.sellTriggerPrice)],
        ['RSI', formatValue(panel.rsi, number => number.toFixed(1))],
        ['MACD histogram', formatValue(panel.macdHistogram, number => number.toFixed(2))]
    ]);
    $('warnings').textContent = [panel.signalReason, ...(risk?.warnings || [])].filter(Boolean).join(' · ');
    renderRange();
}

function selectInterval(next, scrollToChart = false) {
    if (next !== interval) {
        interval = next;
        const url = new URL(location.href);
        url.searchParams.set('interval', interval);
        window.history.replaceState(null, '', url);
        document.querySelectorAll('button[data-interval]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.interval === interval));
        });
        $('rows').querySelectorAll('tr').forEach(row => {
            row.toggleAttribute('data-selected', row.dataset.interval === interval);
        });
        renderPanel();
    }
    if (scrollToChart) {
        $('price-heading').focus({ preventScroll: true });
        $('workspace').scrollIntoView({ block: 'start' });
    }
}

async function refresh() {
    const button = $('refresh');
    button.disabled = true;
    status.removeAttribute('data-error');
    status.textContent = 'Loading repository history…';
    try {
        const output = await window.bitcoin_command(['dashboard']);
        const next = output.find(item => item?.type === 'bitcoin-dashboard')?.dashboard;
        if (!next?.panels.length) throw new Error('No dashboard response');
        const available = next.panels.filter(item => item.available).length;
        if (!available && model?.panels.some(item => item.available)) {
            throw new Error('No updated intervals available');
        }
        model = { ...next, panels: [...next.panels].sort((a, b) => intervalMinutes(a) - intervalMinutes(b)) };
        if (!model.panels.some(item => item.intervalId === interval)) {
            interval = model.panels.find(item => item.available)?.intervalId || model.panels[0].intervalId;
        }
        $('workspace').hidden = false;
        $('comparison').hidden = false;
        renderIntervals();
        renderComparison();
        renderPanel();
        status.textContent = available
            ? available + ' of ' + model.panels.length + ' intervals available · Loaded ' + time(model.generatedAt)
            : 'No interval history could be loaded. Try Refresh data.';
        status.toggleAttribute('data-error', available === 0);
    } catch (error) {
        console.error('Bitcoin workspace refresh failed', error);
        status.dataset.error = '';
        status.textContent = model ? 'Refresh failed. Showing the previous snapshot.' : 'Repository history could not be loaded. Try Refresh data.';
    } finally {
        button.disabled = false;
    }
}

function exportHistory() {
    const lines = ['timestamp_utc,bid_usd,mid_usd,ask_usd'];
    panel.history.forEach(({ timestamp, bid, mid, ask }) => {
        lines.push([new Date(timestamp * 1000).toISOString(), bid, mid, ask].join(','));
    });
    const url = URL.createObjectURL(new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' }));
    const anchor = makeElement('a');
    anchor.href = url;
    anchor.download = 'bitcoin-' + panel.intervalId + '-observations.csv';
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('intervals').addEventListener('click', event => {
    const button = event.target.closest('button[data-interval]');
    if (button) selectInterval(button.dataset.interval);
});
$('rows').addEventListener('click', event => {
    const button = event.target.closest('button[data-interval]');
    if (button) selectInterval(button.dataset.interval, true);
});
document.querySelectorAll('button[data-range]').forEach(button => {
    button.addEventListener('click', () => {
        range = button.dataset.range;
        document.querySelectorAll('button[data-range]').forEach(option => {
            option.setAttribute('aria-pressed', String(option === button));
        });
        renderRange(true);
    });
});
document.querySelector('fieldset').addEventListener('change', event => {
    const input = event.target;
    if (input.checked) overlays.add(input.value);
    else overlays.delete(input.value);
    renderRange(true);
});
slider.addEventListener('input', () => {
    selectedIndex = Number(slider.value);
    renderSelection();
});
chart.addEventListener('pointerdown', event => {
    if (!geometry) return;
    const timestamp = geometry.xToTimestamp(event.clientX - chart.getBoundingClientRect().left);
    const point = findNearestBitcoinPoint(points, timestamp);
    if (!point) return;
    selectedIndex = points.indexOf(point);
    renderSelection();
});
new ResizeObserver(renderSelection).observe(chart);
const table = $('rows').closest('table');
const tableScroll = table.parentElement;
const tableObserver = new ResizeObserver(() => {
    $('table-hint').hidden = tableScroll.scrollWidth <= tableScroll.clientWidth;
});
tableObserver.observe(table);
tableObserver.observe(tableScroll);
$('export').addEventListener('click', exportHistory);
$('refresh').addEventListener('click', refresh);
window.addEventListener('DOMContentLoaded', refresh, { once: true });
