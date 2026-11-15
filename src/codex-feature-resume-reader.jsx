import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import LineSidebar from 'react-bits:LineSidebar';
import SpotlightCard from 'react-bits:SpotlightCard';
import { pageText, findPassages } from './codex-feature-resume-reader-model.mjs';
import './codex-feature-resume-reader-style.css';

function SourcePage({ pdf, number }) {
    const canvas = useRef(null);
    const [error, setError] = useState(false);
    useEffect(() => {
        let cancelled = false;
        let render;
        setError(false);
        (async () => {
            const page = await pdf.getPage(number);
            if (cancelled) return;
            const viewport = page.getViewport({ scale: 1.5 });
            canvas.current.width = Math.ceil(viewport.width);
            canvas.current.height = Math.ceil(viewport.height);
            render = page.render({ canvas: canvas.current, viewport });
            await render.promise;
            if (!cancelled) canvas.current.dataset.ready = 'true';
        })().catch(() => { if (!cancelled) setError(true); });
        return () => { cancelled = true; render?.cancel(); };
    }, [pdf, number]);
    return <section id="reader-source" aria-label={`Source page ${number}`} tabIndex={-1}>
        <h2>Source · page {number}</h2>
        <p><a id="reader-source-link" href={`/assets/resume.pdf#page=${number}`}>Open PDF at page {number} ↗</a></p>
        {error && <p role="status">Page preview unavailable. Open the source PDF above.</p>}
        <canvas ref={canvas} id="reader-canvas" aria-label={`Original PDF page ${number}`} role="img" />
    </section>;
}

function Reader({ pdf, pages }) {
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(null);
    const [number, setNumber] = useState(1);
    const passage = useRef(null);
    const matches = findPassages(pages, query);
    useEffect(() => { if (selected) passage.current?.focus(); }, [selected]);
    const pageLinks = pages.map(page => <a href="#reader-source" key={page.number}
        id={`reader-page-${page.number}`} onClick={() => setNumber(page.number)}>Page {page.number}</a>);
    const matchLinks = matches.map((match, index) => <a key={index} id={`reader-match-${index}`}
        href="#reader-passage" aria-current={selected?.start === match.start && selected?.page.number === match.page.number ? 'true' : undefined}
        onClick={event => {
            event.preventDefault(); setSelected(match); setNumber(match.page.number);
        }}>Page {match.page.number} · lines {match.from + 1}–{match.to + 1}
        <small>{match.page.text.slice(match.start, Math.min(match.end + 45, match.page.text.length))}</small></a>);
    return <>
        <label htmlFor="reader-search">Search published résumé text</label>
        <input id="reader-search" type="search" placeholder="Try Python or reliability" value={query}
            onChange={event => { setQuery(event.target.value); setSelected(null); }} />
        <p id="reader-status" role="status">{query.trim() ? `${matches.length} matching passages` : 'Enter a word or phrase to find passages.'}</p>
        <p id="reader-no-match" hidden={!query.trim() || matches.length > 0}>No passages found. Try another word or clear the search.</p>
        <div className="reader-layout">
            <aside aria-label="Pages and search results">
                <h2>Pages</h2><LineSidebar items={pageLinks} showIndex={false} maxShift={0}
                    accentColor="#8fe388" markerLength={14} itemGap={8} smoothing={1} />
                <h2>Matches</h2><div id="reader-results" hidden={!matches.length}>
                    <LineSidebar key={query} items={matchLinks} showIndex={false} maxShift={0}
                        accentColor="#8fe388" markerLength={14} itemGap={8} smoothing={1} />
                </div>
            </aside>
            <section aria-label="Enlarged passage">
                {selected ? <SpotlightCard className="reader-selected" intensity={0.08} flare={false}
                    spotlightColor="#8fe388" smoothing={0}>
                    <div ref={passage} id="reader-passage" tabIndex={-1}>
                        <h2>Page {selected.page.number} · lines {selected.from + 1}–{selected.to + 1}</h2>
                        <p>Matching text with one surrounding line on each side.</p>
                        <blockquote>{selected.page.lines.slice(Math.max(0, selected.from - 1), selected.to + 2)
                            .map(line => {
                                const start = Math.max(0, selected.start - line.start);
                                const end = Math.min(line.text.length, selected.end - line.start);
                                return <span className="reader-line" key={line.start}>{end > start
                                    ? <>{line.text.slice(0, start)}<mark>{line.text.slice(start, end)}</mark>{line.text.slice(end)}</>
                                    : line.text}</span>;
                            })}</blockquote>
                        <a id="reader-passage-source" href={`/assets/resume.pdf#page=${selected.page.number}`}>Read passage in source PDF ↗</a>
                    </div>
                </SpotlightCard> : <p id="reader-prompt">Select a matching passage to enlarge its context.</p>}
            </section>
            <SourcePage pdf={pdf} number={number} />
        </div>
    </>;
}

const root = createRoot(document.getElementById('resume-reader'));
try {
    // Keep PDF.js external to the React bundle, using the site's existing assets.
    const pdfModule = '/vendor/pdfjs/pdf.min.mjs';
    const { getDocument, GlobalWorkerOptions } = await import(pdfModule);
    GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.mjs';
    const pdf = await getDocument({ url: '/assets/resume.pdf', isEvalSupported: false }).promise;
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number++) {
        const page = await pdf.getPage(number);
        pages.push(pageText((await page.getTextContent()).items, number));
    }
    root.render(<Reader pdf={pdf} pages={pages} />);
} catch {
    root.render(<p role="alert">Search could not load. Open the source PDF above to read the résumé.</p>);
}
