// Keep the title-only enhancement as the fallback if this extension cannot load.
import './codex-feature-project-filter.mjs';

const match = (name, excerpt) => ({ href: `project-${name}.html`, excerpt });
export const projectPaths = {
    systems: [
        match('smallsh', 'systems programming and command interpreter design'),
        match('shellcode-template', 'C, assembly-adjacent debugging, memory layout inspection, and controlled test harnesses'),
    ],
    security: [
        match('qr-totp', 'multi-factor authentication and time-based one-time-password validation'),
        match('shellcode-template', 'offensive-security lab work and low-level payload experimentation'),
        match('bloom-filters', 'explores false-positive behavior and throughput characteristics for security-oriented screening workloads'),
    ],
    robotics: [
        match('collision-avoidance', 'robotics safety, autonomous navigation, and obstacle avoidance'),
    ],
    data: [
        match('proprts', 'Python, feature engineering, model evaluation, exchange-facing automation modules'),
        match('bloom-filters', 'probabilistic data structures and high-volume password screening'),
    ],
    web: [
        match('doublehitcollectibles', 'Jekyll, Sass, JavaScript, Cloudflare Workers, D1, KV, Queues, and Durable Objects'),
    ],
};

export function attachProjectPaths({ input, select, status, empty, controls, links, createNote }) {
    const entries = links.map(link => {
        const note = createNote();
        note.className = 'project-path-excerpt';
        note.hidden = true;
        link.after(note);
        return { link, note };
    });
    function update() {
        const query = input.value.trim().toLowerCase();
        const matches = projectPaths[select.value];
        let count = 0;
        for (const { link, note } of entries) {
            const result = matches?.find(item => item.href === link.getAttribute('href'));
            link.hidden = !link.textContent.toLowerCase().includes(query)
                || (Boolean(select.value) && !result);
            note.hidden = link.hidden || !result;
            note.textContent = result ? `Why this fits: ${result.excerpt}.` : '';
            if (!link.hidden) count++;
        }
        status.textContent = `${count} of ${links.length} projects`;
        empty.hidden = count !== 0;
    }
    // Registered after the existing title filter; both controls finish in one state.
    input.addEventListener('input', update);
    select.addEventListener('change', update);
    update();
    controls.hidden = false;
}

if (typeof document !== 'undefined' && document.querySelector('#project-interest')) {
    attachProjectPaths({
        input: document.querySelector('#project-filter'),
        select: document.querySelector('#project-interest'),
        status: document.querySelector('#project-filter-count'),
        empty: document.querySelector('#project-filter-empty'),
        controls: document.querySelector('#project-path-controls'),
        links: [...document.querySelectorAll('#project-links a')],
        createNote: () => document.createElement('small'),
    });
}
