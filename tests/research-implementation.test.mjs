import assert from 'node:assert/strict';
import test from 'node:test';
import { activateFeed, renderFeed } from '../scripts/research/blog-feed.mjs';

test('activation is limited to the discovered candidate and is idempotent', () => {
    const html = '<html><head></head></html>';
    const report = { revision: 'base', featureCandidates: [{ id: 'public-blog-feed' }] };
    assert.equal(activateFeed(html, { ...report, revision: 'stale' }, 'base'), html);
    assert.equal(activateFeed(html, { ...report, featureCandidates: [] }, 'base'), html);
    const next = activateFeed(html, report, 'base');
    assert.match(next, /href="\/content\/feed\.xml"/);
    assert.equal(activateFeed(next, report, 'base'), next);
});

test('feed excludes attachment records and encodes public text as XML', async () => {
    const feed = await renderFeed([
        'Intro', '[2026-01-02T03:04:05Z]', 'Fish & <chips>', '[text-escaped][image-url]',
        '[image-url]', 'storage-key:internal-key', '[/image-url]',
    ].join('\n'));
    assert.match(feed, /Fish &amp; &lt;chips&gt;/);
    assert.match(feed, /\[image-url\]/);
    assert.match(feed, /2026-01-02T03:04:05Z/);
    assert.doesNotMatch(feed, /internal-key|Intro/);
});

test('sitemap lists only known public routes and requires a current handoff', async () => {
    const { renderSitemap, sitemapEligible } = await import('../scripts/research/sitemap.mjs');
    const report = { revision: 'current', featureCandidates: [{ id: 'public-sitemap' }] };
    assert.equal(sitemapEligible(report, 'old'), false);
    assert.equal(sitemapEligible(report, 'current'), true);
    assert.match(renderSitemap(['projects.html', 'project-example.html']), /\/pages\/project-example\.html/);
    assert.doesNotMatch(renderSitemap(['pretext-lab.html', '../private.html', 'project-test&.html']), /lab|private|test/);
});

test('README additions preserve existing formatting and are idempotent', async () => {
    const { documentFeature } = await import('../scripts/research/document-feature.mjs');
    const before = '## Scheduled research preflight\r\n\r\nExisting prose.\r\n';
    const after = documentFeature(before, 'sitemap');
    assert.ok(after.startsWith(before + "\r\n"));
    assert.match(after, /\r\n- \[Sitemap\]/);
    assert.doesNotMatch(after, /(?<!\r)\n/);
    assert.equal(documentFeature(after, 'sitemap'), after);
    assert.equal(documentFeature('Already described in `/sitemap.xml`.\n', 'sitemap'), 'Already described in `/sitemap.xml`.\n');
    assert.throws(() => documentFeature(before, 'unknown'), /README/);
});
