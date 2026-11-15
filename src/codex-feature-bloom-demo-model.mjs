function validSize(size) {
    if (!Number.isInteger(size) || size < 8 || size > 32 || size % 8) {
        throw new RangeError('Choose 8, 16, 24, or 32 bits.');
    }
    return size;
}

function normalize(word) {
    const value = String(word).trim().toLowerCase();
    if (!/^[a-z]{1,16}$/.test(value)) throw new RangeError('Use 1–16 letters, a–z.');
    return value;
}

export function positions(word, size) {
    validSize(size);
    const codes = [...normalize(word)].map(letter => letter.charCodeAt(0));
    return [codes.reduce((sum, code) => sum + code, 0) % size,
        codes.reduce((sum, code, index) => sum + code * (index + 1), 0) % size];
}

export function createBloom() {
    let size = 8;
    const words = new Set();
    const bits = () => [...new Set([...words].flatMap(word => positions(word, size)))].sort((a, b) => a - b);
    return {
        size: () => size,
        words: () => [...words],
        bits,
        insert(word) { words.add(normalize(word)); },
        resize(value) { size = validSize(value); },
        reset() { words.clear(); size = 8; },
        query(word) {
            const value = normalize(word);
            const hashes = positions(value, size);
            return { word: value, hashes, inserted: words.has(value),
                decision: hashes.every(bit => bits().includes(bit)) ? 'Probably present' : 'Definitely absent' };
        }
    };
}
