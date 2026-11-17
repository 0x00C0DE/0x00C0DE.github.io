export const initial = () => ({ current: { boundary: 50, density: 1 }, history: [] });

export function change(state, action, value) {
    if (action === 'reset') return initial();
    if (action === 'undo') return state.history.length
        ? { current: state.history.at(-1), history: state.history.slice(0, -1) } : state;
    const bounds = { boundary: [25, 75], density: [1, 3] }[action];
    if (!bounds || !Number.isInteger(value) || value < bounds[0] || value > bounds[1]) {
        throw new RangeError('Invalid material setting');
    }
    if (state.current[action] === value) return state;
    return { current: { ...state.current, [action]: value },
        history: [...state.history.slice(-99), state.current] };
}
