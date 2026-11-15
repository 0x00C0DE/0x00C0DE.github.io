export const comparisonFields = ['Domain', 'Primary stack', 'Core behavior', 'Engineering notes'];

export function readComparison(panel) {
    const facts = new Map([...panel?.querySelectorAll('dl dt') ?? []].map(label => [
        label.textContent, label.nextElementSibling?.tagName === 'DD'
            ? label.nextElementSibling.textContent : '',
    ]));
    return Object.fromEntries(comparisonFields.map(field => [
        field, facts.get(field) || 'Not provided in public panel.',
    ]));
}

export function toggleSelection(selected, id) {
    if (selected.includes(id)) return selected.filter(value => value !== id);
    return selected.length < 3 ? [...selected, id] : selected;
}
