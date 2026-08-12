export const BITCOIN_INTERVALS = Object.freeze([
    Object.freeze({ id: '1m', label: '1M', seconds: 60, filename: 'PROPRTS-job_1m-unlimited-history.txt' }),
    Object.freeze({ id: '2m', label: '2M', seconds: 120, filename: 'PROPRTS-job_2m-unlimited-history.txt' }),
    Object.freeze({ id: '5m', label: '5M', seconds: 300, filename: 'PROPRTS-job_5m-unlimited-history.txt' }),
    Object.freeze({ id: '10m', label: '10M', seconds: 600, filename: 'PROPRTS-job_10m-unlimited-history.txt' }),
    Object.freeze({ id: '15m', label: '15M', seconds: 900, filename: 'PROPRTS-job_15m-unlimited-history.txt' }),
    Object.freeze({ id: '30m', label: '30M', seconds: 1800, filename: 'PROPRTS-job_30m-unlimited-history.txt' }),
    Object.freeze({ id: '1h', label: '1H', seconds: 3600, filename: 'PROPRTS-job_1h-unlimited-history.txt' }),
    Object.freeze({ id: '2h', label: '2H', seconds: 7200, filename: 'PROPRTS-job_2h-unlimited-history.txt' })
]);

const SPARKLINE_GLYPHS = '▁▂▃▄▅▆▇█';
const RSI_PERIOD = 14;
const SHORT_EMA_SPAN = 5;
const LONG_EMA_SPAN = 13;
const SHORT_SMA_WINDOW = 5;
const LONG_SMA_WINDOW = 20;
const MACD_FAST_SPAN = 12;
const MACD_SLOW_SPAN = 26;
const MACD_SIGNAL_SPAN = 9;
const MOMENTUM_WINDOW = 5;
const FORECAST_MIN_SAMPLES = 8;
const FORECAST_RANGE_Z = 1.28155;
const MAX_PROJECTION_BPS = 1000;

function clamp(value, lower, upper) {
    return Math.max(lower, Math.min(upper, value));
}

function finiteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function average(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values) {
    if (!values.length) {
        return 0;
    }
    const mean = average(values);
    return Math.sqrt(average(values.map(value => (value - mean) ** 2)));
}

function median(values) {
    if (!values.length) {
        return 0;
    }
    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[middle - 1] + sorted[middle]) / 2
        : sorted[middle];
}

function quantile(values, percentile) {
    if (!values.length) {
        return 0;
    }
    const sorted = [...values].sort((left, right) => left - right);
    const position = clamp(percentile, 0, 1) * (sorted.length - 1);
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    if (lowerIndex === upperIndex) {
        return sorted[lowerIndex];
    }
    const weight = position - lowerIndex;
    return (sorted[lowerIndex] * (1 - weight)) + (sorted[upperIndex] * weight);
}

function computeEma(values, span) {
    if (!values.length) {
        return 0;
    }
    const alpha = 2 / (span + 1);
    return values.slice(1).reduce(
        (current, value) => (alpha * value) + ((1 - alpha) * current),
        values[0]
    );
}

function computeEmaSeries(values, span) {
    if (!values.length) {
        return [];
    }
    const alpha = 2 / (span + 1);
    const series = [values[0]];
    values.slice(1).forEach(value => {
        series.push((alpha * value) + ((1 - alpha) * series.at(-1)));
    });
    return series;
}

function computeMacd(values) {
    if (!values.length) {
        return { macd: 0, signal: 0, histogram: 0 };
    }
    const fast = computeEmaSeries(values, MACD_FAST_SPAN);
    const slow = computeEmaSeries(values, MACD_SLOW_SPAN);
    const macdSeries = fast.map((value, index) => value - slow[index]);
    const signalSeries = computeEmaSeries(macdSeries, MACD_SIGNAL_SPAN);
    const macd = macdSeries.at(-1);
    const signal = signalSeries.at(-1);
    return { macd, signal, histogram: macd - signal };
}

function fitLogTrend(values) {
    const logs = values.filter(value => value > 0).map(value => Math.log(value));
    if (logs.length < 3) {
        return { slope: 0, rSquared: 0, residualStdDev: 0 };
    }
    const xMean = (logs.length - 1) / 2;
    const yMean = average(logs);
    let numerator = 0;
    let denominator = 0;
    logs.forEach((value, index) => {
        const centeredX = index - xMean;
        numerator += centeredX * (value - yMean);
        denominator += centeredX ** 2;
    });
    const slope = denominator > 0 ? numerator / denominator : 0;
    const intercept = yMean - (slope * xMean);
    const residuals = logs.map((value, index) => value - (intercept + (slope * index)));
    const totalVariance = logs.reduce((sum, value) => sum + ((value - yMean) ** 2), 0);
    const residualVariance = residuals.reduce((sum, value) => sum + (value ** 2), 0);
    return {
        slope,
        rSquared: totalVariance > 0 ? clamp(1 - (residualVariance / totalVariance), 0, 1) : 0,
        residualStdDev: standardDeviation(residuals)
    };
}

function computeMaxDrawdownPct(values) {
    let peak = values[0] || 0;
    let maximum = 0;
    values.forEach(value => {
        peak = Math.max(peak, value);
        if (peak > 0) {
            maximum = Math.max(maximum, ((peak - value) / peak) * 100);
        }
    });
    return maximum;
}

