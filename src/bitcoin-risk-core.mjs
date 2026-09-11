const MINIMUM_RETURNS = 20;
const RELIABLE_RETURNS = 60;
const BAND_WINDOW = 20;

function mean(values) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function regularInterval(before, after, seconds) {
    return Math.abs(after.timestamp - before.timestamp - seconds) <= seconds * 0.2;
}

// Only normalized history is accepted. Missing intervals must not become one-bar returns.
export function buildBitcoinRiskReport(analysis) {
    if (!analysis?.snapshots?.length) return null;
    const { snapshots, interval } = analysis;
    if (!(interval?.seconds > 0) || snapshots.some(point => (
        !Number.isFinite(point.price) || point.price <= 0 || !Number.isFinite(point.timestamp)
    ))) throw new TypeError('Risk analysis requires valid normalized prices and interval seconds');

    const returns = [];
    let excludedReturns = 0;
    let contiguousStart = 0;
    let peak = snapshots[0].price;
    let peakIndex = 0;
    snapshots.forEach((point, index) => {
        if (point.price >= peak) {
            peak = point.price;
            peakIndex = index;
        }
        if (index === 0) return;
        if (regularInterval(snapshots[index - 1], point, interval.seconds)) {
            returns.push((point.price / snapshots[index - 1].price - 1) * 100);
        } else {
            excludedReturns += 1;
            contiguousStart = index;
        }
    });
    const sorted = returns.slice().sort((a, b) => a - b);
    const enoughReturns = returns.length >= MINIMUM_RETURNS;
    // Nearest-rank 95th percentile of losses; ES averages the worst ceil(5% * N) returns.
    const tailCount = Math.ceil(returns.length * 0.05);
    const losses = returns.map(value => -value).sort((a, b) => a - b);
    const warnings = [];
    if (returns.length < RELIABLE_RETURNS) warnings.push(`Limited sample: ${returns.length} regular returns; prefer at least ${RELIABLE_RETURNS}.`);
    if (excludedReturns) warnings.push(`${excludedReturns} gap/irregular transitions excluded from interval risk.`);
    if (analysis.freshness !== 'fresh') warnings.push(`Repository data is ${analysis.freshness}; metrics describe stored history.`);
    if (analysis.dataQuality?.outlierReturns) warnings.push('Large return outliers present; inspect the source history.');

    const bandPrices = snapshots.slice(Math.max(contiguousStart, snapshots.length - BAND_WINDOW)).map(point => point.price);
    let bands = null;
    if (bandPrices.length === BAND_WINDOW) {
        const middle = mean(bandPrices);
        const deviation = Math.sqrt(mean(bandPrices.map(price => (price - middle) ** 2)));
        const lower = middle - 2 * deviation;
        const upper = middle + 2 * deviation;
        bands = {
            middle, lower, upper,
            bandwidthPct: (upper - lower) / middle * 100,
            percentB: upper > lower ? (snapshots.at(-1).price - lower) / (upper - lower) * 100 : null
        };
    }
    return {
        status: analysis.freshness === 'stale' ? 'stale' : warnings.length ? 'limited' : 'ready',
        warnings,
        returnCount: returns.length,
        excludedReturns,
        tailCount: enoughReturns ? tailCount : 0,
        valueAtRisk95Pct: enoughReturns ? Math.max(0, losses[Math.ceil(losses.length * 0.95) - 1]) : null,
        expectedShortfall95Pct: enoughReturns ? Math.max(0, -mean(sorted.slice(0, tailCount))) : null,
        downsideDeviationPct: enoughReturns ? Math.sqrt(mean(returns.map(value => Math.min(0, value) ** 2))) : null,
        worstReturnPct: sorted[0] ?? null,
        bestReturnPct: sorted.at(-1) ?? null,
        positiveReturnPct: returns.length ? returns.filter(value => value > 0).length / returns.length * 100 : null,
        currentDrawdownPct: (1 - snapshots.at(-1).price / peak) * 100,
        barsSincePeak: snapshots.length - 1 - peakIndex,
        secondsSincePeak: snapshots.at(-1).timestamp - snapshots[peakIndex].timestamp,
        bands
    };
}

function percent(value) {
    return value === null ? 'unavailable' : `${value.toFixed(3)}%`;
}

function money(value) {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatBitcoinRiskSummary(analysis) {
    const report = buildBitcoinRiskReport(analysis);
    if (!report) return [];
    return [
        `Risk data: ${report.status.toUpperCase()} | ${report.returnCount} regular returns | ${report.excludedReturns} excluded gaps`,
        `Historical 95% VaR ${percent(report.valueAtRisk95Pct)} | expected shortfall ${percent(report.expectedShortfall95Pct)} | per ${analysis.interval.label} interval`,
        report.bands
            ? `Bollinger (20, 2): ${money(report.bands.lower)} / ${money(report.bands.middle)} / ${money(report.bands.upper)} | bandwidth ${percent(report.bands.bandwidthPct)} | %B ${percent(report.bands.percentB)}`
            : 'Bollinger (20, 2): unavailable; requires 20 consecutive regular observations.'
    ];
}

export function formatBitcoinRiskReport(analysis) {
    const report = buildBitcoinRiskReport(analysis);
    if (!report) return ['bitcoin: the requested interval has no valid history'];
    return [
        `BITCOIN ${analysis.interval.label} RISK REPORT`,
        '===========================',
        `Window (UTC): ${new Date(analysis.earliestTimestamp * 1000).toISOString()} to ${new Date(analysis.latestTimestamp * 1000).toISOString()}`,
        `Stored data: ${analysis.freshness} | age ${Math.round(analysis.ageSeconds / 60)} minutes | coverage ${analysis.dataQuality.coveragePct.toFixed(1)}%`,
        ...formatBitcoinRiskSummary(analysis),
        `Downside deviation ${percent(report.downsideDeviationPct)} | positive returns ${percent(report.positiveReturnPct)}`,
        `Worst interval ${percent(report.worstReturnPct)} | best interval ${percent(report.bestReturnPct)}`,
        `Current drawdown ${percent(report.currentDrawdownPct)} | maximum drawdown ${percent(analysis.maxDrawdownPct)} | ${report.barsSincePeak} observations since window peak (${Math.round(report.secondsSincePeak / 60)} minutes)`,
        ...report.warnings.map(warning => `Note: ${warning}`),
        '',
        `Method: simple price returns; nearest-rank 95th percentile of losses; tail mean uses the worst ${report.tailCount} returns (ceil 5% of N). Loss estimates are floored at zero.`,
        'Tail estimates require 20 regular returns; gaps beyond 20% of interval spacing are excluded. Downside deviation uses a zero-return target.',
        'Bollinger bands use a 20-observation mean and population standard deviation; %B can fall outside 0–100%.',
        'Historical diagnostics, not a loss limit or a calibrated forecast. No annualization, fees, slippage, or portfolio exposure included.',
        `Explore: bitcoin ${analysis.interval.id} | bitcoin forecast ${analysis.interval.id} | bitcoin backtest ${analysis.interval.id}`
    ];
}
