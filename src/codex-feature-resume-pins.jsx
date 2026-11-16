import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import SpecularButton from 'react-bits:SpecularButton';
import SpotlightCard from 'react-bits:SpotlightCard';
import { keepPassage, passageKey, passageContext } from './codex-feature-resume-pins-model.mjs';
import './codex-feature-resume-pins-style.css';

function PinButton(props) {
    return <SpecularButton size="sm" radius={3} textColor="#d9e4da" lineColor="#8fe388"
        baseColor="#7e9b82" followMouse={false} autoAnimate={false} {...props} />;
}

function ResumePins() {
    const [selected, setSelected] = useState(null);
    const [pins, setPins] = useState([]);
    const [feedback, setFeedback] = useState('Select a search result, then keep its passage here.');
    const container = useRef(null);
    const focusAfterRemoval = useRef(false);
    useEffect(() => {
        const onSelection = event => setSelected(event.detail);
        window.addEventListener('resume-reader-selection', onSelection);
        return () => window.removeEventListener('resume-reader-selection', onSelection);
    }, []);
    useLayoutEffect(() => {
        if (!focusAfterRemoval.current) return;
        focusAfterRemoval.current = false;
        const target = container.current.querySelector('[data-remove]')
            ?? container.current.querySelector('#resume-pins-heading');
        target.focus();
    }, [pins]);
    const alreadyKept = selected && pins.some(pin => passageKey(pin) === passageKey(selected));
    return <section ref={container} aria-labelledby="resume-pins-heading">
        <h2 id="resume-pins-heading" tabIndex={-1}>Kept passages · {pins.length}/2</h2>
        <PinButton id="resume-pins-keep" disabled={!selected} onClick={() => {
            setPins(keepPassage(pins, selected));
            setFeedback(alreadyKept ? 'This passage is already kept.' : pins.length === 2
                ? 'Two passages kept. Remove one to keep another.' : 'Passage kept. Search for another term.');
        }}>Keep passage</PinButton>
        <p id="resume-pins-status" role="status">{feedback}</p>
        <div className="resume-pins-grid">
            {pins.map((pin, index) => <SpotlightCard key={passageKey(pin)}
                id={`resume-pin-${index}`} className="resume-pin" intensity={0.06}
                spotlightColor="#8fe388" smoothing={0} flare={false}>
                <h3>Page {pin.page.number} · lines {pin.from + 1}–{pin.to + 1}</h3>
                <blockquote>{passageContext(pin)}</blockquote>
                <a id={`resume-pin-source-${index}`} href={`/assets/resume.pdf#page=${pin.page.number}`}>
                    Read passage in source PDF ↗</a>
                <PinButton id={`resume-pin-remove-${index}`} data-remove="true"
                    aria-label={`Remove kept passage ${index + 1}`} onClick={() => {
                        focusAfterRemoval.current = true;
                        setPins(pins.filter(item => passageKey(item) !== passageKey(pin)));
                        setFeedback(pins.length > 1 ? 'Passage removed. The other passage remains.' : 'Passage removed. No kept passages.');
                    }}>Remove passage</PinButton>
            </SpotlightCard>)}
        </div>
    </section>;
}

createRoot(document.getElementById('resume-pins')).render(<ResumePins />);
