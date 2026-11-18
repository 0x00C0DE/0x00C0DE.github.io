export const EXAMPLE_COMMANDS = Object.freeze(['ls', 'cat blog.txt', 'history']);
export function stageExample(state, command, refresh) {
    if (state.inputValue !== '' || !EXAMPLE_COMMANDS.includes(command)) return false;
    state.inputValue = command;
    refresh();
    return true;
}
export function bindExampleEvents(host, adapter) {
    let touchY = null;
    const handlers = {
        keydown(event) {
            event.stopPropagation();
            if (event.key === 'Escape') { event.preventDefault(); adapter.focus(); }
        },
        paste: event => event.stopPropagation(),
        wheel: event => adapter.wheel(event),
        touchstart(event) { touchY = event.touches.length === 1 ? event.touches[0].clientY : null; },
        touchmove(event) {
            if (touchY === null || event.touches.length !== 1) return;
            const next = event.touches[0].clientY;
            adapter.scroll(touchY - next);
            touchY = next;
            event.preventDefault();
        },
        touchend() { touchY = null; },
        touchcancel() { touchY = null; }
    };
    for (const [name, handler] of Object.entries(handlers)) host.addEventListener(name, handler, { passive: false });
    return () => {
        for (const [name, handler] of Object.entries(handlers)) host.removeEventListener(name, handler);
    };
}
