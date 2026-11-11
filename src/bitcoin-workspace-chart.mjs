import { createBitcoinTimeScale, formatBitcoinAxisTimestamp } from './bitcoin-dashboard-core.mjs?v=20261111b';

const quoteFormat = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
});

const colors = {
    mid: '#245f45',
    bid: '#536b86',
    ask: '#98594b',
    forecast: '#984122',
    band: '#f2dfd1',
    reference: '#636775',
    grid: '#d7d9ce',
    text: '#566052'
};

export function drawBitcoinWorkspaceChart(canvas, panel, history, forecast, overlays, selected, timeZone) {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const ratio = window.devicePixelRatio || 1;
    const pixelWidth = Math.round(width * ratio);
    const pixelHeight = Math.round(height * ratio);
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const levels = overlays.has('levels') ? [panel.buyTriggerPrice, panel.referencePrice, panel.sellTriggerPrice] : [];
    const values = [
        ...history.flatMap(point => overlays.has('quotes') ? [point.bid, point.mid, point.ask] : [point.mid]),
        ...forecast.flatMap(point => [point.lowerPrice, point.upperPrice]),
        ...levels
    ].filter(Number.isFinite);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const margin = Math.max(1, (max - min) * 0.09);
    const top = 15;
    const bottom = height - 33;
    const { timestampToX, xToTimestamp, minimumTimestamp, timestampSpan } =
        createBitcoinTimeScale([...history, ...forecast], 58, width - 8);
    const x = point => timestampToX(point.timestamp);
    const y = value => bottom - ((value - min + margin) / (max - min + 2 * margin)) * (bottom - top);

    function line(points, key, color, lineWidth = 1, dash = []) {
        if (!points.length) return;
        ctx.beginPath();
        points.forEach((point, i) => {
            if (i === 0) ctx.moveTo(x(point), y(point[key]));
            else ctx.lineTo(x(point), y(point[key]));
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash(dash);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = colors.text;
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.textAlign = 'right';
    for (let tick = 0; tick <= 4; tick += 1) {
        const value = min - margin + ((max - min + 2 * margin) * tick) / 4;
        ctx.beginPath();
        ctx.moveTo(58, y(value));
        ctx.lineTo(width - 8, y(value));
        ctx.stroke();
        ctx.fillText(quoteFormat.format(value), 50, y(value));
    }
    const tickCount = width < 390 ? 2 : width < 660 ? 3 : 5;
    for (let tick = 0; tick < tickCount; tick += 1) {
        const fraction = tick / (tickCount - 1);
        const timestamp = minimumTimestamp + timestampSpan * fraction;
        ctx.textAlign = tick === 0 ? 'left' : tick === tickCount - 1 ? 'right' : 'center';
        ctx.fillText(formatBitcoinAxisTimestamp(timestamp, {
            includeDate: timestampSpan >= 86_400,
            rangeSeconds: timestampSpan,
            timeZone
        }), timestampToX(timestamp), bottom + 17);
    }

    const latest = history.at(-1);
    if (forecast.length) {
        const band = [{ ...latest, upperPrice: latest.mid, lowerPrice: latest.mid }, ...forecast];
        ctx.beginPath();
        band.forEach((point, i) => {
            if (i === 0) ctx.moveTo(x(point), y(point.upperPrice));
            else ctx.lineTo(x(point), y(point.upperPrice));
        });
        [...band].reverse().forEach(point => ctx.lineTo(x(point), y(point.lowerPrice)));
        ctx.closePath();
        ctx.fillStyle = colors.band;
        ctx.fill();
    }
    levels.forEach((value, i) => {
        if (!Number.isFinite(value)) return;
        line([
            { timestamp: minimumTimestamp, value },
            { timestamp: minimumTimestamp + timestampSpan, value }
        ], 'value', [colors.bid, colors.reference, colors.ask][i], 1, [3, 4]);
    });
    if (overlays.has('quotes')) {
        line(history, 'bid', colors.bid);
        line(history, 'ask', colors.ask);
    }
    line(history, 'mid', colors.mid, 2);
    if (forecast.length) {
        line([{ ...latest, projectedPrice: latest.mid }, ...forecast], 'projectedPrice', colors.forecast, 1.75, [5, 4]);
    }
    if (selected) {
        const selectedPrice = selected.mid ?? selected.projectedPrice;
        const cursorX = x(selected);
        ctx.beginPath();
        ctx.moveTo(cursorX, top);
        ctx.lineTo(cursorX, bottom);
        ctx.strokeStyle = colors.reference;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cursorX, y(selectedPrice), 4, 0, Math.PI * 2);
        ctx.fillStyle = selected.mid === undefined ? colors.forecast : colors.mid;
        ctx.fill();
    }

    return { xToTimestamp };
}
