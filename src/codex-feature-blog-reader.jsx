import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import LineSidebar from 'react-bits:LineSidebar';
import SpecularButton from 'react-bits:SpecularButton';
import { loadFeed, searchEntries } from './codex-feature-blog-reader-model.mjs';
import './codex-feature-blog-reader-style.css';

function Action(props) {
    return <SpecularButton size="sm" radius={4} tint="#9fe8b5" textColor="#d6f5df"
        intensity={0.25} idleIntensity={0.1} followMouse={false} autoAnimate={false} {...props} />;
}

function ReadingDesk() {
    const [entries, setEntries] = useState([]);
    const [state, setState] = useState('loading');
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState(null);
    const heading = useRef(null);
    const search = useRef(null);
    useEffect(() => {
        let live = true;
        loadFeed().then(rows => { if (live) { setEntries(rows); setState('ready'); } })
            .catch(() => { if (live) setState('error'); });
        return () => { live = false; };
    }, []);
    const matches = searchEntries(entries, query);
    const position = Math.max(0, matches.findIndex(entry => entry.id === selected));
    const entry = matches[position];
    function select(next) {
        setSelected(next.id);
        // Focus after React commits the new excerpt, including repeated selections.
        requestAnimationFrame(() => heading.current?.focus());
    }
    function clear() { setQuery(''); setSelected(null); search.current?.focus(); }
    if (state !== 'ready') return <p role="status" id="reader-status">{state === 'error'
        ? 'Reading desk unavailable. Use the source blog or terminal links above.'
        : 'Loading recent entries…'}</p>;
    return <>
        <div className="reader-tools">
            <label htmlFor="reader-search">Search recent text
                <input ref={search} id="reader-search" type="search" value={query}
                    placeholder="Title, date, or excerpt" onChange={event => {
                        setQuery(event.target.value); setSelected(null);
                    }} onKeyDown={event => { if (event.key === 'Escape') clear(); }} />
            </label>
            <Action id="reader-clear" onClick={clear}>Clear search</Action>
        </div>
        <p id="reader-count" role="status">{matches.length} of {entries.length} recent entries</p>
        {!entry ? <p id="reader-empty">No matching entries. Try another phrase or clear search.</p> :
            <div className="reader-columns">
                <div aria-label="Recent entries, newest first">
                    <p className="reader-caption">NEWEST FIRST / UTC</p>
                    <LineSidebar key={`${query}:${entry.id}`} showIndex={false} showMarker={false}
                        maxShift={0} scaleTick={false} itemGap={8} fontSize={1}
                        textColor="#c4d4c9" accentColor="#9fe8b5" defaultActive={position}
                        items={matches.map(item => <a id={`reader-${item.id}`} href="#reader-detail"
                            aria-current={item.id === entry.id ? 'true' : undefined}
                            onClick={event => { event.preventDefault(); select(item); }}>
                            <time dateTime={item.date}>{item.date.slice(0, 10)}</time>
                            <span>{item.title || 'Blog entry'}</span></a>)} />
                </div>
                <article id="reader-detail" aria-labelledby="reader-title">
                    <p className="reader-caption">EXCERPT / {position + 1} OF {matches.length}</p>
                    <h2 id="reader-title" tabIndex={-1} ref={heading}>{entry.title || 'Blog entry'}</h2>
                    <time dateTime={entry.date}>{entry.date.replace('T', ' ').replace('Z', ' UTC')}</time>
                    <p id="reader-text">{entry.text || 'No text excerpt. Open the terminal for media.'}</p>
                    <div className="reader-actions">
                        <Action id="reader-previous" disabled={position === 0}
                            onClick={() => select(matches[position - 1])}>Previous entry</Action>
                        <Action id="reader-next" disabled={position === matches.length - 1}
                            onClick={() => select(matches[position + 1])}>Next entry</Action>
                    </div>
                    <p className="reader-note">Text excerpt only. Complete text and media: return to the terminal and run <code>cat blog.txt</code>.</p>
                </article>
            </div>}
    </>;
}

const container = document.getElementById('blog-reader');
if (container) createRoot(container).render(<ReadingDesk />);
