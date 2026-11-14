export async function copyProjectCommand(input, status, clipboard) {
    try {
        if (!clipboard?.writeText) throw new Error('Clipboard unavailable');
        await clipboard.writeText(input.value);
        status.textContent = 'Command copied.';
    } catch {
        input.focus();
        input.select();
        status.textContent = 'Copy unavailable. Command selected; copy it manually.';
    }
}

if (typeof document !== 'undefined') {
    // Reuse the navigator's keyboard bridge and terminal-themed disclosure styles.
    await import('./codex-feature-project-browser.mjs');
    const details = document.querySelector('#project-details');
    if (details) {
        details.addEventListener('paste', event => event.stopPropagation());
        const button = details.querySelector('#project-copy');
        const input = details.querySelector('#project-command');
        const status = details.querySelector('#project-copy-status');
        button.hidden = false;
        button.addEventListener('click', () => copyProjectCommand(input, status, navigator.clipboard));
    }
}
