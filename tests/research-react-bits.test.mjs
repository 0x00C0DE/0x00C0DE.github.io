import assert from 'node:assert/strict';
import test from 'node:test';
import { collectReactBits, verifyReactBits } from '../scripts/research/react-bits.mjs';
import { componentFiles } from '../scripts/research/react-bits-build.mjs';

test('accepts original JSX and CSS only for matching dependency-free registry items', () => {
    const item = { name: 'Dock-JS-CSS', dependencies: [], registryDependencies: [],
        files: [{ path: 'Dock.jsx', content: 'export default function Dock() {}' },
            { path: 'Dock.css', content: '.dock {}' }] };
    assert.deepEqual(componentFiles('Dock', item), item.files);
    assert.throws(() => componentFiles('Dock', { ...item, dependencies: ['gsap'] }), /dependencies/);
    assert.throws(() => componentFiles('Dock', { ...item, files: [{ path: '../Dock.jsx', content: 'x' }] }), /files/);
});

test('collects visual components once per design and excludes audio entries', async () => {
    const items = ['Dock-JS-CSS', 'Dock-TS-TW', 'SpotlightCard-TS-CSS', 'SoundChime-TS'].map(name => ({
        name, type: 'registry:component', description: 'Visual pattern', files: [{ content: 'ignored' }],
    }));
    const catalog = await collectReactBits(async () => Response.json({ items }));
    assert.deepEqual(catalog, [
        { id: 'Dock', description: 'Visual pattern', direct: true },
        { id: 'SpotlightCard', description: 'Visual pattern' },
    ]);
});

test('requires full catalog coverage and verifies each combination', () => {
    const catalog = [{ id: 'Dock', direct: true }, { id: 'SpotlightCard', direct: true }];
    const evaluation = {
        reactBitsReviewed: ['Dock', 'SpotlightCard'],
        features: [{ repository: 'DavidHDev/react-bits', reactBitsComponents: ['Dock', 'SpotlightCard'] }],
    };
    assert.doesNotThrow(() => verifyReactBits(catalog, evaluation));
    assert.throws(() => verifyReactBits(catalog, { ...evaluation, reactBitsReviewed: ['Dock', 'Dock'] }), /coverage/);
    assert.throws(() => verifyReactBits(catalog, { ...evaluation,
        features: [{ repository: 'DavidHDev/react-bits', reactBitsComponents: ['Dock', 'ProCard'] }],
    }), /combination/);
    assert.throws(() => verifyReactBits(catalog, { ...evaluation,
        features: [{ repository: 'DavidHDev/react-bits', reactBitsComponents: ['Dock'] }],
    }), /combination/);
});
