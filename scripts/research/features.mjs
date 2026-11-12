export function discoverFeatures({ home, projects, blog }) {
    const candidates = [];
    const projectLinks = new Set(
        [...projects.matchAll(/href\s*=\s*["'](?:\.\/)?(?:\/pages\/)?(project-[\w-]+\.html)["']/gi)]
            .map(match => match[1].toLowerCase()),
    );
    if (projectLinks.size >= 3 && !/<(?:input\b[^>]*type\s*=\s*["']?search\b|search\b)|role\s*=\s*["']search["']/i.test(projects)) {
        candidates.push({
            id: 'project-index-filter',
            title: 'Filter the portfolio project index',
            value: 4,
            effort: 2,
            evidence: `pages/projects.html links to ${projectLinks.size} distinct project pages and has no native search landmark or input.`,
            acceptance: [
                'Visitors can filter by project title or description with keyboard and touch.',
                'An empty query shows every project, and direct links still work without JavaScript.',
                'Verify the index on desktop and mobile with the applicable Impeccable playbook.',
            ],
        });
    }

    const hasEntry = /^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\]\s*$/m.test(blog);
    const hasFeedLink = /<link\b[^>]*\btype\s*=\s*["']application\/(?:rss|atom)\+xml["']/i.test(home);
    if (home.trim() && hasEntry && !hasFeedLink) {
        candidates.push({
            id: 'public-blog-feed',
            title: 'Offer a subscribable blog feed',
            value: 4,
            effort: 3,
            evidence: 'content/blog.txt contains timestamped entries. index.html does not declare an RSS or Atom discovery link.',
            acceptance: [
                'Check for an existing feed before implementation.',
                'Publish valid XML with stable entry IDs and escaped text; include a discovery link.',
                'Verify that the deployed Pages artifact serves the feed.',
            ],
        });
    }

    return candidates.sort((left, right) => right.value / right.effort - left.value / left.effort);
}
