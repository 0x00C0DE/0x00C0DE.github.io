export function journeyState(branch) {
    if (!['robot', 'layout'].includes(branch)) throw new RangeError('Unknown journey');
    return { branch, stage: 0, visited: [0], complete: false };
}

export function moveJourney(state, action) {
    if (action === 'finish') return { ...state, complete: state.stage === 2 };
    const stage = action === 'next' ? Math.min(2, state.stage + 1)
        : action === 'back' ? Math.max(0, state.stage - 1) : action;
    if (!Number.isInteger(stage) || stage < 0 || stage > 2) return state;
    if (!['next', 'back'].includes(action) && !state.visited.includes(stage)) return state;
    return { ...state, stage, visited: [...new Set([...state.visited, stage])] };
}
