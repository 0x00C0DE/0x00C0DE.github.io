export function prepareEntries(rows) {
    return rows.filter(row => Number.isFinite(Date.parse(row.date)))
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 20)
        .map((row, index) => ({ ...row, id: `entry-${index}`, text: String(row.text ?? '').slice(0, 2000) }));
}

export function searchEntries(entries, query) {
    const needle = query.toLowerCase();
    return entries.filter(entry => `${entry.title}\n${entry.text}\n${entry.date}`.toLowerCase().includes(needle));
}

export function parseFeed(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const ns = 'http://www.w3.org/2005/Atom';
    if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'feed'
        || doc.documentElement.namespaceURI !== ns) throw Error('Invalid Atom feed');
    return [...doc.getElementsByTagNameNS(ns, 'entry')].map(entry => {
        const text = name => entry.getElementsByTagNameNS(ns, name)[0]?.textContent ?? '';
        return { date: text('updated'), title: text('title'), text: text('summary') };
    });
}

export async function loadFeed(fetchFeed = fetch, parse = parseFeed) {
    const response = await fetchFeed('/content/feed.xml', {
        redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error('Feed unavailable');
    return prepareEntries(parse(await response.text()));
}
