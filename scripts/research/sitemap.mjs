const site = 'https://0x00c0de.github.io';
export const sitemapDirective = 'Sitemap: ' + site + '/sitemap.xml\n';

export function sitemapEligible(report, revision) {
    return Boolean(revision && report?.revision === revision
        && Array.isArray(report.featureCandidates)
        && report.featureCandidates.some(candidate => candidate?.id === 'public-sitemap'));
}

export function renderSitemap(pages) {
    const routes = pages.filter(page => /^(?:projects|bitcoin|project-[a-z0-9-]+)\.html$/.test(page)).sort();
    return '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + ['/', ...routes.map(page => '/pages/' + page)].map(route => '  <url><loc>' + site + route + '</loc></url>\n').join('')
        + '</urlset>\n';
}
