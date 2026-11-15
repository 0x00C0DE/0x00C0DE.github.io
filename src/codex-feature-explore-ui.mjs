import { journeyState, moveJourney } from './codex-feature-explore-state.mjs';

const byId = (id) => document.getElementById(id);
const journeys = new Map();
let state;

function render(focus = false) {
    for (const branch of ['robot', 'layout']) {
        const section = byId(`${branch}-journey`);
        section.hidden = branch !== state.branch;
        section.querySelectorAll('[data-stage]').forEach((stage) => {
            stage.hidden = Number(stage.dataset.stage) !== state.stage;
        });
        byId(`choose-${branch}`).setAttribute('aria-pressed', String(branch === state.branch));
    }
    for (let index = 0; index < 3; index++) {
        const button = byId(`step-${index}`);
        button.disabled = !state.visited.includes(index);
        if (index === state.stage) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
    }
    byId('journey-back').disabled = state.stage === 0;
    byId('journey-next').hidden = state.stage === 2;
    byId('journey-finish').hidden = state.stage !== 2 || state.complete;
    byId('journey-complete').hidden = !state.complete;
    byId('journey-status').textContent = `${state.branch === 'robot' ? 'Robot decision' : 'Text layout'} / Step ${state.stage + 1} of 3`;
    journeys.set(state.branch, state);
    if (focus) {
        const heading = byId(`${state.branch}-journey`).querySelector(`[data-stage="${state.stage}"] h3`);
        heading.tabIndex = -1;
        heading.focus();
    }
}

document.querySelectorAll('[data-branch]').forEach((button) => {
    button.addEventListener('click', () => {
        state = journeys.get(button.dataset.branch) ?? journeyState(button.dataset.branch);
        byId('journey-controls').hidden = false;
        byId('journey-actions').hidden = false;
        render(true);
    });
});
document.querySelectorAll('[data-step]').forEach((button) => {
    button.addEventListener('click', () => {
        state = moveJourney(state, Number(button.dataset.step));
        render(true);
    });
});
for (const action of ['back', 'next', 'finish']) {
    byId(`journey-${action}`).addEventListener('click', () => {
        state = moveJourney(state, action);
        render(true);
    });
}
byId('branch-menu').hidden = false;
