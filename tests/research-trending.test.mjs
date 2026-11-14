import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverTrending } from '../scripts/research/trending.mjs';

const row = (repo, text) => '<article class="Box-row"><h2><a href="/' + repo + '">Repo</a></h2><p>' + text + '</p></article>';
test('reads each actual Trending window and assigns site-specific use cases', async () => {
    const windows = [];
    const result = await discoverTrending(async url => {
        if (url.hostname !== 'github.com') return new Response(null, { status: 404 });
        windows.push(url.searchParams.get('since'));
        return new Response(row('example/charts', 'Interactive chart and data visualization')
            + row('example/other', 'A compiler') + row('example/invalid/extra', 'chart'));
    });
    assert.deepEqual(windows, ['daily', 'weekly', 'monthly']);
    assert.equal(result.repositories.length, 2);
    assert.equal(result.repositories[0].fit.surface, 'pages/bitcoin.html');
    assert.deepEqual(Object.keys(result.repositories[0].ranks), windows);
    assert.equal(result.repositories[1].fit, null);
});

test('isolates fetch failures and reports unrecognized markup', async () => {
    const result = await discoverTrending(async url => {
        switch (url.searchParams.get('since')) {
        case 'daily': return new Response(row('example/a11y', 'Keyboard navigation'));
        case 'weekly': return new Response('', { status: 429 });
        default: return new Response('<html>unexpected markup</html>');
        }
    });
    assert.deepEqual(result.unavailable, ['weekly', 'monthly']);
    assert.equal(result.repositories[0].fit.surface, 'index.html');
});

test('recognizes web platform guidance as a lead for an accessible project index', async () => {
    const result = await discoverTrending(async () => new Response(
        row('GoogleChrome/modern-web-guidance-src', 'Keep your coding agent up to date with the latest web best practices')
        + row('example/generic', 'Keep your coding agent up to date')));
    assert.equal(result.repositories[0].fit?.surface, 'pages/projects.html');
    assert.equal(result.repositories[1].fit, null);
});

test('reads README evidence once per repository across all windows', async () => {
    const calls = [];
    const result = await discoverTrending(async (url, options) => {
        if (url.hostname === 'github.com') {
            return new Response(row('example/guidance', 'Generic tool') + row('example/missing', 'Other tool'));
        }
        calls.push(url.pathname);
        assert.equal(options.redirect, 'error');
        if (url.pathname.includes('/missing/')) return new Response(null, { status: 404 });
        return new Response('# Guidance\n\nVisitors can save chart views.');
    });
    assert.deepEqual(calls.sort(), [
        '/example/guidance/HEAD/README.md',
        '/example/missing/HEAD/.github/README.md',
        '/example/missing/HEAD/README.md',
        '/example/missing/HEAD/docs/README.md',
    ]);
    assert.deepEqual(result.repositories[0].readme, {
        status: 'available', text: '# Guidance\n\nVisitors can save chart views.',
    });
    assert.equal(result.repositories[1].readme.status, 'unavailable');
});

test('checks GitHub README locations when the root README is missing', async () => {
    const result = await discoverTrending(async url => {
        if (url.hostname === 'github.com') return new Response(row('example/nested', 'Generic tool'));
        if (url.pathname.endsWith('/docs/README.md')) return new Response('# Nested README');
        return new Response(null, { status: 404 });
    });
    assert.deepEqual(result.repositories[0].readme, { status: 'available', text: '# Nested README' });
});

test('caps oversized README text and records truncation', async () => {
    const result = await discoverTrending(async url => url.hostname === 'github.com'
        ? new Response(row('example/large', 'Generic tool'))
        : new Response('x'.repeat(32_001)));
    assert.deepEqual(result.repositories[0].readme, { status: 'truncated', text: 'x'.repeat(32_000) });
});
