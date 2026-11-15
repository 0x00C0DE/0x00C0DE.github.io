import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverTrending as discover } from '../scripts/research/trending.mjs';

const discoverTrending = fetchPage => discover(fetchPage, []);

const row = (repo, text) => '<article class="Box-row"><h2><a href="/' + repo + '">Repo</a></h2><p>' + text + '</p></article>';
test('adds design references without inventing Trending ranks or refetching overlapping READMEs', async () => {
    const calls = [];
    const result = await discover(async url => {
        if (url.hostname === 'github.com') return new Response(row('DavidHDev/react-bits', 'Components'));
        calls.push(url.pathname);
        return new Response('# Interaction examples');
    });
    const reactBits = result.repositories.find(repo => repo.name === 'DavidHDev/react-bits');
    assert.equal(reactBits.designReference, true);
    assert.deepEqual(reactBits.ranks, { daily: 1, weekly: 1, monthly: 1 });
    const other = result.repositories.find(repo => repo.name === 'codse/animata');
    assert.equal(other.designReference, true);
    assert.deepEqual(other.ranks, {});
    assert.equal(calls.filter(path => path.includes('react-bits')).length, 1);
});
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
        '/example/missing/HEAD/readme.md',
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

test('collects design evidence from a lowercase README', async () => {
    const result = await discover(async url => {
        if (url.hostname === 'github.com') return new Response(row('example/tool', 'Generic tool'));
        return url.pathname === '/argyleink/open-props/HEAD/readme.md'
            ? new Response('# Adaptive design') : new Response(null, { status: 404 });
    });
    assert.deepEqual(result.repositories.find(repo => repo.name === 'argyleink/open-props').readme,
        { status: 'available', text: '# Adaptive design' });
});

test('caps oversized README text and records truncation', async () => {
    const result = await discoverTrending(async url => url.hostname === 'github.com'
        ? new Response(row('example/large', 'Generic tool'))
        : new Response('x'.repeat(32_001)));
    assert.deepEqual(result.repositories[0].readme, { status: 'truncated', text: 'x'.repeat(32_000) });
});
