import { normalizeBitcoinTimestamp } from './bitcoin-analytics-core.mjs';

const DASHBOARD_FONT_FAMILY = '"Courier New", Courier, monospace';

export const BITCOIN_DASHBOARD_COLORS = Object.freeze({
    mid: '#2f81f7',
    bid: '#2ea043',
    ask: '#f85149',
    reference: '#a371f7',
    buyTrigger: '#3fb950',
    sellTrigger: '#ff7b72',
    projection: '#d29922',
    forecastRange: 'rgba(210, 153, 34, 0.18)',
    latest: '#ff9800',
    buySignal: '#39d353',
    sellSignal: '#ff4d4f'
});

const DASHBOARD_LEGEND = Object.freeze([
    Object.freeze({ key: 'mid', label: 'Mid/Last' }),
    Object.freeze({ key: 'bid', label: 'Bid' }),
    Object.freeze({ key: 'ask', label: 'Ask' }),
    Object.freeze({ key: 'reference', label: 'Reference' }),
    Object.freeze({ key: 'buyTrigger', label: 'Buy Trigger' }),
    Object.freeze({ key: 'sellTrigger', label: 'Sell Trigger' }),
    Object.freeze({ key: 'projection', label: 'Projection' }),
    Object.freeze({ key: 'latest', label: 'Latest' }),
    Object.freeze({ key: 'buySignal', label: 'Buy Signal' }),
    Object.freeze({ key: 'sellSignal', label: 'Sell Signal' })
]);

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

function formatMoney(value) {
    return `$${finiteNumber(value).toLocaleString('en-US', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2
    })}`;
}

function formatCompactMoney(value) {
    const number = finiteNumber(value);
    if (Math.abs(number) >= 1000) {
        return `$${(number / 1000).toFixed(Math.abs(number) >= 100_000 ? 0 : 1)}k`;
    }
    return formatMoney(number);
}

function formatSigned(value, digits = 2, suffix = '') {
    const number = finiteNumber(value);
    return `${number > 0 ? '+' : ''}${number.toFixed(digits)}${suffix}`;
}

function resolveDashboardTimeZone(timeZone) {
    if (typeof timeZone === 'string' && timeZone.trim()) {
        return timeZone.trim();
    }
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
    } catch {
        return 'local';
    }
}

function formatDateTime(timestamp, formatOptions, timeZone) {
    const normalized = normalizeBitcoinTimestamp(timestamp);
    if (!Number.isFinite(normalized) || normalized <= 0) {
        return '--';
    }
    const options = { ...formatOptions };
    if (timeZone && timeZone !== 'local') {
        options.timeZone = timeZone;
    }
    try {
        return new Intl.DateTimeFormat('en-US', options).format(new Date(normalized * 1000));
    } catch {
        delete options.timeZone;
        return new Intl.DateTimeFormat('en-US', options).format(new Date(normalized * 1000));
    }
}

export function formatBitcoinAxisTimestamp(timestamp, options = {}) {
    const rangeSeconds = Math.max(0, finiteNumber(options.rangeSeconds));
    const timeZone = resolveDashboardTimeZone(options.timeZone);
    if (rangeSeconds <= 86_400 && !options.includeDate) {
        return formatDateTime(timestamp, {
            hour: 'numeric',
            hour12: true,
            minute: '2-digit'
        }, timeZone);
    }
    if (rangeSeconds <= 31 * 86_400) {
        return formatDateTime(timestamp, {
            day: 'numeric',
            hour: 'numeric',
            hour12: true,
            minute: '2-digit',
            month: 'short'
        }, timeZone);
    }
    if (rangeSeconds <= 370 * 86_400) {
        return formatDateTime(timestamp, {
            day: 'numeric',
            month: 'short'
        }, timeZone);
    }
    return formatDateTime(timestamp, {
        month: 'short',
        year: 'numeric'
    }, timeZone);
}

export function formatBitcoinTooltipTimestamp(timestamp, options = {}) {
    return formatDateTime(timestamp, {
        day: 'numeric',
        hour: 'numeric',
        hour12: true,
        minute: '2-digit',
        month: 'short',
        second: '2-digit',
        timeZoneName: 'short',
        year: 'numeric'
    }, resolveDashboardTimeZone(options.timeZone));
}

export function createBitcoinTimeScale(points, left, right) {
    const validTimestamps = (Array.isArray(points) ? points : [])
        .map(point => normalizeBitcoinTimestamp(point?.timestamp))
        .filter(Number.isFinite);
    const minimumTimestamp = validTimestamps[0] ?? NaN;
    const maximumTimestamp = validTimestamps.at(-1) ?? NaN;
    const safeLeft = finiteNumber(left);
    const safeRight = finiteNumber(right, safeLeft);
    const midpointX = safeLeft + ((safeRight - safeLeft) / 2);
    const timestampSpan = maximumTimestamp - minimumTimestamp;

    return {
        maximumTimestamp,
        minimumTimestamp,
        timestampSpan,
        timestampToX(timestamp) {
            const normalized = normalizeBitcoinTimestamp(timestamp);
            if (!Number.isFinite(normalized) || !Number.isFinite(minimumTimestamp)) {
                return NaN;
            }
            if (!(timestampSpan > 0)) {
                return midpointX;
            }
            return safeLeft + ((normalized - minimumTimestamp) / timestampSpan) * (safeRight - safeLeft);
        },
        xToTimestamp(x) {
            if (!Number.isFinite(minimumTimestamp)) {
                return NaN;
            }
            if (!(timestampSpan > 0) || safeRight === safeLeft) {
                return minimumTimestamp;
            }
            const ratio = clamp((finiteNumber(x, safeLeft) - safeLeft) / (safeRight - safeLeft), 0, 1);
            return minimumTimestamp + (ratio * timestampSpan);
        }
    };
}

