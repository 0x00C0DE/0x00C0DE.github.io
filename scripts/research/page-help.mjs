const builtInPages = new Set(['bitcoin.html', 'pretext-lab.html', 'projects.html', 'resume-intro.html']);

export function terminalPageFiles(entries) {
    return entries.filter(entry => entry.isFile() && /^[a-z0-9-]+\.html$/.test(entry.name)
        && !builtInPages.has(entry.name))
        .map(entry => entry.name)
        .sort();
}
