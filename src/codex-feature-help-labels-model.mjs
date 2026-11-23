export function headingLines(blocks, metrics, scrollTop, viewportHeight) {
    return blocks.filter(block => block.data?.type === 'help-heading').flatMap(block =>
        (block.layout?.plans || []).flatMap((line, index) => {
            // Snap to CSS layout units before serialization. Truncating negative and
            // positive positions independently can overlap adjacent wrapped rows.
            const y = Math.round((block.top + line.y - scrollTop) * 64) / 64;
            if (y + metrics.lineHeight <= 0 || y >= viewportHeight) return [];
            return [{ id: `${block.id}-${index}`, text: line.plans.map(p => p.text).join(''),
                x: metrics.paddingX + line.x, y, kind: block.data.role === 'title' ? 'title' : 'section',
                width: Math.max(0, ...line.plans.map(p => p.x + p.width)),
                height: metrics.lineHeight, font: metrics.textFont }];
        }));
}
