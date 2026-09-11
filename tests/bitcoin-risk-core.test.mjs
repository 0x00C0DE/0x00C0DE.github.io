import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeBitcoinHistory, BITCOIN_INTERVALS } from '../src/bitcoin-analytics-core.mjs';
import * as risk from '../src/bitcoin-risk-core.mjs';

const interval = BITCOIN_INTERVALS[0];
function analyze(prices, { gap = false, stale = false } = {}) {
    const history = prices.map((price, i) => ({
        price, timestamp: 1_800_000_000 + i * interval.seconds + (gap && i >= 10 ? 600 : 0),
        bid: price, ask: price, spread_bps: 0, liquidity_is_proxy: true, liquidity_volume: 0
    }));
    return analyzeBitcoinHistory(history, interval, (history.at(-1).timestamp + (stale ? 86400 : 0)) * 1000);
}

test('risk report calculates historical 95% loss quantile and tail mean in percent', () => {
    const prices = [100];
    // 20 interval returns: one -20%, one -10%, eighteen +1%.
    for (const change of [-0.2, -0.1, ...Array(18).fill(0.01)]) prices.push(prices.at(-1) * (1 + change));
    const report = risk.buildBitcoinRiskReport(analyze(prices));
    assert.equal(report.returnCount, 20);
    assert.ok(Math.abs(report.valueAtRisk95Pct - 10) < 1e-9);
    assert.ok(Math.abs(report.expectedShortfall95Pct - 20) < 1e-9);
    assert.ok(Math.abs(report.worstReturnPct + 20) < 1e-9);
    assert.equal(report.status, 'limited'); // A 95% tail has only one observation.
    assert.match(risk.formatBitcoinRiskReport(analyze(prices)).join('\n'), /Historical 95% VaR/);
});

test('flat prices have zero losses and undefined band position, not NaN or Infinity', () => {
    const report = risk.buildBitcoinRiskReport(analyze(Array(61).fill(100)));
    assert.equal(report.valueAtRisk95Pct, 0);
    assert.equal(report.expectedShortfall95Pct, 0);
    assert.equal(report.downsideDeviationPct, 0);
    assert.equal(report.bands.middle, 100);
    assert.equal(report.bands.bandwidthPct, 0);
    assert.equal(report.bands.percentB, null);
    assert.equal(report.currentDrawdownPct, 0);
    assert.equal(report.status, 'ready');
});

test('short histories withhold tail estimates and bands instead of inventing precision', () => {
    const report = risk.buildBitcoinRiskReport(analyze([100, 99, 101]));
    assert.equal(report.valueAtRisk95Pct, null);
    assert.equal(report.bands, null);
    assert.equal(report.status, 'limited');
    assert.equal(risk.buildBitcoinRiskReport(null), null);
});

test('gaps are excluded from interval returns and break the rolling band window', () => {
    const report = risk.buildBitcoinRiskReport(analyze(Array.from({ length: 25 }, (_, i) => 100 + i), { gap: true }));
    assert.equal(report.excludedReturns, 1);
    assert.equal(report.returnCount, 23);
    assert.equal(report.bands, null);
    assert.equal(report.status, 'limited');
    assert.match(report.warnings.join(' '), /gap/i);
});

test('stale data is explicit and current drawdown measures the last price against the window peak', () => {
    const report = risk.buildBitcoinRiskReport(analyze([...Array(60).fill(100), 80], { stale: true }));
    assert.equal(report.status, 'stale');
    assert.ok(Math.abs(report.currentDrawdownPct - 20) < 1e-9);
    assert.equal(report.barsSincePeak, 1);
    assert.match(report.warnings.join(' '), /stale/i);
});
