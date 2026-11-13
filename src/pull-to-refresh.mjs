const REFRESH_DISTANCE = 72;

export function enablePullToRefresh(surface, canStart, indicatorParent = surface.parentElement) {
    const indicator = document.createElement('div');
    indicator.className = 'pull-to-refresh';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.hidden = true;
    indicatorParent.append(indicator);
    let pull;

    const reset = () => {
        pull = undefined;
        indicator.hidden = true;
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
        indicator.hidden = distance(touch) < 12 || !isDownward(touch);
        if (!indicator.hidden && event.cancelable) event.preventDefault();
        indicator.textContent = distance(touch) >= REFRESH_DISTANCE ? 'Release to refresh' : 'Pull to refresh';
    }, { passive: false });
    surface.addEventListener('touchend', event => {
        const touch = event.changedTouches[0];
        if (!pull || touch?.identifier !== pull.id) return;
        const refresh = isDownward(touch) && distance(touch) >= REFRESH_DISTANCE;
        reset();
        if (!refresh) return;
        if (event.cancelable) event.preventDefault();
        if (location.pathname === '/' && !location.search && !location.hash) location.reload();
        else location.replace('/');
    }, { passive: false });
    surface.addEventListener('touchcancel', reset);
}
