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

function formatTimestamp(timestamp, includeSeconds = false) {
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
        return '--';
    }
    return new Date(timestamp * 1000).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: includeSeconds ? '2-digit' : undefined
    });
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

function drawAvailablePanel(ctx, panel, rect, originX, originY) {
    const x = originX + rect.x;
    const y = originY + rect.y;
    const compact = rect.width < 520;
    const padding = compact ? 10 : 12;
    const smallFont = compact ? 10 : 11;
    const titleFont = compact ? 12 : 13;
    const background = ctx.createLinearGradient(x, y, x, y + rect.height);
    background.addColorStop(0, 'rgba(17, 24, 39, 0.97)');
    background.addColorStop(1, 'rgba(4, 9, 16, 0.97)');
    ctx.fillStyle = background;
    ctx.fillRect(x, y, rect.width, rect.height);
    ctx.strokeStyle = getPanelBorderColor(panel);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, rect.width - 1, rect.height - 1);

    const textX = x + padding;
    const textWidth = rect.width - padding * 2;
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
    const lineHeight = smallFont + 5;
    const summaryLines = [
        `Mid ${formatMoney(panel.latestPrice)} | Bid ${formatMoney(panel.bidPrice)} | Ask ${formatMoney(panel.askPrice)} | Ref ${formatMoney(panel.referencePrice)}`,
        `Spread ${panel.spreadBps.toFixed(1)} bps | Shock ${formatSigned(panel.spreadShockBps, 1, ' bps')} | B/S ${formatMoney(panel.buyTriggerPrice)} / ${formatMoney(panel.sellTriggerPrice)}`,
        `Return ${formatSigned(panel.changePct, 2, '%')} | Proj ${formatSigned(panel.projectedReturnPct, 3, '%')} C${panel.forecastConfidence.toFixed(2)} | Updated ${formatTimestamp(panel.updatedTimestamp, true)}`,
        `Momentum ${panel.momentum} | Vol ${panel.volatilityClass} ${panel.volatilityBps.toFixed(1)} bps | ${panel.projectionDirection} | N ${panel.sampleCount}`,
        `Condition ${panel.marketCondition} | Pattern ${panel.historicalPattern} | Coverage ${panel.dataCoveragePct.toFixed(1)}%`,
        `Buy Signal ${panel.buySignal ? 'ACTIVE' : 'WAIT'} | Sell Signal ${panel.sellSignal ? 'ACTIVE' : 'WAIT'} | RSI ${panel.rsi === null ? '--' : panel.rsi.toFixed(1)} | MACD-H ${formatSigned(panel.macdHistogram, 2)}`
    ];
    ctx.font = `${smallFont}px ${DASHBOARD_FONT_FAMILY}`;
    summaryLines.forEach((line, index) => {
        ctx.fillStyle = index === summaryLines.length - 1 ? statusColor : '#c9d1d9';
        drawClippedText(ctx, line, textX, y + padding + titleFont + 7 + index * lineHeight, textWidth);
    });

    const summaryBottom = y + padding + titleFont + 7 + summaryLines.length * lineHeight;
    const performanceHeight = compact ? 34 : 30;
    const chartTop = summaryBottom + 6;
    const chartBottom = y + rect.height - performanceHeight - 22;
    const chartLeft = x + (compact ? 58 : 66);
    const chartRight = x + rect.width - 12;
    const chartWidth = Math.max(40, chartRight - chartLeft);
    const chartHeight = Math.max(54, chartBottom - chartTop);
    const chartValues = [
        ...panel.history.flatMap(point => [point.bid, point.mid, point.ask]),
        panel.referencePrice,
        panel.buyTriggerPrice,
        panel.sellTriggerPrice,
        ...panel.forecast.flatMap(point => [point.lowerPrice, point.projectedPrice, point.upperPrice])
    ].filter(Number.isFinite);
    let minimumPrice = Math.min(...chartValues);
    let maximumPrice = Math.max(...chartValues);
    const pricePadding = Math.max((maximumPrice - minimumPrice) * 0.08, panel.latestPrice * 0.0001, 1);
    minimumPrice -= pricePadding;
    maximumPrice += pricePadding;
    const firstTimestamp = panel.history.length > 1
        ? panel.history[0].timestamp
        : panel.updatedTimestamp - Math.max(1, panel.intervalSeconds);
    const latestTimestamp = panel.updatedTimestamp;
    const lastTimestamp = panel.forecast.at(-1)?.timestamp || latestTimestamp;
    const maximumTimestamp = Math.max(lastTimestamp, latestTimestamp + 1);
    const timestampToX = timestamp => chartLeft + ((timestamp - firstTimestamp) / Math.max(1, maximumTimestamp - firstTimestamp)) * chartWidth;
    const priceToY = price => chartTop + (1 - ((price - minimumPrice) / Math.max(1, maximumPrice - minimumPrice))) * chartHeight;

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
    [firstTimestamp, (firstTimestamp + maximumTimestamp) / 2, maximumTimestamp].forEach((timestamp, index) => {
        const tickX = timestampToX(timestamp);
        ctx.beginPath();
        ctx.moveTo(tickX, chartTop);
        ctx.lineTo(tickX, chartBottom);
        ctx.stroke();
        ctx.textAlign = index === 0 ? 'left' : index === 2 ? 'right' : 'center';
        ctx.fillText(formatTimestamp(timestamp), tickX, chartBottom + 11);
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

    ctx.save();
    ctx.fillStyle = '#8b949e';
    ctx.font = `${compact ? 9 : 10}px ${DASHBOARD_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Time', chartLeft + chartWidth / 2, y + rect.height - performanceHeight - 2);
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
    ctx.fillText(
        `${model.sourceLabel || 'Repository history'} | generated ${new Date(model.generatedAt || Date.now()).toLocaleString()}`,
        originX + 12,
        originY + 34
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
            drawAvailablePanel(ctx, panel, rect, originX, originY);
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
