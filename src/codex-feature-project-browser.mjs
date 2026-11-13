const browser = document.querySelector('.project-browser');

if (browser) {
    browser.addEventListener('keydown', event => event.stopPropagation());

    window.addEventListener('keydown', event => {
        if (event.key !== 'Tab' || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey
            || browser.contains(event.target)) return;
        const target = event.target;
        const terminalInput = document.querySelector('textarea[aria-label="Terminal input"]');
        if (terminalInput?.value || (target !== terminalInput
            && target !== document.body && target !== document.documentElement)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        browser.querySelector('summary').focus();
    }, { capture: true });
}
