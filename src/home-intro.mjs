const dialog = document.querySelector('#home-intro');
const motion = matchMedia('(prefers-reduced-motion: reduce)');

function showIntro() {
    let leaving = false;
    const stopAnimations = [];
    const art = dialog.querySelector('.home-intro-art');

    async function enterTerminal() {
        if (leaving) return;
        leaving = true;
        if (!motion.matches && typeof dialog.animate === 'function') {
            await dialog.animate(
                [{ opacity: 1 }, { opacity: 0 }],
                { duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)', fill: 'forwards' }
            ).finished.catch(() => {});
        }
        stopAnimations.forEach(stop => stop());
        dialog.close();
        const terminal = document.querySelector('#terminal-canvas');
        terminal.tabIndex = -1;
        terminal.focus({ preventScroll: true });
    }

    dialog.addEventListener('click', enterTerminal);
    dialog.addEventListener('cancel', event => {
        event.preventDefault();
        enterTerminal();
    });
    // The terminal listens for keyboard input on window.
    dialog.addEventListener('keydown', event => event.stopPropagation());
    dialog.showModal();
    const introRed = getComputedStyle(dialog).getPropertyValue('--intro-red').trim();

    if (!motion.matches && navigator.gpu) {
        import('../vendor/aero-shards/aero-shards.mjs').then(({ mountAeroShards }) => {
            if (leaving || motion.matches) return;
            stopAnimations.push(mountAeroShards(art, {
                material: 'chrome',
                shardColor: introRed,
                accentColor: introRed,
                count: 850,
                dpr: 1,
                speed: 0.65,
                depthOfField: 0.35,
                pulseOnClick: false,
                holdToGather: false,
                onError: error => console.warn('Aero Shards could not start:', error)
            }));
        }).catch(error => console.warn('Aero Shards could not load:', error));
    }

    if (!motion.matches) {
        import('../vendor/aero-shards/metallic-paint.mjs').then(({ mountMetallicPaint }) => {
            if (leaving || motion.matches) return;
            const title = dialog.querySelector('h1');
            const stop = mountMetallicPaint(title, {
                text: title.textContent.trim(),
                fontFamily: '"Courier New", monospace',
                fontWeight: 700,
                color: introRed,
                scale: 0.95,
                speed: 0.55,
                dispersion: 0.12,
                intro: false,
                dpr: 1.5,
                onReady: () => title.classList.add('has-metallic-paint')
            });
            if (stop) stopAnimations.push(stop);
        }).catch(error => console.warn('Metallic Paint could not load:', error));
    }
}

if (window.top === window && !new URLSearchParams(location.search).has('command') && !location.hash &&
    typeof dialog?.showModal === 'function') {
    showIntro();
}
