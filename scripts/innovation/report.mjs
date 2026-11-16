const groups = [
    ['high', 'High-priority innovations'], ['experimental', 'Experimental opportunities'],
    ['quick', 'Quick improvements'], ['long-term', 'Long-term research candidates'],
    ['deferred', 'Rejected or deferred ideas'],
];
const escape = value => String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/[<>&[\]()*_!#|]/g, '\\$&');

export function markdown(report) {
    return [
        '# Innovation discovery — ' + report.date, '',
        'Repositories collected: ' + report.counts.repositories + '. Evidence reviewed: ' + report.counts.inspected + '.',
        'Added: ' + report.changes.added.length + '. Updated: ' + report.changes.updated.length + '.',
        'New active topics: ' + (report.changes.newTopics.slice(0, 15).map(escape).join(', ') || 'none') + '.',
        ...report.trendingUnavailable.map(window => '- Trending unavailable: ' + escape(window)),
        ...report.errors.map(error => '- ' + escape(error)),
        ...groups.flatMap(([priority, heading]) => [
            '', '## ' + heading, '',
            ...report.backlog.filter(item => item.priority === priority).flatMap(item => [
                '### ' + escape(item.title), '',
                '- ' + item.sources.map(name => '[' + escape(name) + '](https://github.com/' + name + ')').join(', '),
                '- Category: ' + escape(item.category) + '. Score: ' + (item.score ?? 'unrated')
                    + '. Evidence coverage: ' + item.confidence + '%. Status: ' + escape(item.status) + '.',
                '- Technique: ' + escape(item.technique),
                ...item.evidence.map(evidence => '- Evidence (' + escape(evidence.path) + '): ' + escape(evidence.excerpt)),
                '- Proposed adaptation: ' + escape(item.adaptation),
                '- Visitor value: ' + escape(item.value),
                '- First implementation step: ' + escape(item.approach),
                '- Difficulty: ' + escape(item.difficulty) + '. Performance: ' + escape(item.performance),
                '- Dependencies: ' + escape(item.dependencies.join(', ') || 'none identified'),
                '- Compatibility: ' + escape(item.compatibility),
                '- Security: ' + escape(item.security) + '. Licensing: ' + escape(item.licensing),
                ...(item.reason ? ['- Decision: ' + escape(item.reason)] : []), '',
            ]),
        ]),
    ].join('\n');
}
