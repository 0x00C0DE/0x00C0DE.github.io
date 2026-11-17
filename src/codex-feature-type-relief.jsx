import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import DepthText from 'react-bits:DepthText';
import SpecularButton from 'react-bits:SpecularButton';
import { initial, change } from './codex-feature-type-relief-model.mjs';
import './codex-feature-type-relief-style.css';

function TypeRelief() {
    const [state, setState] = useState(initial);
    const { word, depth, outline } = state;
    const update = (action, value) => setState(previous => change(previous, action, value));
    return <>
        <figure id="relief-art" className="relief-art">
            <div id="relief-sculpture" aria-label={`Sculpture: ${word || 'blank'}`}>
                <DepthText text={word || ' '} layers={12} depth={depth} outline={outline}
                    tilt={12} intro={false} autoOrbit={false} pointerTracking={false}
                    float={false} hoverPush={0} faceColor="#d5f9df" depthColor="#389868"
                    fontSize="clamp(2rem, 11vw, 8rem)" />
            </div>
            <figcaption>12 LAYERS <span>/</span> {outline ? 'OUTLINE' : 'SOLID'} <span>/</span> {depth}× DEPTH</figcaption>
        </figure>
        <section className="relief-controls" aria-label="Sculpt your word">
            <div><label htmlFor="relief-word">01 / Lettering</label>
                <input id="relief-word" value={word} maxLength={6} autoComplete="off"
                    spellCheck={false} aria-describedby="relief-hint"
                    onChange={event => update('word', event.target.value)} />
                <small id="relief-hint">Up to 6 letters or digits. Nothing saved.</small></div>
            <div><label htmlFor="relief-depth">02 / Extrusion <output id="relief-depth-value">{depth}×</output></label>
                <input id="relief-depth" type="range" min="1" max="4" step="1" value={depth}
                    onChange={event => update('depth', event.target.value)} />
                <small>Arrow keys adjust. Home / End reach the limits.</small></div>
            <div className="relief-actions" aria-label="Layer finish">
                {['Solid', 'Outline', 'Reset'].map(label => <SpecularButton key={label}
                    id={`relief-${label.toLowerCase()}`} size="sm" radius={3}
                    followMouse={false} autoAnimate={false} textColor="#d5f9df"
                    aria-pressed={label === 'Reset' ? undefined : outline === (label === 'Outline')}
                    onClick={() => label === 'Reset' ? update('reset') : update('outline', label === 'Outline')}>
                    {label}
                </SpecularButton>)}
            </div>
        </section>
        <p id="relief-status" role="status">{word || 'Blank'} · {depth}× depth · {outline ? 'Outline' : 'Solid'}</p>
    </>;
}

createRoot(document.getElementById('type-relief-root')).render(<TypeRelief />);