function assessDataQuality(snapshots, intervalSeconds) {
    if (!snapshots.length) {
        return { coveragePct: 0, expectedSamples: 0, missingIntervals: 0, irregularIntervals: 0, outlierReturns: 0 };
    }
    let missingIntervals = 0;
    let irregularIntervals = 0;
    for (let index = 1; index < snapshots.length; index += 1) {
        const elapsed = snapshots[index].timestamp - snapshots[index - 1].timestamp;
        const expectedBars = Math.max(1, Math.round(elapsed / intervalSeconds));
        missingIntervals += Math.max(0, expectedBars - 1);
        if (Math.abs(elapsed - (expectedBars * intervalSeconds)) > intervalSeconds * 0.2) {
            irregularIntervals += 1;
        }
    }
    const span = snapshots.at(-1).timestamp - snapshots[0].timestamp;
    const expectedSamples = Math.max(1, Math.round(span / intervalSeconds) + 1);
    const returns = snapshots.slice(1).map((snapshot, index) => Math.log(snapshot.price / snapshots[index].price));
    const returnMedian = median(returns);
    const medianAbsoluteDeviation = median(returns.map(value => Math.abs(value - returnMedian)));
    const outlierThreshold = Math.max(medianAbsoluteDeviation * 6, 0.000001);
    return {
        coveragePct: clamp((snapshots.length / expectedSamples) * 100, 0, 100),
        expectedSamples,
        missingIntervals,
        irregularIntervals,
        outlierReturns: returns.filter(value => Math.abs(value - returnMedian) > outlierThreshold).length
    };
}

function normalizedSlope(values) {
    if (values.length < 2) {
        return 0;
    }
    const xMean = (values.length - 1) / 2;
    const yMean = average(values);
    let numerator = 0;
    let denominator = 0;
    values.forEach((value, index) => {
        const centeredX = index - xMean;
        numerator += centeredX * (value - yMean);
        denominator += centeredX ** 2;
    });
    const slope = denominator > 0 ? numerator / denominator : 0;
    return values.at(-1) ? slope / values.at(-1) : 0;
}

function computeRsi(values, period = RSI_PERIOD) {
    if (values.length < period + 1) {
        return null;
    }
    const window = values.slice(-(period + 1));
    const gains = [];
    const losses = [];
    for (let index = 1; index < window.length; index += 1) {
        const delta = window[index] - window[index - 1];
        gains.push(Math.max(delta, 0));
        losses.push(Math.max(-delta, 0));
    }
    const averageGain = average(gains);
    const averageLoss = average(losses);
    if (averageLoss === 0) {
        return averageGain > 0 ? 100 : 50;
    }
    const relativeStrength = averageGain / averageLoss;
    return 100 - (100 / (1 + relativeStrength));
}

function computeLogProjection(values) {
    const sample = values.slice(-20);
    if (sample.length < 3) {
        return { projectedReturnBps: 0, projectionConfidence: 0 };
    }
    const logs = sample.map(value => Math.log(value));
    const xMean = (logs.length - 1) / 2;
    const yMean = average(logs);
    let numerator = 0;
    let denominator = 0;
    logs.forEach((value, index) => {
        const centeredX = index - xMean;
        numerator += centeredX * (value - yMean);
        denominator += centeredX ** 2;
    });
    const slope = denominator > 0 ? numerator / denominator : 0;
    const intercept = yMean - (slope * xMean);
    const totalVariance = logs.reduce((sum, value) => sum + ((value - yMean) ** 2), 0);
    const residualVariance = logs.reduce((sum, value, index) => {
        const residual = value - (intercept + (slope * index));
        return sum + (residual ** 2);
    }, 0);
    const rSquared = totalVariance > 0 ? clamp(1 - (residualVariance / totalVariance), 0, 1) : 0;
    return {
        projectedReturnBps: clamp(slope * 10_000, -MAX_PROJECTION_BPS, MAX_PROJECTION_BPS),
        projectionConfidence: rSquared
    };
}

function buildSparkline(values, width = 24) {
    if (!values.length) {
        return '';
    }
    const sample = values.slice(-width);
    const low = Math.min(...sample);
    const high = Math.max(...sample);
    if (high === low) {
        return SPARKLINE_GLYPHS[Math.floor(SPARKLINE_GLYPHS.length / 2)].repeat(sample.length);
    }
    return sample.map(value => {
        const ratio = (value - low) / (high - low);
        const glyphIndex = Math.round(ratio * (SPARKLINE_GLYPHS.length - 1));
        return SPARKLINE_GLYPHS[glyphIndex];
    }).join('');
}

function normalizeSnapshot(payload) {
    if (!payload || typeof payload !== 'object') {
        return null;
    }
    const timestamp = finiteNumber(payload.timestamp, NaN);
    const price = finiteNumber(payload.price, NaN);
    if (!Number.isFinite(timestamp) || timestamp <= 0 || !Number.isFinite(price) || price <= 0) {
        return null;
    }
    const bid = finiteNumber(payload.bid, price);
    const ask = finiteNumber(payload.ask, price);
    const derivedSpreadBps = price > 0 ? (Math.max(ask - bid, 0) / price) * 10_000 : 0;
    return {
        timestamp,
        price,
        bid,
        ask,
        spread_bps: Math.max(finiteNumber(payload.spread_bps, derivedSpreadBps), 0),
        bid_size: Math.max(finiteNumber(payload.bid_size), 0),
        ask_size: Math.max(finiteNumber(payload.ask_size), 0),
        liquidity_volume: Math.max(finiteNumber(payload.liquidity_volume), 0),
        liquidity_is_proxy: Boolean(payload.liquidity_is_proxy)
    };
}

