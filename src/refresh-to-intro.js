if (window.top === window &&
    performance.getEntriesByType('navigation')[0]?.type === 'reload' &&
    (location.pathname !== '/' || location.search || location.hash)) {
    location.replace('/');
}
