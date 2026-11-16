export function passageKey(passage) {
    return `${passage.page.number}-${passage.start}-${passage.end}`;
}

export function keepPassage(pins, passage) {
    if (!passage || pins.length >= 2 || pins.some(pin => passageKey(pin) === passageKey(passage))) return pins;
    return [...pins, passage];
}

export function passageContext(passage) {
    return passage.page.lines.slice(Math.max(0, passage.from - 1), passage.to + 2)
        .map(line => line.text).join('\n');
}