export function parseBitcoinHistory(text, options = {}) {
    const { discardLeadingPartialLine = false, maxPoints = 512 } = options;
    const lines = String(text || '').split(/\r?\n/);
    if (discardLeadingPartialLine && lines.length) {
        lines.shift();
    }
    const byTimestamp = new Map();
    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) {
            return;
        }
        try {
            const snapshot = normalizeSnapshot(JSON.parse(trimmed));
            if (snapshot) {
                byTimestamp.set(snapshot.timestamp, snapshot);
            }
        } catch {
            // A partially written or ranged JSONL row is safely ignored.
        }
    });
    return [...byTimestamp.values()]
        .sort((left, right) => left.timestamp - right.timestamp)
        .slice(-Math.max(1, finiteNumber(maxPoints, 512)));
}

function classifyMomentum(prices, emaShort, emaLong, rsi) {
    if (prices.length < 8) {
        return 'warming_up';
    }
    const returns = prices.slice(1).map((price, index) => (price - prices[index]) / prices[index]);
    const recentImpulse = average(returns.slice(-3));
    const priorImpulse = average(returns.slice(-6, -3));
    const acceleration = recentImpulse - priorImpulse;
    const gap = emaShort - emaLong;
    if (gap > 0 && acceleration > 0) {
        return 'bullish_acceleration';
    }
    if (gap < 0 && acceleration < 0) {
        return 'bearish_acceleration';
    }
    if (gap > 0 && acceleration < 0 && rsi !== null && rsi > 68) {
        return 'bullish_exhaustion';
    }
    if (gap < 0 && acceleration > 0 && rsi !== null && rsi < 32) {
        return 'bearish_exhaustion';
    }
    return 'neutral_rotation';
}

function classifyFreshness(ageSeconds, intervalSeconds) {
    if (ageSeconds <= intervalSeconds * 2.5) {
        return 'fresh';
    }
    if (ageSeconds <= intervalSeconds * 6) {
        return 'delayed';
    }
    return 'stale';
}

function classifyMarketCondition({ trendScore, macdHistogram, latestPrice, momentumPct, rsi }) {
    const normalizedMacd = latestPrice > 0 ? macdHistogram / latestPrice : 0;
    const rsiBias = rsi === null ? 0 : clamp((rsi - 50) / 50, -1, 1);
    const conditionScore = (trendScore * 0.55)
        + (clamp(normalizedMacd * 500, -1, 1) * 0.2)
        + (clamp(momentumPct / 2, -1, 1) * 0.15)
        + (rsiBias * 0.1);
    if (conditionScore > 0.08) {
        return 'bullish';
    }
    if (conditionScore < -0.08) {
        return 'bearish';
    }
    return 'neutral';
}

function identifyHistoricalPattern(prices, trendScore, projectionConfidence, volatilityBps) {
    if (prices.length < 6) {
        return 'insufficient_history';
    }
    const latest = prices.at(-1);
    const comparison = prices.slice(-21, -1);
    const priorHigh = Math.max(...comparison);
    const priorLow = Math.min(...comparison);
    if (latest > priorHigh) {
        return 'upside_breakout';
    }
    if (latest < priorLow) {
        return 'downside_breakout';
    }
    if (projectionConfidence >= 0.35 && trendScore > 0.08) {
        return 'persistent_uptrend';
    }
    if (projectionConfidence >= 0.35 && trendScore < -0.08) {
        return 'persistent_downtrend';
    }
    if (volatilityBps < 8) {
        return 'low_volatility_range';
    }
    return 'mixed_rotation';
}

function fitForecastModel(prices) {
    if (!Array.isArray(prices) || prices.length < FORECAST_MIN_SAMPLES) {
        return null;
    }
    const sample = prices.slice(-96);
    const logReturns = sample.slice(1).map((price, index) => Math.log(price / sample[index]));
    const regression = fitLogTrend(sample.slice(-48));
    const robustDrift = median(logReturns);
    const recentMomentum = average(logReturns.slice(-Math.min(5, logReturns.length)));
    const emaShort = computeEma(sample, SHORT_EMA_SPAN);
    const emaLong = computeEma(sample, LONG_EMA_SPAN);
    const emaGap = emaLong > 0 ? Math.log(emaShort / emaLong) : 0;
    const latest = sample.at(-1);
    const meanReversion = emaLong > 0 ? Math.log(emaLong / latest) : 0;
    const volatility = standardDeviation(logReturns);
    const rawReturn = (robustDrift * 0.3)
        + (regression.slope * (0.25 + (0.15 * regression.rSquared)))
        + (recentMomentum * 0.25)
        + ((emaGap / 8) * 0.12)
        + (meanReversion * 0.08);
    const perBarLimit = Math.max(volatility * 3, 0.0002);
    return {
        perBarLogReturn: clamp(rawReturn, -perBarLimit, perBarLimit),
        volatility: Math.max(volatility, 0.000001),
        residualStdDev: Math.max(regression.residualStdDev, 0.000001),
        rSquared: regression.rSquared,
        sampleCount: sample.length
    };
}