export function findNearestBitcoinPoint(points, targetTimestamp) {
    const source = Array.isArray(points) ? points : [];
    const target = normalizeBitcoinTimestamp(targetTimestamp);
    if (!source.length || !Number.isFinite(target)) {
        return null;
    }
    if (source.length === 1) {
        return source[0];
    }

    let lower = 0;
    let upper = source.length - 1;
    while (lower <= upper) {
        const middle = lower + Math.floor((upper - lower) / 2);
        const middleTimestamp = normalizeBitcoinTimestamp(source[middle]?.timestamp);
        if (middleTimestamp === target) {
            return source[middle];
        }
        if (middleTimestamp < target) {
            lower = middle + 1;
        } else {
            upper = middle - 1;
        }
    }

    if (lower >= source.length) {
        return source.at(-1);
    }
    if (upper < 0) {
        return source[0];
    }
    const before = source[upper];
    const after = source[lower];
    return target - normalizeBitcoinTimestamp(before.timestamp)
        <= normalizeBitcoinTimestamp(after.timestamp) - target
        ? before
        : after;
}

function formatTimestamp(timestamp, includeSeconds = false, timeZone) {
    return formatDateTime(timestamp, {
        hour: '2-digit',
        hour12: true,
        minute: '2-digit',
        second: includeSeconds ? '2-digit' : undefined
    }, resolveDashboardTimeZone(timeZone));
}

function classifyVolatility(volatilityBps) {
    const value = Math.max(0, finiteNumber(volatilityBps));
    if (value < 5) {
        return 'quiet';
    }
    if (value < 20) {
        return 'balanced';
    }
    if (value < 60) {
        return 'elevated';
    }
    return 'extreme';
}

function classifyProjectionDirection(expectedReturnPct) {
    const value = finiteNumber(expectedReturnPct);
    if (value > 0.005) {
        return 'projection_up';
    }
    if (value < -0.005) {
        return 'projection_down';
    }
    return 'projection_flat';
}

function calculateDashboardSignal(analysis, projectedReturnPct) {
    const latestPrice = Math.max(finiteNumber(analysis?.latestPrice), 1);
    const volatilityPct = Math.max(finiteNumber(analysis?.volatilityBps) / 100, 0.005);
    const forecastComponent = clamp(finiteNumber(projectedReturnPct) / volatilityPct, -1, 1);
    const macdComponent = clamp((finiteNumber(analysis?.macdHistogram) / latestPrice) * 10_000, -1, 1);
    const momentumComponent = clamp(finiteNumber(analysis?.momentumPct) / 0.5, -1, 1);
    const rawSignal = clamp(
        (finiteNumber(analysis?.trendScore) * 0.55)
        + (forecastComponent * 0.25)
        + (macdComponent * 0.1)
        + (momentumComponent * 0.1),
        -1,
        1
    );
    const condition = String(analysis?.marketCondition || analysis?.trend || 'neutral');
    const status = rawSignal >= 0.1 && condition === 'bullish'
        ? 'BUY'
        : rawSignal <= -0.1 && condition === 'bearish'
            ? 'SELL'
            : 'HOLD';
    return {
        buySignal: status === 'BUY',
        rawSignal,
        score: clamp((finiteNumber(analysis?.trendScore) * 0.7) + (rawSignal * 0.3), -1, 1),
        sellSignal: status === 'SELL',
        status
    };
}

function buildUnavailablePanel(intervalId, reason = 'repository market data unavailable') {
    return {
        available: false,
        buySignal: false,
        forecast: [],
        history: [],
        intervalId,
        intervalLabel: String(intervalId || '--').toUpperCase(),
        reason,
        sellSignal: false,
        status: 'UNAVAILABLE'
    };
}

