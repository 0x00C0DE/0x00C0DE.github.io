import { enablePullToRefresh, usesNativeChromeRefresh } from './pull-to-refresh.mjs?v=native-ios';

const dialog = document.querySelector('#home-intro');
const motion = matchMedia('(prefers-reduced-motion: reduce)');

function showIntro() {
    let leaving = false;
    const stopAnimations = [];
    const art = dialog.querySelector('.home-intro-art');

    async function enterTerminal() {
        if (leaving) return;
        leaving = true;
        const abort = new AbortController();
        const checkVisibility = () => {
            if (document.hidden) abort.abort();
        };
        const revealTerminal = () => {
            stopAnimations.splice(0).forEach(stop => stop());
            dialog.dataset.entryPhase = 'reveal';
        };
        document.addEventListener('visibilitychange', checkVisibility);
        const reduceMotion = event => {
            if (event.matches) abort.abort();
        };
        motion.addEventListener('change', reduceMotion);
        if (!motion.matches && typeof dialog.animate === 'function') {
            const pixels = document.createElement('canvas');
            pixels.className = 'home-intro-pixels';
            pixels.setAttribute('aria-hidden', 'true');
            const tint = document.createElement('div');
            tint.className = 'home-intro-tint';
            tint.setAttribute('aria-hidden', 'true');
            const red = getComputedStyle(dialog).getPropertyValue('--intro-terminal-red').trim();
            try {
                dialog.dataset.entryPhase = 'tint';
                dialog.append(tint);
                const tintAnimation = tint.animate(
                    [{ opacity: 0 }, { opacity: 1 }],
                    { duration: 900, easing: 'ease-in-out', fill: 'forwards' }
                );
                abort.signal.addEventListener('abort', () => tintAnimation.cancel(), { once: true });
                checkVisibility();
                await tintAnimation.finished;
                if (!abort.signal.aborted && !motion.matches) {
                    dialog.dataset.entryPhase = 'hold';
                    const holdAnimation = tint.animate([{ opacity: 1 }, { opacity: 1 }], 2000);
                    abort.signal.addEventListener('abort', () => holdAnimation.cancel(), { once: true });
                    await holdAnimation.finished;
                }
                if (!abort.signal.aborted && !motion.matches) {
                    const { playPixelTransition } = await import('../vendor/aero-shards/pixel-transition.mjs?v=slower-entry');
                    if (!abort.signal.aborted) {
                        dialog.dataset.entryPhase = 'pixels';
                        dialog.append(pixels);
                        await playPixelTransition(pixels, red, revealTerminal, abort.signal);
                    }
                }
            } catch (error) {
                if (!abort.signal.aborted) console.warn('Terminal entry transition interrupted:', error);
            } finally {
                pixels.remove();
                tint.remove();
            }
        }
        document.removeEventListener('visibilitychange', checkVisibility);
        motion.removeEventListener('change', reduceMotion);
        revealTerminal();
        dialog.close();
        const terminal = document.querySelector('#terminal-canvas');
        terminal.tabIndex = -1;
        terminal.focus({ preventScroll: true });
    }

    dialog.querySelector('button').addEventListener('click', enterTerminal);
    dialog.addEventListener('cancel', event => event.preventDefault());
    if (usesNativeChromeRefresh()) {
        dialog.style.touchAction = 'auto';
    } else {
        enablePullToRefresh(dialog, () => !leaving, dialog);
    }
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
        import('../vendor/aero-shards/laser-flow.mjs?v=original-beam').then(({ mountLaserFlow }) => {
            if (leaving || motion.matches) return;
            const stop = mountLaserFlow(art, {
                color: chromeTint,
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
