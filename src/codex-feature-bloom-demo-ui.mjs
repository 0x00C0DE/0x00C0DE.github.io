import { createBloom } from './codex-feature-bloom-demo-model.mjs';

const panel = document.querySelector('#bloom-demo');
const model = createBloom();
const find = id => panel.querySelector('#bloom-' + id);
let last = null;

function render(message) {
    const set = model.bits();
    find('samples').textContent = 'Inserted: ' + (model.words().join(', ') || 'none') + '.';
    find('bits-text').textContent = `${model.size()} bits. Set positions (zero-based): ${set.join(', ') || 'none'}.`;
    find('grid').replaceChildren(...Array.from({ length: model.size() }, (_, index) => {
        const cell = document.createElement('span');
        cell.textContent = `${index}: ${set.includes(index) ? 1 : 0}`;
        cell.classList.toggle('affected', Boolean(last?.hashes.includes(index)));
        return cell;
    }));
    find('input-step').textContent = last ? `${last.word} → lowercase letters` : 'Choose a public sample or enter a word.';
    find('hash-step').textContent = last ? `Sum of letter codes % ${model.size()} → ${last.hashes[0]}; position-weighted sum % ${model.size()} → ${last.hashes[1]}.` : 'Two toy hashes map letters to bit positions.';
    find('decision-step').textContent = last ? last.decision + (last.inserted
        ? ' — inserted sample; both positions are set.'
        : last.decision === 'Probably present'
            ? ' — false positive: this word was never inserted, but both positions are set.'
            : ' — at least one position is unset.') : 'An unset position proves absence. Set positions cannot prove membership.';
    find('status').textContent = message;
    find('false-positive').hidden = !(last && !last.inserted && last.decision === 'Probably present');
}

function run(word, insert) {
    try {
        if (insert) model.insert(word);
        last = model.query(word);
        render(insert ? `Inserted ${last.word}.` : `Tested ${last.word}: ${last.decision}.`);
    } catch (error) { find('status').textContent = error.message; }
}

find('form').addEventListener('submit', event => {
    event.preventDefault();
    run(find('word').value, event.submitter?.id === 'bloom-insert');
});
for (const button of panel.querySelectorAll('[data-sample]')) {
    button.addEventListener('click', () => run(button.dataset.sample, true));
}
find('collision').addEventListener('click', () => { find('word').value = 'god'; run('god', false); });
find('size').addEventListener('change', () => {
    try {
        model.resize(Number(find('size').value));
        if (last) last = model.query(last.word);
        render('Rebuilt from inserted samples using ' + model.size() + ' bits.');
    } catch (error) {
        find('size').value = model.size();
        find('status').textContent = error.message;
    }
});
find('reset').addEventListener('click', () => {
    model.reset(); last = null;
    find('size').value = 8; find('word').value = 'god';
    render('Reset to an empty eight-bit filter.');
});
find('controls').hidden = false;
render('Ready. Insert cat and dog, then test god.');
