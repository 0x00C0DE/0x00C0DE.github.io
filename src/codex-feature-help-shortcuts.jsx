import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import SpecularButton from 'react-bits:SpecularButton';
import GradientText from 'react-bits:GradientText';
import './codex-feature-help-shortcuts.css';
import { HELP_SHORTCUTS, prepareHelpCommand } from './terminal-help-shortcuts.mjs';

function HelpShortcuts({ prepare }) {
    const [prepared, setPrepared] = useState('');
    return <div aria-label="Help shortcuts">
        <div className="help-shortcuts-actions">
            {HELP_SHORTCUTS.map(([label, command], index) =>
                <SpecularButton key={command} id={`help-shortcut-${index}`} size="sm"
                    radius={4} followMouse={false} autoAnimate={false}
                    textColor="#fff1f1" baseColor="#ff6b78"
                    onClick={() => {
                        prepareHelpCommand(command, prepare);
                        setPrepared(command);
                    }}>
                    {label} <GradientText colors={['#fff1f1', '#ff8585']}
                        followPointer={false} animationSpeed={12}>{command}</GradientText>
                </SpecularButton>)}
        </div>
        <div id="help-shortcuts-status" role="status">
            {prepared ? `Prepared: ${prepared} — press Enter to run` : 'Tab from an empty prompt to choose a task; Enter runs it.'}
        </div>
    </div>;
}

export function mountHelpShortcuts(host, prepare) {
    const root = createRoot(host);
    root.render(<HelpShortcuts prepare={prepare} />);
    return () => root.unmount();
}