function buildAvailablePanel(entry) {
    const analysis = entry.analysis;
    const snapshots = Array.isArray(analysis.snapshots) ? analysis.snapshots : [];
    const history = snapshots.map(snapshot => ({
        ask: finiteNumber(snapshot.ask, snapshot.price),
        bid: finiteNumber(snapshot.bid, snapshot.price),
        mid: finiteNumber(snapshot.price),
        timestamp: finiteNumber(snapshot.timestamp)
    })).filter(point => point.timestamp > 0 && point.mid > 0);
    if (!history.length) {
        return buildUnavailablePanel(analysis?.interval?.id || '--', 'history contains no chartable prices');
    }
    const forecastSource = Array.isArray(entry.forecast?.projections) ? entry.forecast.projections : [];
    const maximumVisualBars = Math.max(3, history.length - 1);
    let selectedForecast = forecastSource
        .filter(point => finiteNumber(point.horizonBars) <= maximumVisualBars)
        .slice(0, 5);
    if (selectedForecast.length < Math.min(3, forecastSource.length)) {
        selectedForecast = forecastSource.slice(0, Math.min(3, forecastSource.length));
    }
    const forecast = selectedForecast.map(point => ({
        classification: point.classification,
        expectedReturnPct: finiteNumber(point.expectedReturnPct),
        horizonBars: finiteNumber(point.horizonBars, 1),
        horizonLabel: String(point.horizonLabel || ''),
        lowerPrice: finiteNumber(point.lowerPrice),
        projectedPrice: finiteNumber(point.projectedPrice),
        timestamp: analysis.latestTimestamp + (finiteNumber(point.horizonBars, 1) * analysis.interval.seconds),
        upperPrice: finiteNumber(point.upperPrice)
    })).filter(point => point.projectedPrice > 0 && point.lowerPrice > 0 && point.upperPrice > 0);
    const nearestProjection = forecast[0] || null;
    const projectedReturnPct = nearestProjection?.expectedReturnPct || 0;
    const signal = calculateDashboardSignal(analysis, projectedReturnPct);
    const latestPrice = finiteNumber(analysis.latestPrice);
    const referencePrice = average(history.map(point => point.mid));
    const inspectionPoints = [
        ...history.map(point => ({
            ...point,
            kind: 'historical'
        })),
        ...forecast.map(point => ({
            ...point,
            kind: 'prediction'
        }))
    ].sort((left, right) => left.timestamp - right.timestamp);
    const bufferRatio = Math.max(
        finiteNumber(analysis.volatilityBps) / 10_000 * 2,
        finiteNumber(analysis.rangePct) / 100 * 0.1,
        0.0005
    );
    const triggerBuffer = latestPrice * bufferRatio;
    const buyTriggerPrice = Math.min(
        latestPrice - triggerBuffer,
        finiteNumber(analysis.supportPrice, latestPrice - triggerBuffer)
    );
    const sellTriggerPrice = Math.max(
        latestPrice + triggerBuffer,
        finiteNumber(analysis.resistancePrice, latestPrice + triggerBuffer)
    );
    const performance = entry.backtest?.available ? {
        directionalAccuracyPct: finiteNumber(entry.backtest.directionalAccuracyPct),
        mae: finiteNumber(entry.backtest.mae),
        mapePct: finiteNumber(entry.backtest.mapePct),
        rangeCoveragePct: finiteNumber(entry.backtest.rangeCoveragePct),
        rmse: finiteNumber(entry.backtest.rmse),
        skillVsNaivePct: finiteNumber(entry.backtest.skillVsNaivePct),
        testCount: finiteNumber(entry.backtest.testCount)
    } : null;
    const evidenceQualified = Boolean(
        performance
        && performance.testCount >= 8
        && performance.directionalAccuracyPct >= 50
        && performance.skillVsNaivePct > 0
    );
    const qualifiedStatus = signal.status === 'HOLD' || evidenceQualified ? signal.status : 'HOLD';

    return {
        available: true,
        askPrice: finiteNumber(analysis.latestAsk, latestPrice),
        bidPrice: finiteNumber(analysis.latestBid, latestPrice),
        buySignal: qualifiedStatus === 'BUY',
        buyTriggerPrice,
        changePct: finiteNumber(analysis.changePct),
        dataCoveragePct: finiteNumber(analysis.dataQuality?.coveragePct),
        forecast,
        forecastConfidence: finiteNumber(entry.forecast?.modelFit),
        historicalPattern: String(analysis.historicalPattern || 'unknown'),
        history,
        inspectionPoints,
        intervalId: String(analysis.interval.id),
        intervalLabel: String(analysis.interval.label),
        intervalSeconds: finiteNumber(analysis.interval.seconds, 60),
        latestPrice,
        macdHistogram: finiteNumber(analysis.macdHistogram),
        marketCondition: String(analysis.marketCondition || analysis.trend || 'neutral'),
        momentum: String(analysis.momentum || 'warming_up'),
        momentumPct: finiteNumber(analysis.momentumPct),
        performance,
        projectionDirection: classifyProjectionDirection(projectedReturnPct),
        projectedReturnPct,
        rawSignal: signal.rawSignal,
        referencePrice,
        rsi: analysis.rsi === null ? null : finiteNumber(analysis.rsi),
        sampleCount: finiteNumber(analysis.sampleCount),
        score: signal.score,
        sellSignal: qualifiedStatus === 'SELL',
        sellTriggerPrice,
        spreadBps: finiteNumber(analysis.latestSpreadBps),
        spreadShockBps: finiteNumber(analysis.latestSpreadBps) - finiteNumber(analysis.medianSpreadBps),
        status: qualifiedStatus,
        updatedTimestamp: finiteNumber(analysis.latestTimestamp),
        volatilityBps: finiteNumber(analysis.volatilityBps),
        volatilityClass: classifyVolatility(analysis.volatilityBps)
    };
}

export function buildBitcoinDashboardViewModel(entries, options = {}) {
    const sourceEntries = Array.isArray(entries) ? entries : [];
    const panels = sourceEntries.map(entry => {
        try {
            return entry?.analysis
                ? buildAvailablePanel(entry)
                : buildUnavailablePanel(entry?.intervalId || '--', entry?.reason);
        } catch (error) {
            return buildUnavailablePanel(entry?.analysis?.interval?.id || entry?.intervalId || '--', error?.message || 'dashboard model failed');
        }
    });
    const representedIntervals = new Set(panels.map(panel => panel.intervalId));
    (Array.isArray(options.unavailableIntervals) ? options.unavailableIntervals : []).forEach(intervalId => {
        if (!representedIntervals.has(intervalId)) {
            panels.push(buildUnavailablePanel(intervalId));
            representedIntervals.add(intervalId);
        }
    });
    return {
        generatedAt: finiteNumber(options.generatedAt, Date.now()),
        legend: DASHBOARD_LEGEND,
        panels,
        sourceLabel: 'Repository Bitcoin history',
        timeZone: resolveDashboardTimeZone(options.timeZone),
        timestampPolicy: 'Source observation time; displayed in the viewer local time zone',
        title: 'BITCOIN ANALYTICS DASHBOARD'
    };
}

