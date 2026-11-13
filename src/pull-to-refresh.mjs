const REFRESH_DISTANCE = 90;

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
    const distance = event => event.clientY - pull.y;
    const isDownward = event => distance(event) > Math.abs(event.clientX - pull.x) * 1.5;

    surface.addEventListener('pointerdown', event => {
        if (event.pointerType !== 'touch') return;
        reset();
        if (event.isPrimary && canStart(event)) {
            pull = { id: event.pointerId, x: event.clientX, y: event.clientY };
        }
    });
    surface.addEventListener('pointermove', event => {
        if (pull?.id !== event.pointerId) return;
        indicator.hidden = distance(event) < 20 || !isDownward(event);
        indicator.textContent = distance(event) >= REFRESH_DISTANCE ? 'Release to refresh' : 'Pull to refresh';
    });
    surface.addEventListener('pointerup', event => {
        if (pull?.id !== event.pointerId) return;
        const refresh = isDownward(event) && distance(event) >= REFRESH_DISTANCE;
        reset();
        if (refresh) location.reload();
    });
    surface.addEventListener('pointercancel', reset);
    surface.addEventListener('lostpointercapture', reset);
}
