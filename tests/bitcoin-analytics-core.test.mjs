import test from 'node:test';
import assert from 'node:assert/strict';

import {
    BITCOIN_INTERVALS,
    analyzeBitcoinHistory,
    backtestBitcoinForecast,
    buildBitcoinConsensus,
    buildBitcoinForecast,
    formatBitcoinDashboard,
    formatBitcoinBacktest,
    formatBitcoinForecast,
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

test('analysis adds SMA, MACD, momentum, drawdown, support/resistance, regime, pattern, and gap validation', () => {
    const history = buildHistory({ count: 60, step: 0.35 });
    history.splice(30, 1);
    const latestTimestamp = history.at(-1).timestamp;
    const analysis = analyzeBitcoinHistory(history, BITCOIN_INTERVALS[0], (latestTimestamp + 20) * 1000);

    assert.ok(analysis.smaShort > 0);
    assert.ok(analysis.smaLong > 0);
    assert.ok(Number.isFinite(analysis.macd));
    assert.ok(Number.isFinite(analysis.macdSignal));
    assert.ok(Number.isFinite(analysis.macdHistogram));
    assert.ok(analysis.momentumPct > 0);
    assert.ok(analysis.maxDrawdownPct >= 0);
    assert.ok(analysis.supportPrice <= analysis.latestPrice);
    assert.ok(analysis.resistancePrice >= analysis.supportPrice);
    assert.equal(analysis.marketCondition, 'bullish');
    assert.match(analysis.historicalPattern, /trend|breakout/);
    assert.ok(analysis.dataQuality.missingIntervals >= 1);
    assert.ok(analysis.dataQuality.coveragePct < 100);
});

test('forecast generates widening estimated ranges and labels distant horizons as speculative', () => {
    const history = buildHistory({ count: 80, step: 0.2 });
    const latestTimestamp = history.at(-1).timestamp;
    const analysis = analyzeBitcoinHistory(history, BITCOIN_INTERVALS[0], (latestTimestamp + 20) * 1000);
    const forecast = buildBitcoinForecast(analysis, { horizonBars: [1, 5, 60] });

    assert.equal(forecast.available, true);
    assert.equal(forecast.projections.length, 3);
    assert.equal(forecast.projections[0].classification, 'model_prediction');
    assert.equal(forecast.projections[2].classification, 'speculative_projection');
    assert.ok(forecast.projections[0].projectedPrice > analysis.latestPrice);
    assert.ok(forecast.projections[0].lowerPrice < forecast.projections[0].projectedPrice);
    assert.ok(forecast.projections[0].upperPrice > forecast.projections[0].projectedPrice);
    assert.ok(
        forecast.projections[2].upperPrice - forecast.projections[2].lowerPrice
        > forecast.projections[0].upperPrice - forecast.projections[0].lowerPrice
    );
    assert.match(forecast.assumptions.join(' '), /stationary|historical/i);
});

test('walk-forward backtest reports accuracy, error, interval coverage, and naive-baseline skill', () => {
    const history = buildHistory({ count: 80, step: 0.15 });
    const result = backtestBitcoinForecast(history, BITCOIN_INTERVALS[0], { horizonBars: 1, minTrainingSamples: 12 });

    assert.equal(result.available, true);
    assert.ok(result.testCount >= 50);
    assert.ok(result.mae >= 0);
    assert.ok(result.rmse >= result.mae);
    assert.ok(result.mapePct >= 0);
    assert.ok(result.directionalAccuracyPct > 90);
    assert.ok(result.rangeCoveragePct >= 0 && result.rangeCoveragePct <= 100);
    assert.ok(Number.isFinite(result.naiveMae));
    assert.ok(Number.isFinite(result.skillVsNaivePct));
});

test('forecast and backtest formatters clearly separate evidence, predictions, and speculation', () => {
    const history = buildHistory({ count: 80, step: 0.2 });
    const latestTimestamp = history.at(-1).timestamp;
    const analysis = analyzeBitcoinHistory(history, BITCOIN_INTERVALS[0], (latestTimestamp + 20) * 1000);
    const forecast = buildBitcoinForecast(analysis, { horizonBars: [1, 5, 60] });
    const backtest = backtestBitcoinForecast(history, BITCOIN_INTERVALS[0]);
    const forecastText = formatBitcoinForecast(analysis, forecast).join('\n');
    const backtestText = formatBitcoinBacktest(analysis, [backtest]).join('\n');

    assert.match(forecastText, /HISTORICAL EVIDENCE/);
    assert.match(forecastText, /MODEL PREDICTIONS/);
    assert.match(forecastText, /SPECULATIVE PROJECTIONS/);
    assert.match(forecastText, /estimated 80% range/i);
    assert.match(forecastText, /History .*\| Forecast/);
    assert.match(backtestText, /WALK-FORWARD BACKTEST/);
    assert.match(backtestText, /MAE/);
    assert.match(backtestText, /RMSE/);
    assert.match(backtestText, /MAPE/);
    assert.match(backtestText, /naive/i);
});
