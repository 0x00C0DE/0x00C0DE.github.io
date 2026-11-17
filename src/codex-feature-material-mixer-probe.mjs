export function equalPixels(a, b) {
    return !!b && a.length === b.length && a.every((byte, i) => byte === b[i]);
}

// Observe upstream draws; never set uniforms, remount, or drive the graphics.
export function observeMaterials(scene) {
    const cleanups = [];
    const ready = new Set();
    const fallback = document.getElementById('mixer-fallback');
    for (const [name, selector] of [['chrome', '.liquid-chrome__canvas'], ['silk', '.silk-canvas']]) {
        const canvas = scene.querySelector(selector);
        const gl = canvas?.getContext('webgl2');
        if (!gl) continue;
        const draw = gl.drawArrays;
        let baseline;
        gl.drawArrays = function (...args) {
            draw.apply(this, args);
            if (gl.getParameter(gl.FRAMEBUFFER_BINDING)) return;
            const pixels = new Uint8Array(canvas.width * canvas.height * 4);
            gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            // Require tonal variation, not a transparent or uniform cleared buffer.
            let min = 255, max = 0;
            for (let i = 0; i < pixels.length; i += 4) {
                min = Math.min(min, pixels[i]); max = Math.max(max, pixels[i]);
            }
            if (max - min < 12) return;
            if (!baseline) baseline = pixels.slice();
            ready.add(name);
            scene.dataset[`${name}Pixels`] = equalPixels(pixels, baseline) ? 'initial' : 'changed';
            scene.dataset.graphics = ready.size === 2 ? 'ready' : 'partial';
        };
        const lost = () => {
            ready.delete(name);
            canvas.hidden = true;
            scene.dataset.graphics = 'fallback';
            fallback.hidden = false;
        };
        canvas.addEventListener('webglcontextlost', lost);
        cleanups.push(() => {
            gl.drawArrays = draw;
            canvas.removeEventListener('webglcontextlost', lost);
        });
    }
    // Upstream initialization schedules its first draw before the next frames.
    let frame, attempts = 0;
    const check = () => {
        if (++attempts < 60 && ready.size < 2) { frame = requestAnimationFrame(check); return; }
        if (ready.size < 2) {
            scene.dataset.graphics = 'fallback';
            fallback.hidden = false;
            for (const [name, selector] of [['chrome', '.liquid-chrome__canvas'], ['silk', '.silk-canvas']]) {
                if (!ready.has(name)) scene.querySelector(selector).hidden = true;
            }
        }
    };
    frame = requestAnimationFrame(check);
    return () => { cancelAnimationFrame(frame); cleanups.forEach(cleanup => cleanup()); };
}
