import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverFeatures } from '../scripts/research/features.mjs';

test('identifies evidence-backed portfolio and blog feature candidates in ranked order', () => {
    const candidates = discoverFeatures({
        home: '<head><title>Portfolio</title></head>',
        projects: '<a href="project-a.html">A</a><a href="project-b.html">B</a><a href="project-c.html">C</a>',
        blog: '[2026-11-12T12:00:00Z]\nExample entry',
    });
    assert.deepEqual(candidates.map(({ id }) => id), ['project-index-filter', 'public-blog-feed']);
    assert.ok(candidates.every(({ evidence, acceptance }) => evidence && acceptance.length > 0));
});

test('omits candidates when their signal is absent or an existing feature is detected', () => {
    assert.deepEqual(discoverFeatures({ home: '', projects: '', blog: '' }), []);
    assert.deepEqual(discoverFeatures({
        home: '<link type="application/rss+xml" rel="alternate" href="/feed.xml">',
        projects: '<input type="search"><a href="project-a.html">A</a><a href="project-b.html">B</a><a href="project-c.html">C</a>',
        blog: '[2026-11-12T12:00:00Z]\nExample entry',
    }), []);
});