export function createBitcoinDashboardLayout(width, panelCount) {
    const safeWidth = Math.max(260, finiteNumber(width, 260));
    const count = Math.max(0, Math.floor(finiteNumber(panelCount)));
    const columns = safeWidth >= 860 && count > 1 ? 2 : 1;
    const gap = safeWidth < 520 ? 10 : 12;
    const headerHeight = safeWidth < 560 ? 142 : 88;
    const panelHeight = columns === 2 ? 304 : safeWidth < 560 ? 360 : 324;
    const panelWidth = columns === 1 ? safeWidth : (safeWidth - gap) / 2;
    const panelRects = Array.from({ length: count }, (_, index) => ({
        height: panelHeight,
        width: panelWidth,
        x: (index % columns) * (panelWidth + gap),
        y: headerHeight + Math.floor(index / columns) * (panelHeight + gap)
    }));
    const rows = count ? Math.ceil(count / columns) : 1;
    const footerHeight = 38;
    return {
        columns,
        footerHeight,
        gap,
        headerHeight,
        height: headerHeight + (count ? rows * panelHeight + Math.max(0, rows - 1) * gap : 96) + footerHeight,
        panelHeight,
        panelRects,
        width: safeWidth
    };
}

export function createBitcoinDashboardPanelGeometry(panel, rect, options = {}) {
    const originX = finiteNumber(options.originX);
    const originY = finiteNumber(options.originY);
    const x = originX + finiteNumber(rect?.x);
    const y = originY + finiteNumber(rect?.y);
    const width = Math.max(1, finiteNumber(rect?.width, 1));
    const height = Math.max(1, finiteNumber(rect?.height, 1));
    const compact = width < 520;
    const padding = compact ? 10 : 12;
    const smallFont = compact ? 10 : 11;
    const titleFont = compact ? 12 : 13;
    const lineHeight = smallFont + 5;
    const summaryBottom = y + padding + titleFont + 7 + (6 * lineHeight);
    const performanceHeight = compact ? 34 : 30;
    const chartTop = summaryBottom + 6;
    const chartBottom = y + height - performanceHeight - 34;
    const chartLeft = x + (compact ? 58 : 66);
    const chartRight = x + width - 12;
    const chartWidth = Math.max(40, chartRight - chartLeft);
    const chartHeight = Math.max(54, chartBottom - chartTop);
    const chartValues = [
        ...(Array.isArray(panel?.history) ? panel.history : []).flatMap(point => [point.bid, point.mid, point.ask]),
        panel?.referencePrice,
        panel?.buyTriggerPrice,
        panel?.sellTriggerPrice,
        ...(Array.isArray(panel?.forecast) ? panel.forecast : []).flatMap(point => [
            point.lowerPrice,
            point.projectedPrice,
            point.upperPrice
        ])
    ].filter(Number.isFinite);
    let minimumPrice = chartValues.length ? Math.min(...chartValues) : 0;
    let maximumPrice = chartValues.length ? Math.max(...chartValues) : 1;
    const latestPrice = Math.max(1, finiteNumber(panel?.latestPrice, 1));
    const pricePadding = Math.max((maximumPrice - minimumPrice) * 0.08, latestPrice * 0.0001, 1);
    minimumPrice -= pricePadding;
    maximumPrice += pricePadding;
    const inspectionPoints = Array.isArray(panel?.inspectionPoints)
        ? panel.inspectionPoints
        : [];
    const timeScale = createBitcoinTimeScale(inspectionPoints, chartLeft, chartRight);
    const priceToY = price => chartTop
        + (1 - ((finiteNumber(price) - minimumPrice) / Math.max(1, maximumPrice - minimumPrice))) * chartHeight;

    return {
        axisTickY: chartBottom + 11,
        axisTitleY: y + height - performanceHeight - 2,
        chartBottom,
        chartHeight,
        chartLeft,
        chartRight,
        chartTop,
        chartWidth,
        compact,
        height,
        lineHeight,
        maximumPrice,
        minimumPrice,
        padding,
        performanceHeight,
        priceToY,
        smallFont,
        summaryBottom,
        timeScale,
        timestampToX: timeScale.timestampToX,
        titleFont,
        width,
        x,
        y
    };
}

export function createBitcoinDateTimeTicks(points, maximumTicks = 3) {
    const source = Array.isArray(points) ? points : [];
    const count = Math.max(1, Math.floor(finiteNumber(maximumTicks, 3)));
    if (!source.length) {
        return [];
    }
    if (source.length <= count || count === 1) {
        return count === 1
            ? [source[Math.floor((source.length - 1) / 2)].timestamp]
            : source.map(point => point.timestamp);
    }
    const firstTimestamp = normalizeBitcoinTimestamp(source[0].timestamp);
    const lastTimestamp = normalizeBitcoinTimestamp(source.at(-1).timestamp);
    const ticks = [];
    for (let index = 0; index < count; index += 1) {
        const target = firstTimestamp + ((lastTimestamp - firstTimestamp) * index / (count - 1));
        const point = findNearestBitcoinPoint(source, target);
        if (point && !ticks.includes(point.timestamp)) {
            ticks.push(point.timestamp);
        }
    }
    return ticks;
}

