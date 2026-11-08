import { getDocument, GlobalWorkerOptions } from '/vendor/pdfjs/pdf.min.mjs';

GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';

const sectionNames = new Set([
    'Technical Highlights', 'Skills', 'Professional Experience', 'Technical Projects', 'Education'
]);

function appendText(parent, tag, text) {
    const element = document.createElement(tag);
    element.textContent = text;
    parent.append(element);
    return element;
}

function readLines(items) {
    const lines = [];
    let text = '';
    let left;
    let bulletLeft;
    for (const item of items) {
        if (left === undefined && item.str.trim()) left = item.transform[4];
        text += item.str;
        if (!item.hasEOL && item !== items.at(-1)) continue;

        const line = text.trim();
        if (line.startsWith('- ')) {
            lines.push(line);
            bulletLeft = left;
        } else if (line && bulletLeft !== undefined && left > bulletLeft + 4) {
            lines[lines.length - 1] += ' ' + line;
        } else if (line) {
            lines.push(line);
            bulletLeft = undefined;
        }
        text = '';
        left = undefined;
    }
    return lines;
}

export async function populateResume(container, pdfUrl) {
    const loadingTask = getDocument({ url: pdfUrl, isEvalSupported: false });
    let lines;
    try {
        const pdf = await loadingTask.promise;
        const pages = await Promise.all(Array.from({ length: pdf.numPages }, async (_, index) => {
            const page = await pdf.getPage(index + 1);
            const { items } = await page.getTextContent();
            return readLines(items);
        }));
        lines = pages.flat();
    } finally {
        await loadingTask.destroy();
    }

    if (lines.length < 3) throw new Error('Résumé text is missing');

    const [name, contact, ...body] = lines;
    const content = document.createDocumentFragment();
    const header = document.createElement('header');
    appendText(header, 'h1', name).tabIndex = -1;
    appendText(header, 'p', contact).className = 'resume-contact';
    content.append(header);

    let section = content;
    let heading = '';
    let list;
    let previousText;
    for (const line of body) {
        if (sectionNames.has(line)) {
            heading = line;
            section = document.createElement('section');
            appendText(section, 'h2', line);
            content.append(section);
            list = undefined;
            previousText = undefined;
        } else if (line.startsWith('- ')) {
            if (!list) {
                list = document.createElement('ul');
                section.append(list);
            }
            previousText = appendText(list, 'li', line.slice(2));
        } else if (/^https?:\/\/\S+$/i.test(line)) {
            const link = appendText(section, 'a', line);
            link.href = line;
            list = undefined;
            previousText = undefined;
        } else if (heading === 'Education' || heading === 'Professional Experience' ||
                   heading === 'Technical Projects') {
            appendText(section, 'h3', line);
            list = undefined;
            previousText = undefined;
        } else if (previousText) {
            previousText.append(' ', line);
        } else {
            previousText = appendText(section, 'p', line);
        }
    }

    container.replaceChildren(content);
}
