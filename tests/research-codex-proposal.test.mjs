import test from 'node:test';
import assert from 'node:assert/strict';
import { selectExperiences, selectLead, validateChanges, validateExperience, validateCommandEntry, validateCommandEntryDiff } from '../scripts/research/codex-proposal.mjs';

test('selects existing terminal routes and rejects standalone demos and traversal', () => {
    const help = { route: '/?command=help', changesCommandEntry: false };
    const terminal = { route: '/index.html', changesCommandEntry: false };
    assert.deepEqual(selectExperiences([
        { route: '/pages/light-studio.html' }, { route: '/pages/explore.html' }, help, terminal,
    ], ['index.html', 'pages/explore.html']), [help, terminal]);
    assert.deepEqual(selectExperiences([terminal], []), []);
    for (const route of ['/pages/../index.html', '/?command=help&redirect=evil', '//evil.test']) {
        assert.deepEqual(selectExperiences([{ route }], ['index.html']), []);
    }
});

test('requires actual terminal integration and rejects new HTML pages and demo-only assets', () => {
    const terminal = { path: 'src/terminal-canvas-core.mjs', previousMode: '100644' };
    const asset = { path: 'src/codex-feature-help.jsx', previousMode: '000000' };
    const docs = { path: 'README.md', previousMode: '100644' };
    const route = '/?command=help';
    assert.doesNotThrow(() => validateExperience([terminal, asset, docs], route));
    assert.throws(() => validateExperience([asset, docs], route), /terminal integration/i);
    assert.throws(() => validateExperience([terminal, asset], '/pages/light-studio.html'), /terminal route/i);
    assert.throws(() => validateExperience([terminal, {
        path: 'pages/light-studio.html', previousMode: '000000',
    }], route), /standalone/i);
});

test('only current reports with a relevant lead trigger Codex', () => {
    const lead = { name: 'example/chart', ranks: { daily: 1 }, fit: { surface: 'pages/bitcoin.html' } };
    assert.equal(selectLead({ revision: 'base', trending: { repositories: [lead] } }, 'other'), null);
    assert.equal(selectLead({ revision: 'base', trending: { repositories: [lead] } }, 'base'), lead);
});
test('requires README and tests, and rejects privileged or nonregular paths', () => {
    const good = [
        { path: 'README.md', mode: '100644' },
        { path: 'src/commands.js', mode: '100644' },
        { path: 'tests/codex-feature-chart.test.mjs', mode: '100644' },
    ];
    assert.doesNotThrow(() => validateChanges(good));
    for (const path of ['src/home-intro.css', 'src/home-intro.mjs', 'src/refresh-to-intro.js',
        '.github/workflows/pages.yml', 'worker/src/index.js', 'pages/../index.html']) {
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

test('rejects standalone page files even alongside a terminal edit', () => {
    const changes = ['README.md', 'src/term.js', 'tests/codex-feature-help.test.mjs']
        .map(path => ({ path, mode: '100644', previousMode: '100644' }));
    assert.doesNotThrow(() => validateChanges(changes));
    assert.doesNotThrow(() => validateChanges([...changes, { path: 'index.html', mode: '100644' }]));
    assert.throws(() => validateChanges([...changes, {
        path: 'pages/light-studio.html', mode: '100644', previousMode: '000000',
    }]));
});

test('rejects fresh and cached command preparation proposals while accepting visual help refinements', () => {
    const lettering = { route: '/?command=help', title: 'Readable help lettering',
        brief: 'Apply GradientText to existing section headings.', changesCommandEntry: false };
    assert.doesNotThrow(() => validateCommandEntry(lettering));
    assert.deepEqual(selectExperiences([lettering], ['index.html']), [lettering]);
    for (const feature of [
        { ...lettering, changesCommandEntry: true },
        { ...lettering, changesCommandEntry: undefined },
        { ...lettering, title: 'Help shortcuts that prepare real terminal commands' },
        { ...lettering, brief: 'Activation loads the exact command and focuses Terminal input.' },
        { ...lettering, brief: 'Prefill the prompt using a selected example.' },
        { ...lettering, title: 'Preview and stage a help example before running it' },
    ]) {
        assert.throws(() => validateCommandEntry(feature), /command entry/i);
        assert.deepEqual(selectExperiences([feature], ['index.html']), []);
    }
});

test('release gate rejects new prompt writes but allows existing writes and output-only additions', () => {
    assert.doesNotThrow(() => validateCommandEntryDiff(' app.inputValue = value;\n+ heading.style.color = color;'));
    for (const line of ['+ app.inputValue = command;', '+state.inputValue += value;',
        '+ app["inputValue"] = selected;', '+ Object.assign(app, { inputValue: selected });',
        '+ input.value = "ls";', '+ input.setRangeText(command);']) {
        assert.throws(() => validateCommandEntryDiff(line), /command entry/i);
    }
});
