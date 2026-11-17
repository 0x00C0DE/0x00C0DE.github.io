import { defaults, research } from '../innovation/engine.mjs';
import { githubClient } from '../innovation/github.mjs';

const windows = ['daily', 'weekly', 'monthly'];
const normalize = text => text.replace(/\s+/g, ' ').trim();

export function eligibleInnovations(trending, innovation) {
    const readmes = new Map(trending.repositories.filter(repo => typeof repo.readme?.text === 'string'
        && windows.some(window => Number.isInteger(repo.ranks?.[window])))
        .map(repo => [repo.name, normalize(repo.readme.text)]));
    return (innovation?.backlog ?? []).flatMap(opportunity => {
        if (!['experimental', 'proposed'].includes(opportunity.status) ||
            !/^[a-f0-9]{20}$/.test(opportunity.id) || !Number.isFinite(opportunity.score) ||
            !Number.isFinite(opportunity.confidence) || typeof opportunity.technique !== 'string'
            || !Array.isArray(opportunity.sources) || !Array.isArray(opportunity.evidence)) return [];
        const sources = opportunity.sources.filter(name => readmes.has(name) && opportunity.evidence.some(item =>
            item.repository === name && typeof item.excerpt === 'string' && normalize(item.excerpt).length >= 20
            && readmes.get(name).includes(normalize(item.excerpt))));
        return sources.length ? [{ ...opportunity, sources }] : [];
    }).sort((a, b) => b.score - a.score || b.confidence - a.confidence);
}

export function prioritizeInnovations(report, features) {
    const opportunities = eligibleInnovations(report.trending, report.innovation);
    const ranks = new Map(opportunities.map((opportunity, index) => [opportunity.id, { opportunity, index }]));
    return features.flatMap(feature => {
        if (feature.innovationId == null) return [{ feature, rank: ranks.size }];
        const match = ranks.get(feature.innovationId);
        if (!match?.opportunity.sources.includes(feature.repository)) return [];
        return [{ feature: { ...feature, innovationTechnique: match.opportunity.technique }, rank: match.index }];
    }).sort((a, b) => a.rank - b.rank).map(({ feature }) => feature);
}

export async function rankHandoff({ trending, date, history, token }) {
    const signal = AbortSignal.timeout(50_000);
    const config = { ...defaults, requests: 24, inspections: 12, searches: 5, proposals: 20 };
    const github = githubClient({ requests: config.requests, token, signal });
    const result = await research({ github, config, date, history, signal, trend: async () => trending });
    return { history: result.history, report: {
        schema: result.report.schema, errors: result.report.errors,
        backlog: eligibleInnovations(trending, result.report),
    } };
}
