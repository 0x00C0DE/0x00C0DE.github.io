import test from 'node:test';
import assert from 'node:assert/strict';

import {
    BITCOIN_DASHBOARD_COLORS,
    buildBitcoinDashboardViewModel,
    createBitcoinDashboardLayout
} from '../src/bitcoin-dashboard-core.mjs';
import {
    BITCOIN_INTERVALS,
    analyzeBitcoinHistory,
    backtestBitcoinForecast,
    buildBitcoinForecast
} from '../src/bitcoin-analytics-core.mjs';

function buildHistory({ count = 80, intervalSeconds = 60, startPrice = 60_000, step = 2 } = {}) {
    return Array.from({ length: count }, (_, index) => {
        const price = startPrice + (step * index);
        return {
            timestamp: 1_800_000_000 + (index * intervalSeconds),
            price,
            bid: price - 6,
            ask: price + 6,
            spread_bps: (12 / price) * 10_000,
            liquidity_volume: 0.1 + (index * 0.001),
            liquidity_is_proxy: true
        };
    });
}

function buildEntry(options = {}) {
    const interval = options.interval || BITCOIN_INTERVALS[0];
    const history = buildHistory({
        count: options.count ?? 80,
        intervalSeconds: interval.seconds,
        startPrice: options.startPrice ?? 60_000,
        step: options.step ?? 2
    });
    const analysis = analyzeBitcoinHistory(history, interval, (history.at(-1).timestamp + 20) * 1000);
    return {
        analysis,
        backtest: backtestBitcoinForecast(history, interval),
        forecast: buildBitcoinForecast(analysis)
    };
}

test('dashboard view model preserves market series, levels, forecasts, performance, and update metadata', () => {
    const generatedAt = 1_800_010_000_000;
    const entry = buildEntry();
    const dashboard = buildBitcoinDashboardViewModel([entry], { generatedAt });
    const panel = dashboard.panels[0];

    assert.equal(dashboard.generatedAt, generatedAt);
    assert.equal(panel.intervalId, '1m');
    assert.equal(panel.status, 'BUY');
    assert.equal(panel.buySignal, true);
    assert.equal(panel.sellSignal, false);
    assert.equal(panel.latestPrice, entry.analysis.latestPrice);
    assert.equal(panel.updatedTimestamp, entry.analysis.latestTimestamp);
    assert.equal(panel.history.length, entry.analysis.snapshots.length);
    assert.equal(panel.history.at(-1).mid, entry.analysis.latestPrice);
    assert.ok(panel.referencePrice > 0);
    assert.ok(panel.buyTriggerPrice < panel.latestPrice);
    assert.ok(panel.sellTriggerPrice > panel.latestPrice);
    assert.ok(panel.forecast.length >= 2);
    assert.ok(panel.forecast.every(point => point.lowerPrice < point.projectedPrice));
    assert.ok(panel.forecast.every(point => point.upperPrice > point.projectedPrice));
    assert.equal(panel.performance.testCount, entry.backtest.testCount);
    assert.ok(Number.isFinite(panel.performance.rmse));
    assert.match(panel.projectionDirection, /up|down|flat/);
    assert.ok(panel.sampleCount >= 1);
});

test('dashboard signal classification distinguishes bearish and neutral histories', () => {
    const falling = buildBitcoinDashboardViewModel([buildEntry({ step: -2 })]).panels[0];
    const flat = buildBitcoinDashboardViewModel([buildEntry({ step: 0 })]).panels[0];

    assert.equal(falling.status, 'SELL');
    assert.equal(falling.sellSignal, true);
    assert.equal(falling.buySignal, false);
    assert.equal(flat.status, 'HOLD');
    assert.equal(flat.buySignal, false);
    assert.equal(flat.sellSignal, false);
});

test('dashboard represents unavailable intervals without fabricating prices or signals', () => {
    const dashboard = buildBitcoinDashboardViewModel([], {
        unavailableIntervals: ['2m', '1h']
    });

    assert.deepEqual(dashboard.panels.map(panel => panel.intervalId), ['2m', '1h']);
    assert.ok(dashboard.panels.every(panel => panel.available === false));
    assert.ok(dashboard.panels.every(panel => panel.status === 'UNAVAILABLE'));
    assert.ok(dashboard.panels.every(panel => panel.history.length === 0));
});

test('dashboard layout uses compact two-column panels and stacks safely on narrow screens', () => {
    const wide = createBitcoinDashboardLayout(1240, 8);
    const narrow = createBitcoinDashboardLayout(420, 8);

    assert.equal(wide.columns, 2);
    assert.equal(wide.panelRects.length, 8);
    assert.equal(narrow.columns, 1);
    assert.equal(narrow.panelRects.length, 8);
    assert.ok(narrow.height > wide.height);
    assert.ok(wide.panelRects.every(rect => rect.x >= 0 && rect.x + rect.width <= wide.width));
    assert.ok(narrow.panelRects.every(rect => rect.x === 0 && rect.width === narrow.width));

    for (let index = 1; index < narrow.panelRects.length; index += 1) {
        assert.ok(narrow.panelRects[index].y >= narrow.panelRects[index - 1].y + narrow.panelRects[index - 1].height);
    }
});

test('dashboard exposes differentiated colors for prices, triggers, projection, range, and signals', () => {
    const requiredKeys = [
        'mid',
        'bid',
        'ask',
        'reference',
        'buyTrigger',
        'sellTrigger',
        'projection',
        'forecastRange',
        'latest',
        'buySignal',
        'sellSignal'
    ];

    requiredKeys.forEach(key => assert.match(BITCOIN_DASHBOARD_COLORS[key], /^#|^rgba\(/));
    assert.equal(new Set(requiredKeys.map(key => BITCOIN_DASHBOARD_COLORS[key])).size, requiredKeys.length);
});
