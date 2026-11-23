export function headingLines(blocks, metrics, scrollTop, viewportHeight) {
    return blocks.filter(block => block.data?.type === 'help-heading').flatMap(block =>
        (block.layout?.plans || []).flatMap((line, index) => {
            const y = block.top + line.y - scrollTop;
            if (y + metrics.lineHeight <= 0 || y >= viewportHeight) return [];
            return [{ id: `${block.id}-${index}`, text: line.plans.map(p => p.text).join(''),
                x: metrics.paddingX + line.x, y,
                width: Math.max(0, ...line.plans.map(p => p.x + p.width)),
                height: metrics.lineHeight, font: metrics.textFont }];
        }));
}
