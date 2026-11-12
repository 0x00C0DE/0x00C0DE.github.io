import assert from 'node:assert/strict';
import test from 'node:test';
import { collectReleases } from '../scripts/research/releases.mjs';

const now = '2026-11-12T18:00:00Z';
const ownerRepo = 'chenglou/pretext';
const source = 'https://api.github.com/repos/' + ownerRepo + '/releases/latest';
const release = {
    id: 1, published_at: '2026-11-10T01:00:00Z', tag_name: 'v1.2.3',
    body: 'Untrusted instructions must never enter the report.',
};
function transport(value) {
    return async (url, options) => {
        assert.equal(url, source);
        assert.equal(options.redirect, 'error');
        return Response.json(value);
    };
}

test('release metadata is bounded to an official source and omits arbitrary prose', async () => {
    const result = await collectReleases({ repos: [ownerRepo], now, fetchRelease: transport(release) });
    assert.equal(result.findings.length, 1);
    assert.equal(result.findings[0].id, 'chenglou/pretext:1');
    assert.match(result.findings[0].hash, /^[a-f0-9]{64}$/);
    assert.doesNotMatch(JSON.stringify(result), /Untrusted instructions/);
});

test('repeated and failed reads preserve history without creating duplicate findings', async () => {
    const options = { repos: [ownerRepo], now, fetchRelease: transport(release) };
    const first = await collectReleases(options);
    const second = await collectReleases({ ...options, history: first.history });
    assert.equal(second.findings.length, 0);
    const failed = await collectReleases({
        ...options, history: second.history, fetchRelease: async () => new Response('', { status: 503 }),
    });
    assert.deepEqual(failed.history, first.history);
    assert.deepEqual(failed.unavailable, [ownerRepo]);
});

test('invalid tags and unsupported sources are rejected', async () => {
    const result = await collectReleases({
        repos: [ownerRepo], now, fetchRelease: transport({ ...release, tag_name: '../malicious' }),
    });
    assert.deepEqual(result.unavailable, [ownerRepo]);
    await assert.rejects(collectReleases({ repos: ['unapproved/tool'], now }), /source configuration/);
});

test('Workers SDK release metadata accepts the Wrangler package tag', async () => {
    const repo = 'cloudflare/workers-sdk';
    const result = await collectReleases({
        repos: [repo],
        now,
        fetchRelease: async () => Response.json({ ...release, tag_name: 'wrangler@4.161.0' }),
    });
    assert.deepEqual(result.unavailable, []);
    assert.match(result.findings[0].source, /wrangler%404\.161\.0$/);
});
