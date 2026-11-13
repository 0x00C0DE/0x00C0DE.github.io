const REFRESH_DISTANCE = 72;

export function enablePullToRefresh(surface, canStart, indicatorParent = surface.parentElement) {
    const indicator = document.createElement('div');
    indicator.className = 'pull-to-refresh';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.hidden = true;
    indicator.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6"/></svg><span>Reload</span>';
    indicatorParent.append(indicator);
    surface.classList.add('refresh-surface');
    let pull;

    const reset = () => {
        pull = undefined;
        indicator.hidden = true;
        surface.classList.remove('refresh-dragging');
        surface.style.removeProperty('--refresh-offset');
    };
    const distance = touch => touch.clientY - pull.y;
    const isDownward = touch => distance(touch) > Math.abs(touch.clientX - pull.x) * 1.5;

    surface.addEventListener('touchstart', event => {
        reset();
        const touch = event.touches[0];
        if (event.touches.length === 1 && canStart(touch)) {
            pull = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
        }
    }, { passive: true });
    surface.addEventListener('touchmove', event => {
        const touch = event.touches[0];
        if (!pull || event.touches.length !== 1 || touch.identifier !== pull.id) return;
        const down = isDownward(touch) ? Math.max(0, distance(touch) - 8) : 0;
        if (down && event.cancelable) event.preventDefault();
        surface.classList.toggle('refresh-dragging', down > 0);
        const offset = 128 * (1 - Math.exp(-down / 82));
        surface.style.setProperty('--refresh-offset', `${offset}px`);
        indicator.hidden = down === 0;
        indicator.classList.toggle('refresh-ready', distance(touch) >= REFRESH_DISTANCE && down > 0);
        indicator.style.setProperty('--refresh-progress', Math.min(1, down / (REFRESH_DISTANCE - 8)));
        if (down > 0) pull.moved = true;
    }, { passive: false });
    surface.addEventListener('touchend', event => {
        const touch = event.changedTouches[0];
        if (!pull || touch?.identifier !== pull.id) return;
        const { moved } = pull;
        const refresh = moved && isDownward(touch) && distance(touch) >= REFRESH_DISTANCE;
        reset();
        if (moved && event.cancelable) event.preventDefault();
        if (!refresh) return;
        if (location.pathname === '/' && !location.search && !location.hash) location.reload();
        else location.replace('/');
    }, { passive: false });
    surface.addEventListener('touchcancel', reset);
}
