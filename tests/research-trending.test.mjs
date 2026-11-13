import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverTrending } from '../scripts/research/trending.mjs';

const row = (repo, text) => '<article class="Box-row"><h2><a href="/' + repo + '">Repo</a></h2><p>' + text + '</p></article>';
test('reads each actual Trending window and assigns site-specific use cases', async () => {
    const windows = [];
    const result = await discoverTrending(async url => {
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
