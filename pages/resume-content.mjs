import { getDocument, GlobalWorkerOptions, TextLayer } from '/vendor/pdfjs/pdf.min.mjs';

GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';

function addLinks(sheet, viewport, annotations) {
    const [a, b, c, d, e, f] = viewport.transform;
    for (const { subtype, url, rect } of annotations) {
        if (subtype !== 'Link' || !rect || !/^(https?:|mailto:|tel:)/i.test(url ?? '')) continue;

        const [left, bottom, right, top] = rect;
        const x1 = a * left + c * bottom + e;
        const y1 = b * left + d * bottom + f;
        const x2 = a * right + c * top + e;
        const y2 = b * right + d * top + f;
        const link = document.createElement('a');
        link.className = 'resume-link';
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('aria-label', url);
        link.style.left = `${100 * Math.min(x1, x2) / viewport.width}%`;
        link.style.top = `${100 * Math.min(y1, y2) / viewport.height}%`;
        link.style.width = `${100 * Math.abs(x2 - x1) / viewport.width}%`;
        link.style.height = `${100 * Math.abs(y2 - y1) / viewport.height}%`;
        sheet.append(link);
    }
}

export async function populateResume(container, pdfUrl) {
    const loadingTask = getDocument({ url: pdfUrl, isEvalSupported: false });
    const content = document.createDocumentFragment();
    const sizes = new Map();

    try {
        const pdf = await loadingTask.promise;
        for (let number = 1; number <= pdf.numPages; number++) {
            const page = await pdf.getPage(number);
            const viewport = page.getViewport({ scale: 1 });
            const rasterViewport = page.getViewport({ scale: 2 });
            const sheet = document.createElement('section');
            sheet.className = 'resume-sheet';
            sheet.setAttribute('aria-label', `Résumé page ${number} of ${pdf.numPages}`);
            sheet.style.width = `${viewport.width * 4 / 3}px`;
            sheet.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
            sheet.style.setProperty('--total-scale-factor', '1');

            const canvas = document.createElement('canvas');
            canvas.width = Math.ceil(rasterViewport.width);
            canvas.height = Math.ceil(rasterViewport.height);
            canvas.setAttribute('aria-hidden', 'true');

            const text = document.createElement('div');
            text.className = 'resume-text-layer';
            const layer = new TextLayer({
                textContentSource: page.streamTextContent(),
                container: text,
                viewport
            });

            sheet.append(canvas, text);
            await Promise.all([
                page.render({ canvas, viewport: rasterViewport }).promise,
                layer.render()
            ]);
            addLinks(sheet, viewport, await page.getAnnotations({ intent: 'display' }));
            content.append(sheet);
            sizes.set(sheet, viewport.width);
        }
    } finally {
        await loadingTask.destroy();
    }

    container.replaceChildren(content);
    const resize = new ResizeObserver(entries => {
        for (const { target, contentRect } of entries) {
            target.style.setProperty('--total-scale-factor', String(contentRect.width / sizes.get(target)));
        }
    });
    for (const [sheet, width] of sizes) {
        sheet.style.setProperty('--total-scale-factor', String(sheet.getBoundingClientRect().width / width));
        resize.observe(sheet);
    }
}
