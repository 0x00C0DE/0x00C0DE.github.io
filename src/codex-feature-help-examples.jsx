import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import GradientText from 'react-bits:GradientText';
import SpecularButton from 'react-bits:SpecularButton';
import { bindExampleEvents } from './codex-feature-help-examples.mjs';
import './codex-feature-help-examples.css';

// Keep the existing core singleton external to the React bundle.
const coreUrl = new URL('./terminal-canvas-core.mjs?v=editorial-pretext', import.meta.url);
const { registerHelpExamples } = await import(coreUrl.href);

function Examples({ adapter, state }) {
    const [selected, select] = useState('ls');
    const [staged, setStaged] = useState('');
    const draft = state.inputValue !== '';
    const ready = staged && state.inputValue === staged;
    return <section aria-label="Try a help example">
        <label htmlFor="help-example-choice">Try an example</label>
        <select id="help-example-choice" value={selected} onChange={event => {
            select(event.target.value);
            setStaged('');
        }}>
            {adapter.examples.map(example => <option key={example.command} value={example.command}>
                {example.command}
            </option>)}
        </select>
        <div id="help-example-preview"><GradientText colors={['#fff1f1', '#ff8585', '#ffd166']}
            glow={0} followPointer={false}>{selected}</GradientText></div>
        <p id="help-example-description">{adapter.examples.find(item => item.command === selected).description}</p>
        <SpecularButton id="help-example-use" size="sm" radius={4} followMouse={false}
            autoAnimate={false} glow={0} disabled={draft || state.blocked}
            aria-describedby="help-example-status" onClick={() => {
                if (adapter.stage(selected)) setStaged(selected);
            }}>Use command</SpecularButton>
        <p id="help-example-status" role="status">{ready ? `Ready to run: ${state.inputValue}. Press Enter.`
            : draft ? 'Clear your prompt draft before using an example.' : 'Preview only. Shift+Tab from prompt to choose; Escape returns. Enter runs the staged command.'}</p>
    </section>;
}

registerHelpExamples(adapter => {
    const host = document.createElement('div');
    host.id = 'help-examples';
    // Native selection/copy stays local; terminal global handlers must not receive keys or paste.
    const unbind = bindExampleEvents(host, adapter);
    document.body.append(host);
    const root = createRoot(host);
    let previous = '';
    const observer = new ResizeObserver(() => adapter.measure(host.getBoundingClientRect().height));
    observer.observe(host);
    return {
        update(state) {
            host.dataset.history = JSON.stringify(state.history);
            host.hidden = state.blocked;
            host.style.left = `${state.left}px`;
            host.style.top = `${state.top}px`;
            host.style.width = `${state.width}px`;
            const key = JSON.stringify([state.inputValue, state.blocked]);
            if (key !== previous) {
                previous = key;
                root.render(<Examples adapter={adapter} state={state} />);
            }
        },
        dispose() { unbind(); observer.disconnect(); root.unmount(); host.remove(); }
    };
});
