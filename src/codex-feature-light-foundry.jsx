import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import LaserFlow from 'react-bits:LaserFlow';
import SpecularButton from 'react-bits:SpecularButton';
import { compose, defaults, palettes } from './codex-feature-light-foundry-model.mjs';
import './codex-feature-light-foundry-style.css';
import { observeBeam } from './codex-feature-light-foundry-probe.mjs';

function Action(props) {
    return <SpecularButton radius={4} autoAnimate={false} followMouse={false}
        textColor="#e3e9e3" lineColor="#9a8cff" {...props} />;
}

function Foundry() {
    const [settings, setSettings] = useState({ ...defaults });
    const [graphics, setGraphics] = useState(false);
    const surface = useRef(null);
    const scene = useRef(null);
    const light = compose(settings);
    useEffect(() => observeBeam(scene.current), []);
    useEffect(() => {
        // Keep the local composition until the upstream shader links successfully.
        let frame;
        let attempts = 0;
        const check = () => {
            const canvas = scene.current?.querySelector('.laser-flow-canvas');
            const gl = canvas?.getContext('webgl2');
            if (gl && !gl.isContextLost()) {
                // LINK_STATUS also detects initialization failures without altering upstream code.
                const program = gl.getParameter(gl.CURRENT_PROGRAM);
                if (program && gl.getProgramParameter(program, gl.LINK_STATUS)) setGraphics(true);
            }
            if (++attempts < 120) frame = requestAnimationFrame(check);
        };
        frame = requestAnimationFrame(check);
        const lost = () => setGraphics(false);
        const canvas = scene.current.querySelector('.laser-flow-canvas');
        canvas?.addEventListener('webglcontextlost', lost);
        return () => { cancelAnimationFrame(frame); canvas?.removeEventListener('webglcontextlost', lost); };
    }, []);
    const update = (key, value) => setSettings(previous => ({ ...previous, [key]: value }));
    const changed = Object.keys(defaults).some(key => settings[key] !== defaults[key]);
    return <>
        <figure ref={scene} id="foundry-scene" className="foundry-scene"
            data-renderer={graphics ? 'laser' : 'local'} aria-label={`Light composition: ${light.label}`}
            style={{ '--beam': `${settings.position}%`, '--light': light.color, '--power': light.brightness }}>
            <div ref={surface} className="foundry-slab" />
            <div className="foundry-fallback" hidden={graphics} aria-hidden="true" />
            <div className="foundry-laser" style={{ opacity: light.brightness }} aria-hidden="true">
                <LaserFlow surfaceRef={surface} beamPosition={light.beamPosition} color={light.color}
                    intensity={1.8} intro={false} paused={true} mouseInteraction={false}
                    speed={0} pulse={0} dpr={1.5} />
            </div>
            <figcaption>01 / <span id="foundry-summary">{light.label}</span></figcaption>
        </figure>
        <section className="foundry-controls" aria-label="Compose the light">
            <div><label htmlFor="foundry-position">Beam position <output>{settings.position}%</output></label>
                <input id="foundry-position" type="range" min="25" max="75" step="1"
                    value={settings.position} onChange={event => update('position', Number(event.target.value))} />
                <label htmlFor="foundry-intensity">Intensity <output>{settings.intensity}%</output></label>
                <input id="foundry-intensity" type="range" min="20" max="100" step="1"
                    value={settings.intensity} onChange={event => update('intensity', Number(event.target.value))} /></div>
            <div><p className="eyebrow">Choose a light</p><div className="foundry-palettes">
                {Object.keys(palettes).map(palette => <Action key={palette} id={`foundry-${palette}`}
                    aria-pressed={settings.palette === palette} onClick={() => update('palette', palette)}>
                    {palette}</Action>)}
            </div><Action id="foundry-reset" onClick={() => setSettings({ ...defaults })}>Reset composition</Action></div>
        </section>
        <p id="foundry-status" role="status">{changed ? 'Custom composition' : 'Default composition'}</p>
        <p className="foundry-note">Slide to place the beam. Use arrow keys for fine control.
            The light stays still so every change is yours.</p>
    </>;
}

createRoot(document.getElementById('light-foundry-root')).render(<Foundry />);
