import { createJob, advanceJob, describeJob } from './codex-feature-shell-lifecycle-core.mjs';

const root = document.querySelector('#shell-lifecycle');
if (root) {
    let job = createJob();
    const find = selector => root.querySelector(selector);
    const next = find('#shell-next');
    const trace = find('#shell-trace');
    function render() {
        const view = describeJob(job);
        find('#shell-child').textContent = view.child;
        find('#shell-prompt').textContent = view.prompt;
        find('#shell-prompt').dataset.state = view.prompt.toLowerCase();
        find('#shell-stage').textContent = `Stage ${job.stage + 1} of 4 · ${view.child}`;
        root.querySelectorAll('#shell-stages li').forEach((item, index) => {
            if (index === job.stage) item.setAttribute('aria-current', 'step');
            else item.removeAttribute('aria-current');
        });
        // Retain previous rows so only the newly appended event animates.
        if (trace.children.length > view.events.length) trace.replaceChildren();
        for (const event of view.events.slice(trace.children.length)) {
            const item = document.createElement('li');
            item.textContent = event;
            trace.append(item);
        }
        next.textContent = view.next;
        // Keep the focused primary control reachable at the terminal stage.
        next.setAttribute('aria-disabled', String(job.stage === 3));
    }
    next.addEventListener('click', () => {
        if (job.stage === 3) return;
        job = advanceJob(job);
        render();
    });
    find('#shell-reset').addEventListener('click', () => {
        job = createJob();
        find('#shell-mode').value = job.mode;
        trace.replaceChildren();
        render();
    });
    find('#shell-mode').addEventListener('change', event => {
        job = createJob(event.target.value);
        trace.replaceChildren();
        render();
    });
    find('#shell-controls').hidden = false;
    find('#shell-live').hidden = false;
    render();
}
