import { feedback } from './codex-feature-practice-model.mjs';

for (const card of document.querySelectorAll('[data-practice]')) {
    const form = card.querySelector('form');
    const evidence = card.querySelector('details');
    const status = card.querySelector('[role="status"]');
    const retry = card.querySelector('[data-retry]');
    const reveal = card.querySelector('[type="submit"]');
    const stages = card.querySelectorAll('[data-practice-step]');
    function stage(index) {
        stages.forEach((item, i) => {
            if (i === index) item.setAttribute('aria-current', 'step');
            else item.removeAttribute('aria-current');
        });
    }
    evidence.hidden = true;
    form.hidden = false;
    card.querySelector('[data-progress]').hidden = false;
    stage(0);
    form.addEventListener('submit', (event) => {
        event.preventDefault();
        const choice = form.querySelector('input:checked');
        if (!choice) return;
        status.textContent = feedback(card.dataset.practice, choice.value);
        evidence.hidden = false;
        evidence.open = true;
        form.querySelector('fieldset').disabled = true;
        reveal.hidden = true;
        retry.hidden = false;
        stage(1);
        retry.focus();
    });
    retry.addEventListener('click', () => {
        form.reset();
        form.querySelector('fieldset').disabled = false;
        evidence.hidden = true;
        evidence.open = false;
        reveal.hidden = false;
        retry.hidden = true;
        status.textContent = 'Try again: same question, fresh prediction.';
        stage(2);
        form.querySelector('input').focus();
    });
}
