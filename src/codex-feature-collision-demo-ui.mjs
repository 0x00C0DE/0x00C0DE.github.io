import { reset, step, moveObstacle, segmentClearance } from './codex-feature-collision-demo-core.mjs';

const root = document.querySelector('#collision-demo');
let state = reset();
const find = id => root.querySelector(`#collision-${id}`);
function render() {
    for (const name of ['robot', 'obstacle']) {
        find(name).setAttribute('cx', state[name].x);
        find(name).setAttribute('cy', state[name].y);
    }
    find('gap').setAttribute('cx', state.obstacle.x);
    find('gap').setAttribute('cy', state.obstacle.y);
    find('x').value = state.obstacle.x;
    find('y').value = state.obstacle.y;
    find('status').textContent = `${state.message} Robot (${state.robot.x}, ${state.robot.y}); obstacle (${state.obstacle.x}, ${state.obstacle.y}). Clearance: ${segmentClearance(state.robot, state.robot, state.obstacle).toFixed(2)} units; required ≥ 8. Next: ${state.phase}.`;
    find('hazard').hidden = state.hazard !== true;
    find('step').textContent = `Step: ${state.phase}`;
}
function move(x, y) {
    try {
        state = moveObstacle(state, x, y);
        find('error').hidden = true;
        render();
    } catch (error) {
        if (!(error instanceof RangeError)) throw error;
        find('error').textContent = error.message;
        find('error').hidden = false;
    }
}
find('apply').addEventListener('click', () => move(find('x').valueAsNumber, find('y').valueAsNumber));
find('step').addEventListener('click', () => { state = step(state); render(); });
find('reset').addEventListener('click', () => { state = reset(); find('error').hidden = true; render(); });
const arena = find('arena');
let dragging = false;
find('obstacle').addEventListener('pointerdown', event => {
    dragging = true;
    arena.setPointerCapture(event.pointerId);
    event.preventDefault();
});
arena.addEventListener('pointermove', event => {
    if (!dragging) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(arena.getScreenCTM().inverse());
    move(Math.round(point.x), Math.round(point.y));
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) arena.addEventListener(type, () => { dragging = false; });
find('controls').hidden = false;
render();
