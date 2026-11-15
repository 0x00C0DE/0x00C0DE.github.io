import assert from 'node:assert/strict';
import test from 'node:test';
import { collectReactBits, verifyReactBits } from '../scripts/research/react-bits.mjs';

test('collects visual components once per design and excludes audio entries', async () => {
    const items = ['Dock-JS-CSS', 'Dock-TS-TW', 'SpotlightCard-TS-CSS', 'SoundChime-TS'].map(name => ({
        name, type: 'registry:component', description: 'Visual pattern', files: [{ content: 'ignored' }],
    }));
    const catalog = await collectReactBits(async () => Response.json({ items }));
    assert.deepEqual(catalog, [
        { id: 'Dock', description: 'Visual pattern' },
        { id: 'SpotlightCard', description: 'Visual pattern' },
    ]);
});

test('requires full catalog coverage and verifies each combination', () => {
    const catalog = [{ id: 'Dock' }, { id: 'SpotlightCard' }];
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
