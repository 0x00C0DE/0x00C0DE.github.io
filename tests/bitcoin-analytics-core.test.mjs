import test from 'node:test';
import assert from 'node:assert/strict';

import {
    BITCOIN_INTERVALS,
    analyzeBitcoinHistory,
    buildBitcoinConsensus,
    formatBitcoinDashboard,
    formatBitcoinIntervalDetail,
    parseBitcoinHistory
} from '../src/bitcoin-analytics-core.mjs';

function buildHistory({ count = 20, intervalSeconds = 60, startPrice = 100, step = 1 } = {}) {
    return Array.from({ length: count }, (_, index) => {
        const price = startPrice + (step * index);
        return {
            timestamp: 1_800_000_000 + (index * intervalSeconds),
            price,
            bid: price - 0.25,
            ask: price + 0.25,
            spread_bps: (0.5 / price) * 10_000,
            bid_size: 0,
            ask_size: 0,
            liquidity_volume: 0.02 + (index * 0.001),
            liquidity_is_proxy: true
        };
    });
}

test('parseBitcoinHistory ignores malformed rows, sorts timestamps, deduplicates, and limits retained points', () => {
    const input = [
        '{not json}',
        JSON.stringify({ timestamp: 3, price: 103, bid: 102, ask: 104 }),
        JSON.stringify({ timestamp: 1, price: 101, bid: 100, ask: 102 }),
        JSON.stringify({ timestamp: 2, price: -1 }),
        JSON.stringify({ timestamp: 3, price: 104, bid: 103, ask: 105 }),
        JSON.stringify({ timestamp: 4, price: 105, bid: 104, ask: 106 })
    ].join('\n');

    const parsed = parseBitcoinHistory(input, { maxPoints: 3 });

    assert.deepEqual(parsed.map(point => point.timestamp), [1, 3, 4]);
    assert.equal(parsed[1].price, 104, 'expected the newest duplicate timestamp to win');
    assert.ok(parsed.every(point => Number.isFinite(point.spread_bps)));
});
test('parseBitcoinHistory drops a partial first row from ranged responses', () => {
    const parsed = parseBitcoinHistory([
        'ice": 99}',
        JSON.stringify({ timestamp: 2, price: 100, bid: 99, ask: 101 })
    ].join('\n'), { discardLeadingPartialLine: true });

    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].timestamp, 2);
});

test('analyzeBitcoinHistory reports trend, RSI, projection, volatility, freshness, and proxy data quality', () => {
    const history = buildHistory();
    const latestTimestamp = history.at(-1).timestamp;
    const analysis = analyzeBitcoinHistory(history, BITCOIN_INTERVALS[0], (latestTimestamp + 30) * 1000);

    assert.equal(analysis.sampleCount, 20);
    assert.equal(analysis.trend, 'bullish');
    assert.equal(analysis.rsi, 100);
    assert.equal(analysis.freshness, 'fresh');
    assert.equal(analysis.liquidityQuality, 'proxy');
    assert.ok(analysis.changePct > 0);
    assert.ok(analysis.volatilityBps > 0);
    assert.ok(analysis.projectedReturnBps > 0);
    assert.ok(analysis.projectionConfidence > 0.9);
    assert.ok(analysis.sparkline.length > 0);
});

test('buildBitcoinConsensus weights usable intervals and preserves warming-up intervals', () => {
    const rising = buildHistory({ count: 20, intervalSeconds: 60, step: 1 });
    const falling = buildHistory({ count: 2, intervalSeconds: 120, step: -1 });
    const latestTimestamp = rising.at(-1).timestamp;
    const analyses = [
        analyzeBitcoinHistory(rising, BITCOIN_INTERVALS[0], (latestTimestamp + 30) * 1000),
        analyzeBitcoinHistory(falling, BITCOIN_INTERVALS[1], (latestTimestamp + 30) * 1000)
    ];

    const consensus = buildBitcoinConsensus(analyses);

    assert.equal(consensus.label, 'bullish');
    assert.equal(consensus.usableIntervals, 1);
    assert.equal(consensus.warmingIntervals, 1);
    assert.ok(consensus.confidence > 0);
});

test('terminal formatters expose a dashboard and interval drill-down without trading instructions', () => {
    const history = buildHistory();
    const latestTimestamp = history.at(-1).timestamp;
    const analysis = analyzeBitcoinHistory(history, BITCOIN_INTERVALS[0], (latestTimestamp + 30) * 1000);
    const dashboard = formatBitcoinDashboard([analysis], { unavailableIntervals: ['2m'] });
    const detail = formatBitcoinIntervalDetail(analysis);

    assert.match(dashboard.join('\n'), /BITCOIN MARKET ANALYTICS/);
    assert.match(dashboard.join('\n'), /Multi-timeframe bias/);
    assert.match(dashboard.join('\n'), /bitcoin <interval>/);
    assert.match(dashboard.join('\n'), /informational analysis/i);
    assert.match(detail.join('\n'), /1M INTERVAL DETAIL/);
    assert.match(detail.join('\n'), /EMA/);
    assert.match(detail.join('\n'), /RSI/);
    assert.doesNotMatch([...dashboard, ...detail].join('\n'), /place order|buy now|sell now/i);
});
