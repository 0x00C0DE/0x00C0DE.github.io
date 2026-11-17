import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import LiquidChrome from 'react-bits:LiquidChrome';
import Silk from 'react-bits:Silk';
import SpecularButton from 'react-bits:SpecularButton';
import { initial, change } from './codex-feature-material-mixer-model.mjs';
import { observeMaterials } from './codex-feature-material-mixer-probe.mjs';
import './codex-feature-material-mixer-style.css';

function Mixer() {
    const [state, setState] = useState(initial);
    const scene = useRef(null);
    const { boundary, density } = state.current;
    useEffect(() => observeMaterials(scene.current), []);
    const update = (action, value) => setState(previous => change(previous, action, value));
    return <>
        <figure id="mixer-scene" ref={scene} className="mixer-scene"
            data-boundary={boundary} data-density={density}
            style={{ '--seam': `${boundary}%`, '--fold': `${44 / density}px` }}
            aria-label={`${boundary}% silk, ${100 - boundary}% chrome; fold density ${density}`}>
            <div className="mixer-chrome" aria-hidden="true">
                <LiquidChrome speed={0} intro={false} interactive={false} tilt={0}
                    rippleStrength={0} maxDevicePixelRatio={1.5} />
            </div>
            <div className="mixer-silk" aria-hidden="true">
                <Silk speed={0} paused={true} intro={false} mouseInteraction={false}
                    clickRipple={false} dpr={1.5} scale={density} color="#b47c98"
                    sheen={0.7} depth={0.6} glow={0.1} />
            </div>
            <div className="mixer-seam" />
            <figcaption id="mixer-summary">SILK / {boundary} : {100 - boundary} / CHROME</figcaption>
        </figure>
        <section className="mixer-controls" aria-label="Compose materials">
            <div><label htmlFor="mixer-boundary">Silk reveal <output>{boundary}%</output></label>
                <input id="mixer-boundary" type="range" min="25" max="75" value={boundary}
                    onChange={event => update('boundary', Number(event.target.value))} /></div>
            <div><label htmlFor="mixer-density">Fold density <output>{density}</output></label>
                <input id="mixer-density" type="range" min="1" max="3" value={density}
                    onChange={event => update('density', Number(event.target.value))} /></div>
        </section>
        <div className="mixer-actions">
            <SpecularButton id="mixer-undo" radius={4} followMouse={false} autoAnimate={false}
                disabled={!state.history.length} onClick={() => update('undo')}>Undo</SpecularButton>
            <SpecularButton id="mixer-reset" radius={4} followMouse={false} autoAnimate={false}
                onClick={() => update('reset')}>Reset</SpecularButton>
        </div>
        <p id="mixer-status" role="status">{boundary === 50 && density === 1 ? 'Initial composition' : 'Custom composition'}</p>
        <p>Move the seam, then tighten the folds. Arrow keys fine-tune; Home / End reach each limit.</p>
        <p id="mixer-fallback" hidden>Graphics unavailable. The CSS material study responds to the same controls.</p>
    </>;
}

createRoot(document.getElementById('material-mixer-root')).render(<Mixer />);
