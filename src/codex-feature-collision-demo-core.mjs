// Arena: 100 × 100 units. Robot radius 5, obstacle radius 10, surface gap ≥ 8.
export function reset() {
    return { robot: { x: 15, y: 50 }, obstacle: { x: 45, y: 50 }, phase: 'sense', hazard: null, message: 'Ready to sense.' };
}
export function segmentClearance(a, b, obstacle) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((obstacle.x - a.x) * dx + (obstacle.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(a.x + t * dx - obstacle.x, a.y + t * dy - obstacle.y) - 15;
}
export function moveObstacle(state, x, y) {
    const obstacle = { x, y };
    if (![x, y].every(Number.isFinite) || x < 10 || x > 90 || y < 10 || y > 90 ||
        segmentClearance(state.robot, state.robot, obstacle) < 8) {
        throw new RangeError('Use coordinates 10–90 and leave at least 8 units of surface clearance.');
    }
    return { ...state, obstacle, phase: 'sense', hazard: null, message: 'Obstacle moved; sense again.' };
}
function forward(robot) { return { x: Math.min(95, robot.x + 8), y: robot.y }; }
export function step(state) {
    if (state.phase === 'sense') return { ...state, phase: 'detect', message: 'Sensed obstacle coordinates and current clearance.' };
    if (state.phase === 'detect') {
        const hazard = segmentClearance(state.robot, forward(state.robot), state.obstacle) < 8;
        return { ...state, phase: 'steer', hazard, message: hazard ? 'Hazard: forward segment violates the gap. Try steering.' : 'Forward segment clears the obstacle.' };
    }
    // Deterministic local policy: forward, upward diagonal, downward diagonal, then hold.
    const candidates = [forward(state.robot), ...[-8, 8].map(dy => ({ x: Math.min(95, state.robot.x + 4), y: state.robot.y + dy }))];
    const robot = candidates.find(p => p.y >= 5 && p.y <= 95 && segmentClearance(state.robot, p, state.obstacle) >= 8) || state.robot;
    return { ...state, robot, phase: 'sense', message: robot === state.robot ? 'Hold: no candidate clears the obstacle.' : 'Moved along a checked segment. Sense again.' };
}
