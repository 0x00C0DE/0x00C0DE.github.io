export function pinBaseline(layout) {
    return Object.freeze({
        ...layout,
        lines: Object.freeze(layout.lines.map(line => Object.freeze({ ...line })))
    });
}

export function baselineDeltas(current, baseline) {
    return {
        lines: current.lineCount - baseline.lineCount,
        height: current.height - baseline.height,
        widest: current.widestLineWidth - baseline.widestLineWidth
    };
}
