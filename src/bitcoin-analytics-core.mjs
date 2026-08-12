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

export function analyzeBitcoinHistory(history, interval, nowMs = Date.now()) {
    if (!Array.isArray(history) || history.length === 0) {
        return null;
    }
    const snapshots = history.slice().sort((left, right) => left.timestamp - right.timestamp);
    const prices = snapshots.map(snapshot => snapshot.price);
    const latest = snapshots.at(-1);
    const earliest = snapshots[0];
    const emaShort = computeEma(prices, SHORT_EMA_SPAN);
    const emaLong = computeEma(prices, LONG_EMA_SPAN);
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
        emaShort,
        emaLong,
        emaGapPct: emaGap * 100,
        slopePctPerBar: slope * 100,
        trend,
        trendScore,
        momentum: classifyMomentum(prices, emaShort, emaLong, rsi),
        rsi,
        zScore,
        volatilityBps,
        projectedReturnBps: projection.projectedReturnBps,
        projectionConfidence: projection.projectionConfidence,
        freshness: classifyFreshness(ageSeconds, interval.seconds),
        ageSeconds,
        liquidityQuality: proxyRatio >= 0.5 ? 'proxy' : 'order_book',
        liquidityRatio,
        sparkline: buildSparkline(prices),
        snapshots
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
    lines.push(
        '',
        `Data quality: liquidity is ${available.some(analysis => analysis.liquidityQuality === 'proxy') ? 'a price/spread proxy where order-book sizes are unavailable' : 'derived from order-book sizes'}.`,
        'Use: bitcoin <interval> for 1m, 2m, 5m, 10m, 15m, 30m, 1h, or 2h detail.',
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
        `EMA ${SHORT_EMA_SPAN}/${LONG_EMA_SPAN}: ${formatMoney(analysis.emaShort)} / ${formatMoney(analysis.emaLong)} | gap ${formatSigned(analysis.emaGapPct, 4, '%')}`,
        `RSI(${RSI_PERIOD}) ${formatRsi(analysis.rsi)} | z-score ${analysis.zScore === null ? '--' : formatSigned(analysis.zScore)} | volatility ${analysis.volatilityBps.toFixed(2)} bps/bar`,
        `Trend ${analysis.trend} (${formatSigned(analysis.trendScore)}) | momentum ${analysis.momentum}`,
        `One-bar projection ${formatSigned(analysis.projectedReturnBps, 2, ' bps')} | fit confidence ${(analysis.projectionConfidence * 100).toFixed(1)}%`,
        `Spread ${analysis.latestSpreadBps.toFixed(2)} bps | median ${analysis.medianSpreadBps.toFixed(2)} bps | ${analysis.spreadState}`,
        `Liquidity ${analysis.liquidityQuality}${analysis.liquidityRatio === null ? '' : ` | latest/baseline ${analysis.liquidityRatio.toFixed(2)}x`}`,
        `Price path ${analysis.sparkline}`,
        '',
        'This is informational analysis of repository history, not financial or trading advice.'
    ];
}
