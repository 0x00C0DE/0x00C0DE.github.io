import { enablePullToRefresh } from './pull-to-refresh.mjs?v=pull-motion';

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

    dialog.querySelector('button').addEventListener('click', enterTerminal);
    dialog.addEventListener('cancel', event => event.preventDefault());
    enablePullToRefresh(dialog, () => !leaving, dialog);
    // The terminal listens for keyboard input on window.
    dialog.addEventListener('keydown', event => event.stopPropagation());
    dialog.showModal();
    const chromeTint = getComputedStyle(dialog).getPropertyValue('--intro-chrome').trim();

    if (!motion.matches && navigator.gpu) {
        import('../vendor/aero-shards/aero-shards.mjs').then(({ mountAeroShards }) => {
            if (leaving || motion.matches) return;
            stopAnimations.push(mountAeroShards(art, {
                material: 'chrome',
                shardColor: chromeTint,
                accentColor: chromeTint,
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
        import('../vendor/aero-shards/laser-flow.mjs?v=chrome-beam').then(({ mountLaserFlow }) => {
            if (leaving || motion.matches) return;
            const stop = mountLaserFlow(art, {
                color: chromeTint,
                chrome: true,
                beamPosition: 0.7,
                intensity: 0.75,
                speed: 0.65,
                dpr: 1
            });
            if (stop) stopAnimations.push(stop);
        }).catch(error => console.warn('Laser Flow could not load:', error));

        import('../vendor/aero-shards/star-border.mjs').then(({ mountStarBorder }) => {
            if (leaving || motion.matches) return;
            for (const element of dialog.querySelectorAll('.intro-star-border')) {
                const stop = mountStarBorder(element, { color: chromeTint, duration: 5 });
                if (stop) stopAnimations.push(stop);
            }
        }).catch(error => console.warn('Star Border could not load:', error));

        import('../vendor/aero-shards/metallic-paint.mjs').then(({ mountMetallicPaint }) => {
            if (leaving || motion.matches) return;
            for (const label of dialog.querySelectorAll('.intro-metallic-label')) {
                const stop = mountMetallicPaint(label, {
                    text: label.textContent.trim(),
                    fontFamily: '"Courier New", monospace',
                    fontWeight: 700,
                    color: chromeTint,
                    scale: 0.95,
                    speed: 0.55,
                    dispersion: 0.12,
                    intro: false,
                    dpr: 1.5,
                    onReady: () => label.classList.add('has-metallic-paint')
                });
                if (stop) stopAnimations.push(stop);
            }
        }).catch(error => console.warn('Metallic Paint could not load:', error));
    }
}

if (window.top === window && !new URLSearchParams(location.search).has('command') && !location.hash &&
    typeof dialog?.showModal === 'function') {
    showIntro();
}
