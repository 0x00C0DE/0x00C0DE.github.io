import React, { useLayoutEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import GradientText from 'react-bits:GradientText';
import StarBorder from 'react-bits:StarBorder';
import './codex-feature-help-labels-style.css';

function Label({ line }) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        ref.current.dataset.ready = 'true';
    }, []);
    const lettering = <GradientText colors={['#fff0d4', '#ffb8cb']} glow={0}
        followPointer={false} showBorder={false} animationSpeed={16}>{line.text}</GradientText>;
    return <React.Fragment><span className="help-label-accessible" role="heading" aria-level="2">{line.text}</span><span aria-hidden="true" ref={ref} data-help-label={line.id} data-help-kind={line.kind} style={{ position: 'absolute',
        left: line.x, top: line.y, width: line.width, height: line.height,
        font: line.font, lineHeight: `${line.height}px` }}>
        {line.kind === 'title' ? <StarBorder as="span" borderColor="#b77888" backgroundColor="#000000"
            radius={2} thickness={1} glow={0} hover="none" clickPulse={false} sparkle={false}>
            {lettering}
        </StarBorder> : <span className="help-section-lettering" style={{ letterSpacing: `${-6 / Math.max(1, line.text.length)}px` }}>{lettering}</span>}
    </span></React.Fragment>;
}

let root;
let host;
let signature = '';
window.terminalHelpAccents = {
    sync(lines) {
        if (!lines.length) { this.clear(); return; }
        if (!root) {
            host = document.createElement('div');
            host.id = 'terminal-help-labels';
            host.setAttribute('aria-label', 'Help section labels');
            document.body.append(host);
            root = createRoot(host, { onUncaughtError: error => {
                console.error('Help labels unavailable; retaining Canvas text', error);
                window.terminalHelpAccents.clear();
            } });
        }
        const next = JSON.stringify(lines);
        if (next === signature) return;
        signature = next;
        root.render(lines.map(line => <Label key={line.id} line={line} />));
    },
    clear() {
        root?.unmount();
        host?.remove();
        root = host = null;
        signature = '';
    }
};
