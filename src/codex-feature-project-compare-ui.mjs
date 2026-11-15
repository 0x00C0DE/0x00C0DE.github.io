import { comparisonFields, readComparison, toggleSelection } from './codex-feature-project-compare-core.mjs';

const host = document.querySelector('#project-compare');
if (host) {
    const links = [...document.querySelectorAll('#project-links nav > a')];
    const choices = host.querySelector('#compare-choices');
    const results = host.querySelector('#compare-results');
    const status = host.querySelector('#compare-status');
    let selected = [];
    const entries = links.map((link, index) => ({
        id: index, title: link.textContent, href: link.getAttribute('href'),
        facts: readComparison(null), state: 'Loading public panel…',
    }));
    const controls = entries.map(entry => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = `compare-select-${entry.id}`;
        input.addEventListener('change', () => {
            selected = toggleSelection(selected, entry.id);
            render();
        });
        label.append(input, document.createTextNode(entry.title));
        choices.append(label);
        return input;
    });
    function render() {
        controls.forEach((input, index) => {
            input.checked = selected.includes(index);
            input.disabled = selected.length === 3 && !input.checked;
        });
        status.textContent = `${selected.length} of 3 selected. ` + (selected.length === 3
            ? 'Remove a selection to choose another.' : 'Choose two or three projects.');
        results.replaceChildren();
        results.hidden = selected.length < 2;
        for (const id of selected) {
            const entry = entries[id];
            const column = document.createElement('article');
            column.id = `compare-project-${id}`;
            const heading = document.createElement('h3');
            const source = document.createElement('a');
            source.href = `${entry.href}#project-facts`;
            source.textContent = entry.title;
            heading.append(source);
            const state = document.createElement('p');
            state.textContent = entry.state;
            const facts = document.createElement('dl');
            comparisonFields.forEach((field, index) => {
                const label = document.createElement('dt');
                label.textContent = field;
                const value = document.createElement('dd');
                value.id = `compare-fact-${id}-${index}`;
                value.textContent = entry.facts[field];
                facts.append(label, value);
            });
            column.append(heading, state, facts);
            results.append(column);
        }
    }
    host.querySelector('#compare-clear').addEventListener('click', () => {
        selected = [];
        render();
        controls[0].focus();
    });
    host.hidden = false;
    render();
    entries.forEach(async entry => {
        try {
            const response = await fetch(entry.href, { signal: AbortSignal.timeout(5000) });
            if (!response.ok) throw new Error('Public panel unavailable');
            const panel = new DOMParser().parseFromString(await response.text(), 'text/html')
                .querySelector('#project-facts');
            if (!panel) throw new Error('Public panel missing');
            entry.facts = readComparison(panel);
            entry.state = 'Source: public project facts';
        } catch {
            entry.state = 'Public panel unavailable. Open the project link to read its write-up.';
        }
        render();
    });
}
