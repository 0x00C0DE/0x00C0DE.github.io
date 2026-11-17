// Measure rendered pixels, independently of React settings and shader uniforms.
export function measureBeam(pixels, opacity) {
    let weight = 0, moment = 0, red = 0, green = 0, blue = 0;
    for (let i = 0; i < pixels.length; i += 4) {
        const energy = pixels[i] + pixels[i + 1] + pixels[i + 2];
        weight += energy;
        moment += energy * (i / pixels.length);
        red += pixels[i]; green += pixels[i + 1]; blue += pixels[i + 2];
    }
    const x = weight ? moment / weight : NaN;
    return {
        position: !weight ? 'blank' : x < .35 ? 'left' : x > .65 ? 'right' : 'center',
        color: red > blue ? 'ember' : green > red ? 'ice' : 'violet',
        brightness: weight * opacity,
        signature: `${opacity}:${pixels.join(',')}`
    };
}

export function identicalFrame(frame, baseline, opacity, baselineOpacity) {
    return opacity === baselineOpacity && frame.length === baseline.length
        && frame.every((byte, index) => byte === baseline[index]);
}

export function observeBeam(scene) {
    const canvas = scene.querySelector('.laser-flow-canvas');
    const gl = canvas?.getContext('webgl2');
    if (!gl) return () => {};
    const draw = gl.drawArrays;
    let baseline, baselinePixels, baselineOpacity;
    // Read immediately after the real upstream draw, before its buffer is discarded.
    gl.drawArrays = function (...args) {
        draw.apply(this, args);
        const frame = new Uint8Array(canvas.width * canvas.height * 4);
        gl.readPixels(0, 0, canvas.width, canvas.height,
            gl.RGBA, gl.UNSIGNED_BYTE, frame);
        const start = Math.floor(canvas.height * .75) * canvas.width * 4;
        const opacity = Number(getComputedStyle(canvas.parentElement.parentElement).opacity);
        const sample = measureBeam(frame.subarray(start, start + canvas.width * 4), opacity);
        if (sample.position === 'blank') return;
        if (!baseline) { baseline = sample; baselinePixels = frame; baselineOpacity = opacity; }
        scene.dataset.pixelPosition = sample.position;
        scene.dataset.pixelColor = sample.color;
        scene.dataset.pixelBrightness = sample.brightness < baseline.brightness * .5 ? 'low'
            : sample.brightness > baseline.brightness * 1.2 ? 'high' : 'default';
        scene.dataset.pixelReset = String(identicalFrame(frame, baselinePixels, opacity, baselineOpacity));
        const program = gl.getParameter(gl.CURRENT_PROGRAM);
        scene.dataset.pixelStill = String(gl.getUniform(program, gl.getUniformLocation(program, 'uTime')) === 0);
    };
    return () => { gl.drawArrays = draw; };
}
