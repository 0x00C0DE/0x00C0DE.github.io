// Adapted from React Bits Pixel Transition by David Haz. See LICENSE.react-bits.md.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const WINDOW = 0.35;
const clamp = value => Math.min(1, Math.max(0, value));
const smooth = t => t * t * (3 - 2 * t);

export async function playPixelTransition(canvas, color, swap, signal) {
    const ctx = canvas.getContext('2d');
    if (!ctx || signal.aborted) {
        swap();
        return;
    }

    // Cover both scenes at the midpoint, then clear the same dither pattern.
    let swapped = false;
    let start;
    let cancel;
    await new Promise((resolve, reject) => {
        let raf;
        cancel = () => {
            cancelAnimationFrame(raf);
            resolve();
        };
        signal.addEventListener('abort', cancel, { once: true });

        function frame(now) {
            try {
                start ??= now;
                const progress = clamp((now - start) / 2000);
                const coverage = progress < 0.5 ? progress * 2 : 2 - progress * 2;
                const ratio = Math.min(window.devicePixelRatio || 1, 2);
                const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
                const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
                if (canvas.width !== width) canvas.width = width;
                if (canvas.height !== height) canvas.height = height;
                const size = Math.max(1, Math.round(width / 28));
                ctx.clearRect(0, 0, width, height);
                ctx.fillStyle = color;
                for (let y = 0, row = 0; y < height; y += size, row++) {
                    for (let x = 0, col = 0; x < width; x += size, col++) {
                        const delay = BAYER[(row & 3) * 4 + (col & 3)] / 16;
                        ctx.globalAlpha = smooth(clamp((coverage - delay * (1 - WINDOW)) / WINDOW));
                        ctx.fillRect(x, y, size, size);
                    }
                }
                if (!swapped && progress >= 0.5) {
                    ctx.globalAlpha = 1;
                    ctx.fillRect(0, 0, width, height);
                    swapped = true;
                    swap();
                }
                if (progress < 1) raf = requestAnimationFrame(frame);
                else resolve();
            } catch (error) {
                reject(error);
            }
        }

        raf = requestAnimationFrame(frame);
    }).finally(() => signal.removeEventListener('abort', cancel));
}
