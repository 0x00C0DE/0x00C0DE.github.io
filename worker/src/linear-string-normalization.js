function assertBoundaryCharacter(character) {
    if (typeof character !== 'string' || character.length !== 1) {
        throw new TypeError('boundary character must contain exactly one character');
    }
}

export function stripLeadingCharacter(value, character) {
    assertBoundaryCharacter(character);
    const source = String(value ?? '');
    let start = 0;
    while (start < source.length && source[start] === character) {
        start += 1;
    }
    return start === 0 ? source : source.slice(start);
}

export function stripTrailingCharacter(value, character) {
    assertBoundaryCharacter(character);
    const source = String(value ?? '');
    let end = source.length;
    while (end > 0 && source[end - 1] === character) {
        end -= 1;
    }
    return end === source.length ? source : source.slice(0, end);
}