function projectWithModel(model, latestPrice, horizonBars, totalSamples) {
    const bars = Math.max(1, Math.round(finiteNumber(horizonBars, 1)));
    const decayBars = clamp(totalSamples / 2, 6, 48);
    const effectiveBars = decayBars * (1 - Math.exp(-bars / decayBars));
    const expectedLogReturn = model.perBarLogReturn * effectiveBars;
    const uncertaintyPerBar = Math.max(model.volatility, model.residualStdDev * 0.35, 0.000001);
    const extrapolationPenalty = 1 + ((bars / Math.max(totalSamples, 1)) * 0.75);
    const rangeLogWidth = FORECAST_RANGE_Z * uncertaintyPerBar * Math.sqrt(bars) * extrapolationPenalty;
    return {
        projectedPrice: latestPrice * Math.exp(expectedLogReturn),
        expectedReturnPct: (Math.exp(expectedLogReturn) - 1) * 100,
        lowerPrice: latestPrice * Math.exp(expectedLogReturn - rangeLogWidth),
        upperPrice: latestPrice * Math.exp(expectedLogReturn + rangeLogWidth),
        rangeLogWidth
    };
}

function formatHorizon(bars, intervalSeconds) {
    const seconds = bars * intervalSeconds;
    if (seconds < 3600) {
        return `${Math.round(seconds / 60)}m`;
    }
    if (seconds < 86400) {
        const hours = seconds / 3600;
        return `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;
    }
    const days = seconds / 86400;
    return `${Number.isInteger(days) ? days : days.toFixed(1)}d`;
}

function defaultForecastHorizonBars(interval) {
    const desiredSeconds = [interval.seconds, 300, 900, 1800, 3600, 14400, 86400];
    return [...new Set(desiredSeconds
        .filter(seconds => seconds >= interval.seconds)
        .map(seconds => Math.max(1, Math.round(seconds / interval.seconds))))];
}

export function analyzeBitcoinHistory(history, interval, nowMs = Date.now()) {
    if (!Array.isArray(history) || history.length === 0) {
        return null;
    }
    const snapshots = history.slice().sort((left, right) => left.timestamp - right.timestamp);
    const prices = snapshots.map(snapshot => snapshot.price);
    const latest = snapshots.at(-1);
    const earliest = snapshots[0];
    const smaShort = average(prices.slice(-SHORT_SMA_WINDOW));
    const smaLong = average(prices.slice(-LONG_SMA_WINDOW));
    const emaShort = computeEma(prices, SHORT_EMA_SPAN);
    const emaLong = computeEma(prices, LONG_EMA_SPAN);
    const macd = computeMacd(prices);
    const slope = normalizedSlope(prices.slice(-13));
    const emaGap = emaLong > 0 ? (emaShort - emaLong) / emaLong : 0;
    const trendScore = prices.length >= 3 ? clamp((emaGap * 250) + (slope * 150), -1, 1) : 0;
    const trend = prices.length < 3
        ? 'warming_up'
        : trendScore > 0.05
            ? 'bullish'
            : trendScore < -0.05
                ? 'bearish'
                : 'neutral';
    const rsi = computeRsi(prices);
    const priceMean = average(prices);
    const priceStdDev = standardDeviation(prices);
    const zScore = prices.length >= 5 && priceStdDev > 0 ? (latest.price - priceMean) / priceStdDev : null;
    const logReturns = prices.slice(1).map((price, index) => Math.log(price / prices[index]));
    const volatilityBps = standardDeviation(logReturns) * 10_000;
    const momentumBaseline = prices.at(-(Math.min(MOMENTUM_WINDOW, prices.length - 1) + 1));
    const momentumPct = momentumBaseline > 0 ? ((latest.price / momentumBaseline) - 1) * 100 : 0;
    const maxDrawdownPct = computeMaxDrawdownPct(prices);
    const spreadValues = snapshots.map(snapshot => snapshot.spread_bps).filter(value => value > 0);
    const medianSpreadBps = median(spreadValues);
    const spreadRatio = medianSpreadBps > 0 ? latest.spread_bps / medianSpreadBps : 1;
    const spreadState = spreadRatio > 1.35 ? 'wide' : spreadRatio < 0.75 ? 'tight' : 'normal';
    const ageSeconds = Math.max(0, (nowMs / 1000) - latest.timestamp);
    const projection = computeLogProjection(prices);
    const proxyRatio = snapshots.filter(snapshot => snapshot.liquidity_is_proxy).length / snapshots.length;
    const latestLiquidity = latest.liquidity_volume;
    const baselineLiquidity = average(snapshots.slice(-8, -1).map(snapshot => snapshot.liquidity_volume).filter(value => value > 0));
    const liquidityRatio = baselineLiquidity > 0 ? latestLiquidity / baselineLiquidity : null;
    const levelWindow = prices.slice(-Math.min(prices.length, 60));
    const supportPrice = Math.min(latest.price, quantile(levelWindow, 0.2));
    const resistancePrice = Math.max(latest.price, quantile(levelWindow, 0.8));
    const marketCondition = classifyMarketCondition({
        trendScore,
        macdHistogram: macd.histogram,
        latestPrice: latest.price,
        momentumPct,
        rsi
    });
    const historicalPattern = identifyHistoricalPattern(
        prices,
        trendScore,
        projection.projectionConfidence,
        volatilityBps
    );
    const dataQuality = assessDataQuality(snapshots, interval.seconds);

    return {
        interval,
        sampleCount: snapshots.length,
        earliestTimestamp: earliest.timestamp,
        latestTimestamp: latest.timestamp,
        latestPrice: latest.price,
        latestBid: latest.bid,
        latestAsk: latest.ask,
        latestSpreadBps: latest.spread_bps,
        medianSpreadBps,
        spreadState,
        changePct: ((latest.price / earliest.price) - 1) * 100,
        rangePct: priceMean > 0 ? ((Math.max(...prices) - Math.min(...prices)) / priceMean) * 100 : 0,
        lowPrice: Math.min(...prices),
        highPrice: Math.max(...prices),
        smaShort,
        smaLong,
        emaShort,
        emaLong,
        emaGapPct: emaGap * 100,
        slopePctPerBar: slope * 100,
        trend,
        trendScore,
        marketCondition,
        historicalPattern,
        momentum: classifyMomentum(prices, emaShort, emaLong, rsi),
        momentumPct,
        rsi,
        zScore,
        macd: macd.macd,
        macdSignal: macd.signal,
        macdHistogram: macd.histogram,
        volatilityBps,
        maxDrawdownPct,
        supportPrice,
        resistancePrice,
        projectedReturnBps: projection.projectedReturnBps,
        projectionConfidence: projection.projectionConfidence,
        freshness: classifyFreshness(ageSeconds, interval.seconds),
        ageSeconds,
        liquidityQuality: proxyRatio >= 0.5 ? 'proxy' : 'order_book',
        liquidityRatio,
        dataQuality,
        sparkline: buildSparkline(prices),
        snapshots
    };
}

export function buildBitcoinForecast(analysis, options = {}) {
    if (!analysis?.snapshots?.length || analysis.snapshots.length < FORECAST_MIN_SAMPLES) {
        return {
            available: false,
            reason: `at least ${FORECAST_MIN_SAMPLES} valid samples are required`,
            projections: [],
            assumptions: []
        };
    }
    const prices = analysis.snapshots.map(snapshot => snapshot.price);
    const model = fitForecastModel(prices);
    if (!model) {
        return { available: false, reason: 'the forecast model could not be fitted', projections: [], assumptions: [] };
    }
    const requestedHorizons = Array.isArray(options.horizonBars) && options.horizonBars.length
        ? options.horizonBars
        : defaultForecastHorizonBars(analysis.interval);
    const horizonBars = [...new Set(requestedHorizons
        .map(value => Math.round(finiteNumber(value, 0)))
        .filter(value => value > 0))]
        .sort((left, right) => left - right);
    const modelBackedLimit = Math.max(1, Math.floor((model.sampleCount - 1) / 3));
    const projections = horizonBars.map(bars => ({
        horizonBars: bars,
        horizonLabel: formatHorizon(bars, analysis.interval.seconds),
        classification: analysis.sampleCount >= 12 && bars <= modelBackedLimit
            ? 'model_prediction'
            : 'speculative_projection',
        rangeLevel: 0.8,
        ...projectWithModel(model, analysis.latestPrice, bars, model.sampleCount)
    }));
    return {
        available: projections.length > 0,
        method: 'robust drift + log trend + EMA/momentum ensemble with damped extrapolation',
        sampleCount: analysis.sampleCount,
        modelBackedLimit,
        modelFit: model.rSquared,
        projections,
        assumptions: [
            'Recent historical return, trend, volatility, and momentum relationships remain approximately stationary.',
            'Estimated 80% ranges use historical residual/return dispersion; they are not guaranteed confidence intervals.',
            'The repository observations are a small, uneven sample and may omit news, liquidity shocks, and regime changes.',
            'Horizons beyond the walk-forward evidence window are labeled speculative and use deliberately wider ranges.'
        ]
    };
}

export function backtestBitcoinForecast(history, interval, options = {}) {
    const snapshots = (Array.isArray(history) ? history : [])
        .filter(snapshot => Number.isFinite(snapshot?.price) && snapshot.price > 0)
        .slice()
        .sort((left, right) => left.timestamp - right.timestamp);
    const horizonBars = Math.max(1, Math.round(finiteNumber(options.horizonBars, 1)));
    const minTrainingSamples = Math.max(FORECAST_MIN_SAMPLES, Math.round(finiteNumber(options.minTrainingSamples, 12)));
    if (snapshots.length < minTrainingSamples + horizonBars) {
        return {
            available: false,
            interval,
            horizonBars,
            horizonLabel: formatHorizon(horizonBars, interval.seconds),
            reason: `at least ${minTrainingSamples + horizonBars} samples are required`,
            testCount: 0
        };
    }

    const errors = [];
    const squaredErrors = [];
    const percentageErrors = [];
    const naiveErrors = [];
    let directionCorrect = 0;
    let rangeCovered = 0;
    for (let targetIndex = minTrainingSamples + horizonBars - 1; targetIndex < snapshots.length; targetIndex += 1) {
        const trainingEnd = targetIndex - horizonBars + 1;
        const trainingPrices = snapshots.slice(0, trainingEnd).map(snapshot => snapshot.price);
        const model = fitForecastModel(trainingPrices);
        if (!model) {
            continue;
        }
        const latestTrainingPrice = trainingPrices.at(-1);
        const actualPrice = snapshots[targetIndex].price;
        const projection = projectWithModel(model, latestTrainingPrice, horizonBars, model.sampleCount);
        const error = Math.abs(projection.projectedPrice - actualPrice);
        errors.push(error);
        squaredErrors.push(error ** 2);
        percentageErrors.push((error / actualPrice) * 100);
        naiveErrors.push(Math.abs(latestTrainingPrice - actualPrice));
        const predictedDirection = Math.sign(projection.projectedPrice - latestTrainingPrice);
        const actualDirection = Math.sign(actualPrice - latestTrainingPrice);
        if (predictedDirection === actualDirection || (predictedDirection === 0 && actualDirection === 0)) {
            directionCorrect += 1;
        }
        if (actualPrice >= projection.lowerPrice && actualPrice <= projection.upperPrice) {
            rangeCovered += 1;
        }
    }
    if (!errors.length) {
        return {
            available: false,
            interval,
            horizonBars,
            horizonLabel: formatHorizon(horizonBars, interval.seconds),
            reason: 'no valid walk-forward evaluation windows were available',
            testCount: 0
        };
    }
    const mae = average(errors);
    const naiveMae = average(naiveErrors);
    return {
        available: true,
        interval,
        horizonBars,
        horizonLabel: formatHorizon(horizonBars, interval.seconds),
        testCount: errors.length,
        mae,
        rmse: Math.sqrt(average(squaredErrors)),
        mapePct: average(percentageErrors),
        directionalAccuracyPct: (directionCorrect / errors.length) * 100,
        rangeCoveragePct: (rangeCovered / errors.length) * 100,
        naiveMae,
        skillVsNaivePct: naiveMae > 0 ? ((naiveMae - mae) / naiveMae) * 100 : 0
    };
}

export function buildBitcoinConsensus(analyses) {
    const all = (Array.isArray(analyses) ? analyses : []).filter(Boolean);
    const usable = all.filter(analysis => analysis.trend !== 'warming_up');
    const weighted = usable.map(analysis => {
        const sampleWeight = Math.min(analysis.sampleCount / 20, 1);
        const freshnessWeight = analysis.freshness === 'fresh' ? 1 : analysis.freshness === 'delayed' ? 0.6 : 0.2;
        return { score: analysis.trendScore, weight: Math.max(sampleWeight * freshnessWeight, 0.05) };
    });
    const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
    const score = totalWeight > 0
        ? weighted.reduce((sum, item) => sum + (item.score * item.weight), 0) / totalWeight
        : 0;
    const label = usable.length === 0
        ? 'warming_up'
        : score > 0.08
            ? 'bullish'
            : score < -0.08
                ? 'bearish'
                : 'neutral';
    const directional = usable.filter(analysis => analysis.trend === 'bullish' || analysis.trend === 'bearish');
    const aligned = directional.filter(analysis => analysis.trend === label).length;
    const alignment = directional.length ? aligned / directional.length : 0;
    const coverage = all.length ? usable.length / all.length : 0;
    return {
        label,
        score,
        confidence: clamp(((Math.abs(score) * 0.65) + (alignment * 0.35)) * coverage, 0, 1),
        alignment,
        usableIntervals: usable.length,
        warmingIntervals: all.length - usable.length
    };
}

function formatMoney(value) {
    return `$${finiteNumber(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatSigned(value, digits = 2, suffix = '') {
    const number = finiteNumber(value);
    const sign = number > 0 ? '+' : '';
    return `${sign}${number.toFixed(digits)}${suffix}`;
}

function formatAge(ageSeconds) {
    if (ageSeconds < 90) {
        return `${Math.round(ageSeconds)}s`;
    }
    if (ageSeconds < 5400) {
        return `${Math.round(ageSeconds / 60)}m`;
    }
    return `${(ageSeconds / 3600).toFixed(1)}h`;
}

function formatRsi(value) {
    return value === null ? '--' : value.toFixed(1);
}

function formatProjectionRows(projections) {
    return projections.map(projection => (
        `${projection.horizonLabel.padEnd(5)} ${formatMoney(projection.projectedPrice).padEnd(14)} return ${formatSigned(projection.expectedReturnPct, 2, '%').padEnd(9)} | estimated 80% range ${formatMoney(projection.lowerPrice)} - ${formatMoney(projection.upperPrice)}`
    ));
}

export function formatBitcoinForecast(analysis, forecast) {
    if (!analysis) {
        return ['bitcoin: the requested interval has no valid history'];
    }
    const title = `BITCOIN ${analysis.interval.label} FORECAST`;
    if (!forecast?.available) {
        return [
            title,
            '='.repeat(title.length),
            `Forecast unavailable: ${forecast?.reason || 'insufficient valid history'}`,
            'More repository observations are required before a probabilistic estimate can be calculated.'
        ];
    }
    const modelPredictions = forecast.projections.filter(item => item.classification === 'model_prediction');
    const speculativeProjections = forecast.projections.filter(item => item.classification === 'speculative_projection');
    const forecastPath = buildSparkline([
        analysis.latestPrice,
        ...forecast.projections.map(item => item.projectedPrice)
    ], 32);
    const lines = [
        title,
        '='.repeat(title.length),
        'HISTORICAL EVIDENCE',
        `Samples ${analysis.sampleCount} | coverage ${analysis.dataQuality.coveragePct.toFixed(1)}% | condition ${analysis.marketCondition} | pattern ${analysis.historicalPattern}`,
        `Price ${formatMoney(analysis.latestPrice)} | window return ${formatSigned(analysis.changePct, 2, '%')} | volatility ${analysis.volatilityBps.toFixed(2)} bps/bar`,
        `Support ${formatMoney(analysis.supportPrice)} | resistance ${formatMoney(analysis.resistancePrice)} | model fit ${(forecast.modelFit * 100).toFixed(1)}%`,
        `History ${analysis.sparkline} | Forecast ${forecastPath}`,
        '',
        'MODEL PREDICTIONS'
    ];
    lines.push(...(modelPredictions.length
        ? formatProjectionRows(modelPredictions)
        : ['No horizon is short enough to be supported by the current walk-forward evidence window.']));
    lines.push('', 'SPECULATIVE PROJECTIONS');
    lines.push(...(speculativeProjections.length
        ? formatProjectionRows(speculativeProjections)
        : ['No speculative horizons were requested.']));
    lines.push(
        '',
        `Method: ${forecast.method}.`,
        'ASSUMPTIONS AND LIMITATIONS',
        ...forecast.assumptions.map(assumption => `- ${assumption}`),
        '',
        'Probabilistic estimates only; they are not guaranteed outcomes or financial advice.'
    );
    return lines;
}

export function formatBitcoinBacktest(analysis, results) {
    if (!analysis) {
        return ['bitcoin: the requested interval has no valid history'];
    }
    const title = `BITCOIN ${analysis.interval.label} WALK-FORWARD BACKTEST`;
    const evaluations = (Array.isArray(results) ? results : [results]).filter(Boolean);
    const lines = [
        title,
        '='.repeat(title.length),
        'Each prediction is fitted only to observations available before its historical target.',
        '',
        'HORIZON  TESTS  MAE          RMSE         MAPE      DIRECTION  80% RANGE  VS NAIVE',
        '-------  -----  -----------  -----------  --------  ---------  ---------  --------'
    ];
    evaluations.forEach(result => {
        if (!result.available) {
            lines.push(`${result.horizonLabel.padEnd(8)} unavailable: ${result.reason}`);
            return;
        }
        lines.push(
            `${result.horizonLabel.padEnd(8)} ${String(result.testCount).padEnd(6)} ${formatMoney(result.mae).padEnd(12)} ${formatMoney(result.rmse).padEnd(12)} ${`${result.mapePct.toFixed(3)}%`.padEnd(9)} ${`${result.directionalAccuracyPct.toFixed(1)}%`.padEnd(10)} ${`${result.rangeCoveragePct.toFixed(1)}%`.padEnd(10)} ${formatSigned(result.skillVsNaivePct, 1, '%')}`,
            `         naive persistence MAE ${formatMoney(result.naiveMae)}`
        );
    });
    lines.push(
        '',
        'MAE/RMSE measure price error; MAPE measures percentage error. Positive vs-naive skill beats an unchanged-price forecast.',
        'Past backtest accuracy may not persist through regime changes and is not a guarantee of future results.'
    );
    return lines;
}

export function formatBitcoinDashboard(analyses, options = {}) {
    const available = (Array.isArray(analyses) ? analyses : []).filter(Boolean);
    const unavailableIntervals = Array.isArray(options.unavailableIntervals) ? options.unavailableIntervals : [];
    if (!available.length) {
        return ['bitcoin: no valid repository market history is currently available'];
    }
    const ordered = BITCOIN_INTERVALS
        .map(interval => available.find(analysis => analysis.interval.id === interval.id))
        .filter(Boolean);
    const freshest = available.reduce((current, analysis) => (
        !current || analysis.latestTimestamp > current.latestTimestamp ? analysis : current
    ), null);
    const consensus = buildBitcoinConsensus(available);
    const updated = new Date(freshest.latestTimestamp * 1000).toLocaleString();
    const lines = [
        'BITCOIN MARKET ANALYTICS',
        '========================',
        `Latest repository snapshot: ${updated} | Price ${formatMoney(freshest.latestPrice)}`,
        `Bid ${formatMoney(freshest.latestBid)} | Ask ${formatMoney(freshest.latestAsk)} | Spread ${freshest.latestSpreadBps.toFixed(1)} bps (${freshest.spreadState})`,
        `Multi-timeframe bias: ${consensus.label.toUpperCase()} | confidence ${(consensus.confidence * 100).toFixed(0)}% | score ${formatSigned(consensus.score)}`,
        `Coverage: ${consensus.usableIntervals} analyzed, ${consensus.warmingIntervals} warming, ${unavailableIntervals.length} unavailable`,
        '',
        'INT  N    STATE    PRICE          CHANGE    VOL/BAR   RSI    TREND',
        '---  ---  --------  -------------  --------  --------  -----  ----------------------'
    ];
    ordered.forEach(analysis => {
        lines.push(
            `${analysis.interval.label.padEnd(4)} ${String(analysis.sampleCount).padEnd(4)} ${analysis.freshness.padEnd(8)} ${formatMoney(analysis.latestPrice).padEnd(14)} ${formatSigned(analysis.changePct, 2, '%').padEnd(9)} ${analysis.volatilityBps.toFixed(1).padEnd(9)} ${formatRsi(analysis.rsi).padEnd(6)} ${analysis.trend}`,
            `     ${analysis.sparkline}  age ${formatAge(analysis.ageSeconds)} | range ${analysis.rangePct.toFixed(2)}% | proj ${formatSigned(analysis.projectedReturnBps, 1, ' bps')} C${analysis.projectionConfidence.toFixed(2)}`
        );
    });
    unavailableIntervals.forEach(intervalId => {
        lines.push(`${String(intervalId).toUpperCase().padEnd(4)} unavailable`);
    });
    const forecastSource = available
        .filter(analysis => analysis.sampleCount >= FORECAST_MIN_SAMPLES)
        .sort((left, right) => right.sampleCount - left.sampleCount)[0];
    lines.push('', 'FORECAST SNAPSHOT');
    if (forecastSource) {
        const snapshotForecast = buildBitcoinForecast(forecastSource);
        snapshotForecast.projections.slice(0, 3).forEach(projection => {
            lines.push(
                `${forecastSource.interval.label} +${projection.horizonLabel}: ${formatMoney(projection.projectedPrice)} (${formatSigned(projection.expectedReturnPct, 2, '%')}) | estimated 80% range ${formatMoney(projection.lowerPrice)} - ${formatMoney(projection.upperPrice)} | ${projection.classification.replaceAll('_', ' ')}`
            );
        });
    } else {
        lines.push(`At least ${FORECAST_MIN_SAMPLES} valid samples are required for a forecast.`);
    }
    lines.push(
        '',
        `Data quality: liquidity is ${available.some(analysis => analysis.liquidityQuality === 'proxy') ? 'a price/spread proxy where order-book sizes are unavailable' : 'derived from order-book sizes'}.`,
        'Use: bitcoin <interval> for 1m, 2m, 5m, 10m, 15m, 30m, 1h, or 2h detail.',
        'Forecast tools: bitcoin forecast [interval] | bitcoin backtest [interval].',
        'This is informational analysis of repository history, not financial or trading advice.'
    );
    return lines;
}

export function formatBitcoinIntervalDetail(analysis) {
    if (!analysis) {
        return ['bitcoin: the requested interval has no valid history'];
    }
    return [
        `${analysis.interval.label} INTERVAL DETAIL`,
        '='.repeat(`${analysis.interval.label} INTERVAL DETAIL`.length),
        `Samples ${analysis.sampleCount} | ${analysis.freshness} | latest age ${formatAge(analysis.ageSeconds)}`,
        `Price ${formatMoney(analysis.latestPrice)} | Bid ${formatMoney(analysis.latestBid)} | Ask ${formatMoney(analysis.latestAsk)}`,
        `Window change ${formatSigned(analysis.changePct, 3, '%')} | Low ${formatMoney(analysis.lowPrice)} | High ${formatMoney(analysis.highPrice)} | Range ${analysis.rangePct.toFixed(3)}%`,
        `SMA ${SHORT_SMA_WINDOW}/${LONG_SMA_WINDOW}: ${formatMoney(analysis.smaShort)} / ${formatMoney(analysis.smaLong)}`,
        `EMA ${SHORT_EMA_SPAN}/${LONG_EMA_SPAN}: ${formatMoney(analysis.emaShort)} / ${formatMoney(analysis.emaLong)} | gap ${formatSigned(analysis.emaGapPct, 4, '%')}`,
        `RSI(${RSI_PERIOD}) ${formatRsi(analysis.rsi)} | z-score ${analysis.zScore === null ? '--' : formatSigned(analysis.zScore)} | volatility ${analysis.volatilityBps.toFixed(2)} bps/bar`,
        `MACD ${MACD_FAST_SPAN}/${MACD_SLOW_SPAN}/${MACD_SIGNAL_SPAN}: ${formatSigned(analysis.macd, 3)} | signal ${formatSigned(analysis.macdSignal, 3)} | histogram ${formatSigned(analysis.macdHistogram, 3)}`,
        `Condition ${analysis.marketCondition} | trend ${analysis.trend} (${formatSigned(analysis.trendScore)}) | momentum ${analysis.momentum} (${formatSigned(analysis.momentumPct, 3, '%')})`,
        `Pattern ${analysis.historicalPattern} | max drawdown ${analysis.maxDrawdownPct.toFixed(3)}%`,
        `Support ${formatMoney(analysis.supportPrice)} | resistance ${formatMoney(analysis.resistancePrice)}`,
        `One-bar projection ${formatSigned(analysis.projectedReturnBps, 2, ' bps')} | fit confidence ${(analysis.projectionConfidence * 100).toFixed(1)}%`,
        `Spread ${analysis.latestSpreadBps.toFixed(2)} bps | median ${analysis.medianSpreadBps.toFixed(2)} bps | ${analysis.spreadState}`,
        `Liquidity ${analysis.liquidityQuality}${analysis.liquidityRatio === null ? '' : ` | latest/baseline ${analysis.liquidityRatio.toFixed(2)}x`}`,
        `Data coverage ${analysis.dataQuality.coveragePct.toFixed(1)}% (${analysis.sampleCount}/${analysis.dataQuality.expectedSamples}) | missing ${analysis.dataQuality.missingIntervals} | irregular ${analysis.dataQuality.irregularIntervals} | return outliers ${analysis.dataQuality.outlierReturns}`,
        `Price path ${analysis.sparkline}`,
        '',
        `Explore: bitcoin forecast ${analysis.interval.id} | bitcoin backtest ${analysis.interval.id}`,
        'This is informational analysis of repository history, not financial or trading advice.'
    ];
}
