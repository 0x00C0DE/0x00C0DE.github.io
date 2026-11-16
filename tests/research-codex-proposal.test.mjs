import test from 'node:test';
import assert from 'node:assert/strict';
import { selectExperiences, selectLead, validateChanges, validateExperience } from '../scripts/research/codex-proposal.mjs';

test('selects new standalone experience routes and rejects readers and existing pages', () => {
    const experience = { route: '/pages/light-studio.html' };
    const reader = { route: '/pages/archive-reader.html' };
    const explore = { route: '/pages/explore.html' };
    assert.deepEqual(selectExperiences([reader, explore, experience], ['pages/explore.html']), [experience]);
    assert.throws(() => selectExperiences([{ route: '/' }], []), /route/i);
    assert.throws(() => selectExperiences([{ route: '/pages/../admin.html' }], []), /route/i);
});

test('standalone experiences must add the selected page and cannot modify existing assets', () => {
    const page = { path: 'pages/light-studio.html', previousMode: '000000' };
    const asset = { path: 'src/codex-feature-light-studio.jsx', previousMode: '000000' };
    const docs = { path: 'README.md', previousMode: '100644' };
    const route = '/pages/light-studio.html';
    assert.doesNotThrow(() => validateExperience([page, asset, docs], route));
    assert.throws(() => validateExperience([asset, docs], route), /new page/);
    assert.throws(() => validateExperience([page, { ...asset, previousMode: '100644' }], route), /existing/);
    assert.throws(() => validateExperience([page, { ...page, path: 'pages/another.html' }], route), /selected/);
});

test('only current reports with a relevant lead trigger Codex', () => {
    const lead = { name: 'example/chart', ranks: { daily: 1 }, fit: { surface: 'pages/bitcoin.html' } };
    assert.equal(selectLead({ revision: 'base', trending: { repositories: [lead] } }, 'other'), null);
    assert.equal(selectLead({ revision: 'base', trending: { repositories: [lead] } }, 'base'), lead);
});
test('requires README and tests, and rejects privileged or nonregular paths', () => {
    const good = [
        { path: 'README.md', mode: '100644' },
        { path: 'pages/bitcoin.html', mode: '100644' },
        { path: 'tests/codex-feature-chart.test.mjs', mode: '100644' },
    ];
    assert.doesNotThrow(() => validateChanges(good));
    for (const path of ['index.html', 'src/home-intro.css', 'src/home-intro.mjs', 'src/refresh-to-intro.js',
        '.github/workflows/pages.yml', 'src/commands.js', 'worker/src/index.js', 'pages/../index.html']) {
        assert.throws(() => validateChanges([...good, { path, mode: '100644' }]));
    }
    assert.throws(() => validateChanges(good.slice(1)));
    assert.throws(() => validateChanges([...good.slice(0, 2), { ...good[2], mode: '120000' }]));
    const existingPage = { ...good[1], mode: '100755' };
    assert.throws(() => validateChanges([good[0], existingPage, good[2]]));
    assert.doesNotThrow(() => validateChanges([good[0], { ...existingPage, previousMode: '100755' }, good[2]]));
});

test('automated review fails closed unless it explicitly approves with zero findings', async () => {
    const { reviewApproved } = await import('../scripts/research/codex-proposal.mjs');
    assert.equal(reviewApproved('{"decision":"approve","findings":[]}'), true);
    for (const value of ['approve', '{}', '{"decision":"block","findings":[]}',
        '{"decision":"approve","findings":["Regression"]}', '{"decision":"approve","findings":[]} trailing']) {
        assert.equal(reviewApproved(value), false);
    }
});

test('allows native details on all seven project pages in one release', () => {
    const paths = [
        'README.md',
        ...Array.from({ length: 7 }, (_, index) => 'pages/project-' + index + '.html'),
        'src/codex-feature-project-details.css',
        'tests/codex-feature-project-details.test.mjs',
    ];
    const changes = paths.map(path => ({ path, mode: '100644' }));
    assert.doesNotThrow(() => validateChanges(changes));
    assert.throws(() => validateChanges([...changes, { path: 'pages/other.html', mode: '100644' }]));
});
