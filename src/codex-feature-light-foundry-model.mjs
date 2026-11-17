export const palettes = Object.freeze({ violet: '#9a8cff', ember: '#ff9566', ice: '#71e4dc' });
export const defaults = Object.freeze({ position: 50, intensity: 70, palette: 'violet' });

export function compose({ position, intensity, palette }) {
    if (!Number.isFinite(position) || position < 0 || position > 100 ||
        !Number.isFinite(intensity) || intensity < 20 || intensity > 100 ||
        !Object.hasOwn(palettes, palette)) throw new RangeError('Invalid light composition');
    return { beamPosition: position / 100, brightness: intensity / 100,
        color: palettes[palette], label: `${palette} / position ${position}% / intensity ${intensity}%` };
}