export function inspectBitcoinDashboardPoint(dashboard, layout, x, y, options = {}) {
    if (!dashboard || !layout || !Array.isArray(layout.panelRects)) {
        return null;
    }
    for (let panelIndex = 0; panelIndex < layout.panelRects.length; panelIndex += 1) {
        const panel = dashboard.panels?.[panelIndex];
        if (!panel?.available) {
            continue;
        }
        const geometry = options.panelGeometries?.[panelIndex]
            || createBitcoinDashboardPanelGeometry(panel, layout.panelRects[panelIndex], options);
        if (
            x < geometry.chartLeft
            || x > geometry.chartRight
            || y < geometry.chartTop
            || y > geometry.chartBottom
        ) {
            continue;
        }
        const targetTimestamp = geometry.timeScale.xToTimestamp(x);
        const point = findNearestBitcoinPoint(panel.inspectionPoints, targetTimestamp);
        if (!point) {
            return null;
        }
        return {
            ...point,
            intervalId: panel.intervalId,
            intervalLabel: panel.intervalLabel,
            panelIndex,
            referencePrice: panel.referencePrice,
            selectedPrice: point.kind === 'prediction' ? point.projectedPrice : point.mid
        };
    }
    return null;
}

export function formatBitcoinDashboardTooltip(inspection, options = {}) {
    if (!inspection || !Number.isFinite(normalizeBitcoinTimestamp(inspection.timestamp))) {
        return '';
    }
    const timestamp = formatBitcoinTooltipTimestamp(inspection.timestamp, options);
    if (inspection.kind === 'prediction') {
        return [
            timestamp,
            `Prediction ${formatMoney(inspection.projectedPrice)}`,
            `80% range ${formatMoney(inspection.lowerPrice)}–${formatMoney(inspection.upperPrice)}`
        ].join(' | ');
    }
    return [
        timestamp,
        `BTC ${formatMoney(inspection.mid)}`,
        `Bid ${formatMoney(inspection.bid)}`,
        `Ask ${formatMoney(inspection.ask)}`,
        `Ref ${formatMoney(inspection.referencePrice)}`
    ].join(' | ');
}

function drawClippedText(ctx, text, x, y, maxWidth) {
    let output = String(text || '');
    if (ctx.measureText(output).width <= maxWidth) {
        ctx.fillText(output, x, y);
        return;
    }
    while (output.length > 1 && ctx.measureText(`${output}…`).width > maxWidth) {
        output = output.slice(0, -1);
    }
    ctx.fillText(`${output}…`, x, y);
}

