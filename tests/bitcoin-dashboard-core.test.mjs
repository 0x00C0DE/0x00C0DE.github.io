import test from 'node:test';
import assert from 'node:assert/strict';

import {
    BITCOIN_DASHBOARD_COLORS,
    buildBitcoinDashboardViewModel,
    createBitcoinDateTimeTicks,
    createBitcoinDashboardLayout,
    createBitcoinDashboardPanelGeometry,
    createBitcoinTimeScale,
    findNearestBitcoinPoint,
    formatBitcoinAxisTimestamp,
    formatBitcoinDashboardTooltip,
    formatBitcoinTooltipTimestamp,
    inspectBitcoinDashboardPoint
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

    const panel = buildBitcoinDashboardViewModel([buildEntry()]).panels[0];
    const geometry = createBitcoinDashboardPanelGeometry(panel, wide.panelRects[0]);
    assert.ok(
        geometry.axisTitleY - geometry.axisTickY >= 12,
        'expected the datetime axis title to remain separated from tick labels'
    );

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

test('datetime scale preserves irregular observation spacing and maps X coordinates back to time', () => {
    const points = [
        { timestamp: 100, mid: 1 },
        { timestamp: 110, mid: 2 },
        { timestamp: 1_000, mid: 3 }
    ];
    const scale = createBitcoinTimeScale(points, 10, 910);

    assert.equal(scale.timestampToX(100), 10);
    assert.equal(scale.timestampToX(110), 20);
    assert.equal(scale.timestampToX(1_000), 910);
    assert.equal(scale.xToTimestamp(20), 110);
    assert.equal(findNearestBitcoinPoint(points, scale.xToTimestamp(410)), points[1]);
    assert.deepEqual(createBitcoinDateTimeTicks(points, 3), [100, 110, 1_000]);
});

test('nearest-point lookup handles empty, single-point, and large timestamp-sorted datasets', () => {
    assert.equal(findNearestBitcoinPoint([], 100), null);
    const onlyPoint = { timestamp: 200, mid: 42 };
    assert.equal(findNearestBitcoinPoint([onlyPoint], 9_999), onlyPoint);

    const large = Array.from({ length: 100_000 }, (_, index) => ({
        timestamp: 1_700_000_000 + (index * 7),
        mid: index
    }));
    const target = large[73_421];
    assert.equal(findNearestBitcoinPoint(large, target.timestamp + 2), target);

    const singleScale = createBitcoinTimeScale([onlyPoint], 10, 90);
    assert.equal(singleScale.timestampToX(onlyPoint.timestamp), 50);
    assert.equal(singleScale.xToTimestamp(10), onlyPoint.timestamp);
    assert.ok(Number.isNaN(createBitcoinTimeScale([], 0, 100).xToTimestamp(50)));
});

test('datetime labels adapt across intraday, multi-day, midnight, and DST boundaries', () => {
    const timeZone = 'America/Los_Angeles';
    const timestamp = Date.parse('2026-09-09T02:42:18Z') / 1000;

    assert.equal(formatBitcoinAxisTimestamp(timestamp, { rangeSeconds: 3_600, timeZone }), '7:42 PM');
    assert.equal(formatBitcoinAxisTimestamp(timestamp, { rangeSeconds: 172_800, timeZone }), 'Sep 8, 7:42 PM');
    assert.equal(formatBitcoinTooltipTimestamp(timestamp, { timeZone }), 'Sep 8, 2026, 7:42:18 PM PDT');

    const beforeMidnight = Date.parse('2026-09-09T06:59:59Z') / 1000;
    const afterMidnight = Date.parse('2026-09-09T07:00:00Z') / 1000;
    assert.equal(
        formatBitcoinAxisTimestamp(afterMidnight, { includeDate: true, rangeSeconds: 60, timeZone }),
        'Sep 9, 12:00 AM'
    );
    assert.match(formatBitcoinTooltipTimestamp(beforeMidnight, { timeZone }), /Sep 8, 2026, 11:59:59 PM PDT/);
    assert.match(formatBitcoinTooltipTimestamp(afterMidnight, { timeZone }), /Sep 9, 2026, 12:00:00 AM PDT/);

    const beforeFallback = Date.parse('2026-11-01T08:30:00Z') / 1000;
    const afterFallback = Date.parse('2026-11-01T09:30:00Z') / 1000;
    assert.match(formatBitcoinTooltipTimestamp(beforeFallback, { timeZone }), /1:30:00 AM PDT/);
    assert.match(formatBitcoinTooltipTimestamp(afterFallback, { timeZone }), /1:30:00 AM PST/);
});

test('dashboard inspection snaps to underlying observations and formats exact plotted values', () => {
    const dashboard = buildBitcoinDashboardViewModel([buildEntry()], {
        generatedAt: 1_800_010_000_000,
        timeZone: 'America/Los_Angeles'
    });
    const layout = createBitcoinDashboardLayout(900, 1);
    const panel = dashboard.panels[0];
    const geometry = createBitcoinDashboardPanelGeometry(panel, layout.panelRects[0]);
    const expectedPoint = panel.history[23];
    const inspection = inspectBitcoinDashboardPoint(
        dashboard,
        layout,
        geometry.timestampToX(expectedPoint.timestamp) + 0.4,
        geometry.chartTop + (geometry.chartHeight / 2)
    );

    assert.equal(inspection.panelIndex, 0);
    assert.equal(inspection.kind, 'historical');
    assert.equal(inspection.timestamp, expectedPoint.timestamp);
    assert.equal(inspection.mid, expectedPoint.mid);
    assert.equal(inspection.bid, expectedPoint.bid);
    assert.equal(inspection.ask, expectedPoint.ask);
    assert.equal(inspection.referencePrice, panel.referencePrice);
    assert.match(formatBitcoinDashboardTooltip(inspection, { timeZone: dashboard.timeZone }), /BTC \$60,046\.00/);
    assert.match(formatBitcoinDashboardTooltip(inspection, { timeZone: dashboard.timeZone }), /Bid \$60,040\.00/);

    const forecastPoint = panel.forecast[0];
    const forecastInspection = inspectBitcoinDashboardPoint(
        dashboard,
        layout,
        geometry.timestampToX(forecastPoint.timestamp),
        geometry.chartTop + (geometry.chartHeight / 2)
    );
    const forecastTooltip = formatBitcoinDashboardTooltip(forecastInspection, { timeZone: dashboard.timeZone });
    assert.equal(forecastInspection.kind, 'prediction');
    assert.equal(forecastInspection.projectedPrice, forecastPoint.projectedPrice);
    assert.match(forecastTooltip, /Prediction \$/);
    assert.match(forecastTooltip, /80% range/);
    assert.equal(inspectBitcoinDashboardPoint({ panels: [] }, createBitcoinDashboardLayout(900, 0), 10, 10), null);
});
