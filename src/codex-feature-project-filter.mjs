export function attachProjectFilter({ input, status, empty, controls, links }) {
    function update() {
        const query = input.value.trim().toLowerCase();
        let count = 0;
        for (const link of links) {
            link.hidden = !link.textContent.toLowerCase().includes(query);
            if (!link.hidden) count++;
        }
        status.textContent = `${count} of ${links.length} projects`;
        empty.hidden = count !== 0;
    }
    input.addEventListener('input', update);
    update();
    controls.hidden = false;
}

if (typeof document !== 'undefined') {
    const controls = document.querySelector('#project-filter-controls');
    if (controls) {
        attachProjectFilter({
            controls,
            input: document.querySelector('#project-filter'),
            status: document.querySelector('#project-filter-count'),
            empty: document.querySelector('#project-filter-empty'),
            links: [...document.querySelectorAll('#project-links a')],
        });
    }
}