function drawLegend(ctx, legend, x, y, width, fontSize) {
    ctx.font = `${fontSize}px ${DASHBOARD_FONT_FAMILY}`;
    ctx.textBaseline = 'middle';
    let cursorX = x;
    let cursorY = y;
    const rowHeight = fontSize + 9;
    legend.forEach(item => {
        const labelWidth = ctx.measureText(item.label).width;
        const itemWidth = 18 + labelWidth + 14;
        if (cursorX > x && cursorX + itemWidth > x + width) {
            cursorX = x;
            cursorY += rowHeight;
        }
        const color = BITCOIN_DASHBOARD_COLORS[item.key];
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cursorX, cursorY);
        ctx.lineTo(cursorX + 12, cursorY);
        ctx.stroke();
        if (item.key === 'latest' || item.key.endsWith('Signal')) {
            ctx.beginPath();
            ctx.arc(cursorX + 6, cursorY, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillText(item.label, cursorX + 17, cursorY);
        cursorX += itemWidth;
    });
}

function drawHorizontalLevel(ctx, priceToY, value, left, right, color, dash = []) {
    if (!Number.isFinite(value)) {
        return;
    }
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash(dash);
    const y = priceToY(value);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.restore();
}

function drawSeries(ctx, points, valueKey, timestampToX, priceToY, color, width = 1.5, dash = []) {
    const valid = points.filter(point => Number.isFinite(point.timestamp) && Number.isFinite(point[valueKey]));
    if (valid.length < 2) {
        return;
    }
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash(dash);
    ctx.beginPath();
    valid.forEach((point, index) => {
        const x = timestampToX(point.timestamp);
        const y = priceToY(point[valueKey]);
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    ctx.stroke();
    ctx.restore();
}

function drawSignalMarker(ctx, x, y, color, direction) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    if (direction === 'up') {
        ctx.moveTo(x, y - 7);
        ctx.lineTo(x - 6, y + 5);
        ctx.lineTo(x + 6, y + 5);
    } else {
        ctx.moveTo(x, y + 7);
        ctx.lineTo(x - 6, y - 5);
        ctx.lineTo(x + 6, y - 5);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function drawBitcoinInspection(ctx, inspection, geometry, timeZone) {
    if (!inspection || !Number.isFinite(inspection.timestamp) || !Number.isFinite(inspection.selectedPrice)) {
        return;
    }
    const markerX = geometry.timestampToX(inspection.timestamp);
    const markerY = geometry.priceToY(inspection.selectedPrice);
    const markerColor = inspection.kind === 'prediction'
        ? BITCOIN_DASHBOARD_COLORS.projection
        : '#f0f6fc';
    const valueLines = inspection.kind === 'prediction'
        ? [
            `Prediction ${formatMoney(inspection.projectedPrice)}`,
            `80% ${formatMoney(inspection.lowerPrice)}–${formatMoney(inspection.upperPrice)}`
        ]
        : [
            `BTC ${formatMoney(inspection.mid)} | Bid ${formatMoney(inspection.bid)} | Ask ${formatMoney(inspection.ask)}`,
            `Reference ${formatMoney(inspection.referencePrice)} | historical observation`
        ];
    const tooltipLines = [
        `${inspection.locked ? 'LOCKED • ' : ''}${formatBitcoinTooltipTimestamp(inspection.timestamp, { timeZone })}`,
        ...valueLines
    ];

    ctx.save();
    ctx.strokeStyle = 'rgba(240, 246, 252, 0.72)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(markerX, geometry.chartTop);
    ctx.lineTo(markerX, geometry.chartBottom);
    ctx.moveTo(geometry.chartLeft, markerY);
    ctx.lineTo(geometry.chartRight, markerY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = markerColor;
    ctx.strokeStyle = '#02060c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(markerX, markerY, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const fontSize = geometry.compact ? 9 : 10;
    const lineHeight = fontSize + 4;
    ctx.font = `${fontSize}px ${DASHBOARD_FONT_FAMILY}`;
    const tooltipWidth = Math.min(
        geometry.chartWidth - 8,
        Math.max(190, ...tooltipLines.map(line => ctx.measureText(line).width + 16))
    );
    const tooltipHeight = tooltipLines.length * lineHeight + 12;
    const tooltipX = clamp(
        markerX + 9,
        geometry.chartLeft + 4,
        Math.max(geometry.chartLeft + 4, geometry.chartRight - tooltipWidth - 4)
    );
    const preferredY = markerY - tooltipHeight - 9;
    const tooltipY = clamp(
        preferredY >= geometry.chartTop + 4 ? preferredY : markerY + 9,
        geometry.chartTop + 4,
        Math.max(geometry.chartTop + 4, geometry.chartBottom - tooltipHeight - 4)
    );
    ctx.fillStyle = 'rgba(2, 6, 12, 0.94)';
    ctx.strokeStyle = inspection.locked ? BITCOIN_DASHBOARD_COLORS.latest : 'rgba(240, 246, 252, 0.62)';
    ctx.lineWidth = 1;
    ctx.fillRect(tooltipX, tooltipY, tooltipWidth, tooltipHeight);
    ctx.strokeRect(tooltipX + 0.5, tooltipY + 0.5, tooltipWidth - 1, tooltipHeight - 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    tooltipLines.forEach((line, index) => {
        ctx.fillStyle = index === 0 ? '#f0f6fc' : '#c9d1d9';
        drawClippedText(ctx, line, tooltipX + 8, tooltipY + 6 + index * lineHeight, tooltipWidth - 16);
    });
    ctx.restore();
}

function getPanelBorderColor(panel) {
    if (panel.status === 'BUY') {
        return BITCOIN_DASHBOARD_COLORS.buySignal;
    }
    if (panel.status === 'SELL') {
        return BITCOIN_DASHBOARD_COLORS.sellSignal;
    }
    if (!panel.available) {
        return '#6e7681';
    }
    return '#8b949e';
}

function drawUnavailablePanel(ctx, panel, rect, originX, originY) {
    const x = originX + rect.x;
    const y = originY + rect.y;
    ctx.fillStyle = 'rgba(7, 12, 20, 0.94)';
    ctx.fillRect(x, y, rect.width, rect.height);
    ctx.strokeStyle = '#6e7681';
    ctx.strokeRect(x + 0.5, y + 0.5, rect.width - 1, rect.height - 1);
    ctx.font = `700 15px ${DASHBOARD_FONT_FAMILY}`;
    ctx.fillStyle = '#c9d1d9';
    ctx.textBaseline = 'top';
    ctx.fillText(`${panel.intervalLabel} | UNAVAILABLE`, x + 14, y + 14);
    ctx.font = `12px ${DASHBOARD_FONT_FAMILY}`;
    ctx.fillStyle = '#8b949e';
    drawClippedText(ctx, panel.reason || 'repository market data unavailable', x + 14, y + 42, rect.width - 28);
    ctx.strokeStyle = 'rgba(110, 118, 129, 0.32)';
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x + 18.5, y + 80.5, rect.width - 37, rect.height - 104);
    ctx.setLineDash([]);
}

function drawAvailablePanel(ctx, panel, rect, originX, originY, options = {}) {
    const geometry = createBitcoinDashboardPanelGeometry(panel, rect, { originX, originY });
    const {
        chartBottom,
        chartHeight,
        chartLeft,
        chartRight,
        chartTop,
        chartWidth,
        compact,
        lineHeight,
        maximumPrice,
        minimumPrice,
        padding,
        performanceHeight,
        priceToY,
        smallFont,
        summaryBottom,
        timestampToX,
        titleFont,
        width,
        x,
        y
    } = geometry;
    const timeZone = resolveDashboardTimeZone(options.timeZone);
    const background = ctx.createLinearGradient(x, y, x, y + rect.height);
    background.addColorStop(0, 'rgba(17, 24, 39, 0.97)');
    background.addColorStop(1, 'rgba(4, 9, 16, 0.97)');
    ctx.fillStyle = background;
    ctx.fillRect(x, y, rect.width, rect.height);
    ctx.strokeStyle = getPanelBorderColor(panel);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, rect.width - 1, rect.height - 1);

    const textX = x + padding;
    const textWidth = width - padding * 2;
    const statusColor = panel.status === 'BUY'
        ? BITCOIN_DASHBOARD_COLORS.buySignal
        : panel.status === 'SELL'
            ? BITCOIN_DASHBOARD_COLORS.sellSignal
            : '#d29922';
    ctx.textBaseline = 'top';
    ctx.font = `700 ${titleFont}px ${DASHBOARD_FONT_FAMILY}`;
    ctx.fillStyle = '#f0f6fc';
    drawClippedText(
        ctx,
        `${panel.intervalLabel} | ${panel.status} | Score ${formatSigned(panel.score)} | Raw ${formatSigned(panel.rawSignal)}`,
        textX,
        y + padding,
        textWidth
    );
    const summaryLines = [
        `Mid ${formatMoney(panel.latestPrice)} | Bid ${formatMoney(panel.bidPrice)} | Ask ${formatMoney(panel.askPrice)} | Ref ${formatMoney(panel.referencePrice)}`,
        `Spread ${panel.spreadBps.toFixed(1)} bps | Shock ${formatSigned(panel.spreadShockBps, 1, ' bps')} | B/S ${formatMoney(panel.buyTriggerPrice)} / ${formatMoney(panel.sellTriggerPrice)}`,
        `Return ${formatSigned(panel.changePct, 2, '%')} | Proj ${formatSigned(panel.projectedReturnPct, 3, '%')} C${panel.forecastConfidence.toFixed(2)} | Updated ${formatTimestamp(panel.updatedTimestamp, true, timeZone)}`,
        `Momentum ${panel.momentum} | Vol ${panel.volatilityClass} ${panel.volatilityBps.toFixed(1)} bps | ${panel.projectionDirection} | N ${panel.sampleCount}`,
        `Condition ${panel.marketCondition} | Pattern ${panel.historicalPattern} | Coverage ${panel.dataCoveragePct.toFixed(1)}%`,
        `Buy Signal ${panel.buySignal ? 'ACTIVE' : 'WAIT'} | Sell Signal ${panel.sellSignal ? 'ACTIVE' : 'WAIT'} | RSI ${panel.rsi === null ? '--' : panel.rsi.toFixed(1)} | MACD-H ${formatSigned(panel.macdHistogram, 2)}`
    ];
    ctx.font = `${smallFont}px ${DASHBOARD_FONT_FAMILY}`;
    summaryLines.forEach((line, index) => {
        ctx.fillStyle = index === summaryLines.length - 1 ? statusColor : '#c9d1d9';
        drawClippedText(ctx, line, textX, y + padding + titleFont + 7 + index * lineHeight, textWidth);
    });

    const latestTimestamp = panel.updatedTimestamp;

    ctx.save();
    ctx.strokeStyle = 'rgba(139, 148, 158, 0.18)';
    ctx.fillStyle = '#8b949e';
    ctx.lineWidth = 1;
    ctx.font = `${compact ? 9 : 10}px ${DASHBOARD_FONT_FAMILY}`;
    ctx.textBaseline = 'middle';
    for (let tick = 0; tick <= 3; tick += 1) {
        const ratio = tick / 3;
        const tickY = chartTop + ratio * chartHeight;
        const tickPrice = maximumPrice - ratio * (maximumPrice - minimumPrice);
        ctx.beginPath();
        ctx.moveTo(chartLeft, tickY);
        ctx.lineTo(chartRight, tickY);
        ctx.stroke();
        ctx.textAlign = 'right';
        ctx.fillText(formatCompactMoney(tickPrice), chartLeft - 6, tickY);
    }
    const dateTimeTicks = createBitcoinDateTimeTicks(panel.inspectionPoints, 3);
    const includeDateOnAxis = formatDateTime(geometry.timeScale.minimumTimestamp, {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
    }, timeZone) !== formatDateTime(geometry.timeScale.maximumTimestamp, {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric'
    }, timeZone);
    dateTimeTicks.forEach((timestamp, index) => {
        const tickX = timestampToX(timestamp);
        ctx.beginPath();
        ctx.moveTo(tickX, chartTop);
        ctx.lineTo(tickX, chartBottom);
        ctx.stroke();
        ctx.textAlign = index === 0 ? 'left' : index === dateTimeTicks.length - 1 ? 'right' : 'center';
        ctx.fillText(formatBitcoinAxisTimestamp(timestamp, {
            includeDate: includeDateOnAxis,
            rangeSeconds: geometry.timeScale.timestampSpan,
            timeZone
        }), tickX, geometry.axisTickY);
    });
    ctx.restore();

    drawHorizontalLevel(ctx, priceToY, panel.referencePrice, chartLeft, chartRight, BITCOIN_DASHBOARD_COLORS.reference, [3, 3]);
    drawHorizontalLevel(ctx, priceToY, panel.buyTriggerPrice, chartLeft, chartRight, BITCOIN_DASHBOARD_COLORS.buyTrigger, [6, 4]);
    drawHorizontalLevel(ctx, priceToY, panel.sellTriggerPrice, chartLeft, chartRight, BITCOIN_DASHBOARD_COLORS.sellTrigger, [6, 4]);
    drawSeries(ctx, panel.history, 'ask', timestampToX, priceToY, BITCOIN_DASHBOARD_COLORS.ask, 1);
    drawSeries(ctx, panel.history, 'bid', timestampToX, priceToY, BITCOIN_DASHBOARD_COLORS.bid, 1);
    drawSeries(ctx, panel.history, 'mid', timestampToX, priceToY, BITCOIN_DASHBOARD_COLORS.mid, 2);

    if (panel.forecast.length) {
        const band = [
            { lowerPrice: panel.latestPrice, timestamp: latestTimestamp, upperPrice: panel.latestPrice },
            ...panel.forecast
        ];
        ctx.save();
        ctx.fillStyle = BITCOIN_DASHBOARD_COLORS.forecastRange;
        ctx.beginPath();
        band.forEach((point, index) => {
            const pointX = timestampToX(point.timestamp);
            const pointY = priceToY(point.upperPrice);
            if (index === 0) {
                ctx.moveTo(pointX, pointY);
            } else {
                ctx.lineTo(pointX, pointY);
            }
        });
        [...band].reverse().forEach(point => ctx.lineTo(timestampToX(point.timestamp), priceToY(point.lowerPrice)));
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        drawSeries(
            ctx,
            [{ projectedPrice: panel.latestPrice, timestamp: latestTimestamp }, ...panel.forecast],
            'projectedPrice',
            timestampToX,
            priceToY,
            BITCOIN_DASHBOARD_COLORS.projection,
            2,
            [5, 3]
        );
    }

    const latestX = timestampToX(latestTimestamp);
    const latestY = priceToY(panel.latestPrice);
    ctx.save();
    ctx.fillStyle = BITCOIN_DASHBOARD_COLORS.latest;
    ctx.shadowColor = BITCOIN_DASHBOARD_COLORS.latest;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(latestX, latestY, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (panel.buySignal) {
        drawSignalMarker(ctx, latestX, priceToY(panel.buyTriggerPrice), BITCOIN_DASHBOARD_COLORS.buySignal, 'up');
    }
    if (panel.sellSignal) {
        drawSignalMarker(ctx, latestX, priceToY(panel.sellTriggerPrice), BITCOIN_DASHBOARD_COLORS.sellSignal, 'down');
    }

    if (options.inspection?.panelIndex === options.panelIndex) {
        drawBitcoinInspection(ctx, options.inspection, geometry, timeZone);
    }

    ctx.save();
    ctx.fillStyle = '#8b949e';
    ctx.font = `${compact ? 9 : 10}px ${DASHBOARD_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Date / time', chartLeft + chartWidth / 2, geometry.axisTitleY);
    ctx.translate(x + 10, chartTop + chartHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('BTC Price (USD)', 0, 0);
    ctx.restore();

    const performanceY = y + rect.height - performanceHeight + 4;
    ctx.fillStyle = '#8b949e';
    ctx.font = `${smallFont}px ${DASHBOARD_FONT_FAMILY}`;
    ctx.textBaseline = 'top';
    const performanceLine = panel.performance
        ? `Backtest N ${panel.performance.testCount} | MAE ${formatMoney(panel.performance.mae)} | RMSE ${formatMoney(panel.performance.rmse)} | MAPE ${panel.performance.mapePct.toFixed(3)}% | Dir ${panel.performance.directionalAccuracyPct.toFixed(1)}% | 80% ${panel.performance.rangeCoveragePct.toFixed(1)}% | vs naive ${formatSigned(panel.performance.skillVsNaivePct, 1, '%')}`
        : 'Backtest unavailable: more valid historical observations are required.';
    drawClippedText(ctx, performanceLine, textX, performanceY, textWidth);
}

export function renderBitcoinDashboard(ctx, dashboard, layout, options = {}) {
    if (!ctx || !layout) {
        return;
    }
    const model = dashboard && typeof dashboard === 'object'
        ? dashboard
        : buildBitcoinDashboardViewModel([]);
    const originX = finiteNumber(options.originX);
    const originY = finiteNumber(options.originY);
    const palette = options.palette || {};
    ctx.save();
    const background = ctx.createLinearGradient(originX, originY, originX, originY + layout.height);
    background.addColorStop(0, 'rgba(7, 12, 20, 0.98)');
    background.addColorStop(1, 'rgba(2, 6, 12, 0.98)');
    ctx.fillStyle = background;
    ctx.fillRect(originX, originY, layout.width, layout.height);
    ctx.strokeStyle = palette.border || 'rgba(139, 148, 158, 0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(originX + 0.5, originY + 0.5, layout.width - 1, layout.height - 1);
    ctx.textBaseline = 'top';
    ctx.fillStyle = palette.title || '#f0f6fc';
    ctx.font = `700 ${layout.width < 560 ? 15 : 18}px ${DASHBOARD_FONT_FAMILY}`;
    ctx.fillText(model.title || 'BITCOIN ANALYTICS DASHBOARD', originX + 12, originY + 10);
    ctx.fillStyle = '#8b949e';
    ctx.font = `${layout.width < 560 ? 9 : 10}px ${DASHBOARD_FONT_FAMILY}`;
    drawClippedText(
        ctx,
        `${model.sourceLabel || 'Repository history'} | generated ${formatBitcoinTooltipTimestamp(model.generatedAt || Date.now(), { timeZone: model.timeZone })} | times ${model.timeZone || 'local'} | hover to inspect • click to lock • Esc to clear`,
        originX + 12,
        originY + 34,
        layout.width - 24
    );
    drawLegend(
        ctx,
        Array.isArray(model.legend) ? model.legend : DASHBOARD_LEGEND,
        originX + 12,
        originY + (layout.width < 560 ? 61 : 61),
        layout.width - 24,
        layout.width < 560 ? 9 : 10
    );
    layout.panelRects.forEach((rect, index) => {
        const panel = model.panels?.[index] || buildUnavailablePanel('--');
        if (panel.available) {
            drawAvailablePanel(ctx, panel, rect, originX, originY, {
                inspection: options.inspection,
                panelIndex: index,
                timeZone: model.timeZone
            });
        } else {
            drawUnavailablePanel(ctx, panel, rect, originX, originY);
        }
    });
    ctx.fillStyle = '#8b949e';
    ctx.font = `${layout.width < 560 ? 9 : 10}px ${DASHBOARD_FONT_FAMILY}`;
    ctx.textBaseline = 'bottom';
    drawClippedText(
        ctx,
        'Signals and trigger levels are model diagnostics from limited repository history—not orders, guarantees, or financial advice.',
        originX + 12,
        originY + layout.height - 11,
        layout.width - 24
    );
    ctx.restore();
}
