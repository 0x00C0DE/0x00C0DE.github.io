export const initial = Object.freeze({ word: 'FORM', depth: 1, outline: false });

export function change(state, action, value) {
    switch (action) {
        case 'word': return { ...state, word: String(value).toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 6) };
        case 'depth': return Number.isFinite(Number(value))
            ? { ...state, depth: Math.min(4, Math.max(1, Number(value))) } : state;
        case 'outline': return { ...state, outline: Boolean(value) };
        case 'reset': return { ...initial };
        default: return state;
    }
}
