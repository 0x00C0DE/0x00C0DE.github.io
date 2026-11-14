import { projectPaths } from './codex-feature-project-paths.mjs';

export async function loadEvidence(projects, fetchPage, parseFacts) {
    return Promise.all(projects.map(async project => {
        try {
            const response = await fetchPage(project.href);
            if (!response.ok) throw new Error('Source unavailable');
            const facts = parseFacts(await response.text());
            if (!facts.length) throw new Error('Fact panel unavailable');
            return { ...project, facts, unavailable: false };
        } catch {
            return { ...project, facts: [], unavailable: true };
        }
    }));
}

export function findEvidence(entries, value, interest) {
    const query = value.trim().toLowerCase();
    return entries.flatMap(entry => {
        if (interest && !projectPaths[interest]?.some(item => item.href === entry.href)) return [];
        const excerpts = query ? entry.facts.filter(text => text.toLowerCase().includes(query)) : [];
        return !query || entry.title.toLowerCase().includes(query) || excerpts.length
            ? [{ ...entry, excerpts }] : [];
    });
}

export function attachEvidence({ entries, input, select, clear, status, empty, sourceStatus, render }) {
    function update() {
        const results = findEvidence(entries, input.value, select.value);
        render(results);
        status.textContent = `${results.length} of ${entries.length} projects`;
        empty.hidden = results.length !== 0;
        const failed = entries.filter(entry => entry.unavailable).length;
        sourceStatus.textContent = failed
            ? `Partial results: ${failed} of ${entries.length} project sources unavailable. Title search still works; technology matches may be missing.`
            : 'Technology search uses the seven public project fact panels.';
    }
    function reset() {
        input.value = '';
        select.value = '';
        update();
        input.focus();
    }
    input.addEventListener('input', update);
    select.addEventListener('change', update);
    clear.addEventListener('click', reset);
    input.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            event.preventDefault();
            reset();
        }
    });
    update();
}

async function bootEvidence() {
    const input = document.querySelector('#project-filter');
    if (!input) return;
    const sourceStatus = document.querySelector('#project-evidence-status');
    sourceStatus.textContent = 'Loading project facts; title search is available.';
    const links = [...document.querySelectorAll('#project-links nav > a')];
    const projects = links.map(link => ({ href: link.getAttribute('href'), title: link.textContent }));
    const entries = await loadEvidence(projects,
        href => fetch(href, { signal: AbortSignal.timeout(5000) }),
        html => [...new DOMParser().parseFromString(html, 'text/html')
            .querySelectorAll('#project-facts dl dd')].map(node => node.textContent));
    const notes = links.map((link, index) => {
        const note = document.createElement('small');
        note.className = 'project-evidence-excerpt';
        note.id = `project-evidence-${index}`;
        link.after(note);
        return note;
    });
    attachEvidence({ entries, input, sourceStatus,
        select: document.querySelector('#project-interest'),
        clear: document.querySelector('#project-evidence-clear'),
        status: document.querySelector('#project-filter-count'),
        empty: document.querySelector('#project-filter-empty'),
        render(results) {
            links.forEach((link, index) => {
                const result = results.find(entry => entry.href === projects[index].href);
                link.hidden = !result;
                const note = notes[index];
                note.replaceChildren();
                note.hidden = !result?.excerpts.length;
                for (const excerpt of result?.excerpts ?? []) {
                    const text = document.createElement('span');
                    text.textContent = excerpt;
                    note.append(text, document.createElement('br'));
                }
                if (!note.hidden) {
                    const source = document.createElement('a');
                    source.href = `${result.href}#project-facts`;
                    source.textContent = 'Source: project facts';
                    note.append(source);
                }
            });
        },
    });
    document.querySelector('.project-browser').classList.add('project-evidence-ready');
    document.querySelector('label[for="project-filter"]').textContent = 'Search titles and technologies';
    document.querySelector('#project-evidence-clear').hidden = false;
}

if (typeof document !== 'undefined') void bootEvidence();
