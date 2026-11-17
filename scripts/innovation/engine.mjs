import { createHash } from 'node:crypto';
import { validName, validTopic } from './github.mjs';

const seeds = {
    intelligence: ['local-ai', 'webllm', 'semantic-search', 'mcp', 'agent-memory', 'agentic-ai', 'rag', 'transformers-js'],
    interfaces: ['creative-coding', 'webgpu', 'experimental-ui', 'web-components', 'generative-art'],
    developer: ['webassembly', 'static-analysis', 'developer-tools', 'code-visualization', 'workflow-automation'],
    visualization: ['knowledge-graph', 'data-visualization', 'node-editor', 'sonification'],
    browser: ['local-first', 'indexeddb', 'webtransport', 'crdt', 'offline-first'],
    privacy: ['passkeys', 'webauthn', 'privacy-first', 'client-side-encryption'],
    accessibility: ['accessibility', 'typography', 'progressive-enhancement', 'fuzzy-search', 'full-text-search'],
    experimental: ['webxr', 'simulation', 'computer-vision', 'human-computer-interaction'],
};
const seedCategory = new Map(Object.entries(seeds).flatMap(([category, topics]) =>
    topics.map(topic => [topic, category])));
const genericTopics = new Set(['javascript', 'typescript', 'python', 'rust', 'github', 'open-source',
    'awesome', 'awesome-list', 'ai', 'llm', 'react', 'vue', 'web', 'api', 'cpp', 'go', 'java', 'html', 'css', 'csharp']);
const weights = { originality: 25, compatibility: 20, feasibility: 15, experience: 15,
    momentum: 10, maintainability: 10, suitability: 5 };
const compatibleLicenses = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause',
    'ISC', '0BSD', 'Unlicense', 'CC0-1.0']);
export const defaults = {
    requests: 32, repositories: 60, inspections: 8, searches: 8, topics: 180,
    retention: 240, proposals: 12, aiCandidates: 4, aiTokens: 8000, durationMs: 100000,
    weights,
};

export function observe(prior, stars, date) {
    const priorObservations = prior?.observations ?? [];
    if (!Number.isSafeInteger(stars)) return { observations: priorObservations, growth: null, since: null };
    const observations = priorObservations.filter(item => item.date !== date).slice(-11);
    const previous = observations.at(-1);
    const growth = previous ? stars - previous.stars : null;
    observations.push({ date, stars });
    return { observations, growth, since: growth === null ? null : previous.date };
}

export function rank(ratings, weighting = weights, rejection) {
    const eligible = Object.entries(weighting).filter(([key, weight]) =>
        weight > 0 && Number.isFinite(ratings[key]) && ratings[key] >= 0 && ratings[key] <= 10);
    const available = eligible.reduce((total, [, weight]) => total + weight, 0);
    const total = Object.values(weighting).reduce((sum, weight) => sum + weight, 0);
    return {
        score: rejection || !available ? null : Math.round(10 * eligible.reduce(
            (sum, [key, weight]) => sum + ratings[key] * weight, 0) / available),
        confidence: Math.round(100 * available / total),
    };
}

export function evolveTopics(previous, repositories, outcomes, date, limit) {
    const records = new Map(Object.entries(previous));
    for (const [name, category] of seedCategory) {
        if (!records.has(name)) records.set(name, { category, source: 'seed', firstDiscovered: date,
            trials: 0, successes: 0, support: [] });
    }
    for (const repo of repositories) {
        for (const topic of new Set(repo.topics)) {
            if (!validTopic.test(topic) || genericTopics.has(topic)) continue;
            const entry = records.get(topic) ?? { category: repo.topics.map(value => seedCategory.get(value))
                .find(Boolean) ?? 'emerging', source: repo.name, firstDiscovered: date,
                trials: 0, successes: 0, support: [] };
            entry.support = [...new Set([...entry.support, repo.name.toLowerCase()])].slice(-8);
            entry.lastObserved = date;
            records.set(topic, entry);
        }
    }
    for (const { topic, novel } of outcomes) {
        const entry = records.get(topic);
        if (!entry) continue;
        entry.trials++;
        if (novel) entry.successes++;
        entry.lastEvaluated = date;
    }
    for (const entry of records.values()) {
        entry.discoverySuccessRate = entry.trials ? entry.successes / entry.trials : null;
        entry.relevanceScore = Math.round((40 * Math.min(entry.support.length, 4) / 4)
            + 60 * (entry.discoverySuccessRate ?? 0.5));
        entry.active = (entry.source === 'seed' || entry.support.length >= 2)
            && (entry.trials < 4 || entry.discoverySuccessRate >= 0.2);
    }
    return Object.fromEntries([...records].sort(([a, x], [b, y]) =>
        Number(seedCategory.has(b)) - Number(seedCategory.has(a))
        || Number(y.active) - Number(x.active) || y.relevanceScore - x.relevanceScore
        || a.localeCompare(b)).slice(0, limit));
}

function searchPlan(registry, date, limit) {
    const since = days => new Date(Date.parse(date) - days * 86_400_000).toISOString().slice(0, 10);
    const term = Object.entries(registry).filter(([, entry]) => entry.active).sort(([a, x], [b, y]) =>
        (x.lastEvaluated ?? '').localeCompare(y.lastEvaluated ?? '')
        || y.relevanceScore - x.relevanceScore || a.localeCompare(b));
    const learned = term.find(([, entry]) => entry.source !== 'seed');
    if (learned) term.unshift(...term.splice(term.indexOf(learned), 1));
    const base = 'is:public fork:false archived:false';
    return [
        { strategy: 'early-engagement', query: base + ' created:>=' + since(45) + ' stars:20..500' },
        { strategy: 'established-active', query: base + ' pushed:>=' + since(14) + ' stars:>500 language:JavaScript' },
        { strategy: 'curated', query: base + ' topic:awesome-list pushed:>=' + since(90) },
        { strategy: 'cross-domain', query: base + ' visualization in:description pushed:>=' + since(30) +
            ' language:Rust language:Python stars:10..1000' },
        ...term.map(([topic]) => ({ strategy: 'topic', topic, query: base + ' topic:' + topic +
            ' pushed:>=' + since(90) + ' stars:>=5' })),
    ].slice(0, limit);
}

const id = value => createHash('sha256').update(value).digest('hex').slice(0, 20);
const evidenceLine = text => text.split(/\r?\n/).map(line => line.trim())
    .find(line => /^[A-Z]/i.test(line) && line.length >= 28 && !/https?:|[<>]/i.test(line))?.slice(0, 240);

function opportunity(repo, categories) {
    const topics = repo.topics.filter(name => !genericTopics.has(name));
    const topic = topics.find(name => seedCategory.has(name))
        ?? topics.find(name => categories[name]?.active) ?? topics[0];
    const category = categories[topic]?.category ?? 'emerging';
    const excerpt = evidenceLine(repo.evidence.text);
    if (!excerpt) return null;
    const label = (topic ?? repo.name.split('/')[1]).replace(/-/g, ' ');
    const design = {
        intelligence: 'Show the same input with and without a local inference step, with a visible reset.',
        interfaces: 'Expose one visual parameter and let visitors compare two rendering states side by side.',
        developer: 'Let visitors step through a small deterministic input and inspect each intermediate result.',
        visualization: 'Let visitors select one observation and trace how it changes the rendered relationships.',
        browser: 'Demonstrate the capability offline with explicit feature detection and a static fallback.',
        privacy: 'Use synthetic inputs to show what is processed locally and what would leave the browser.',
        accessibility: 'Let keyboard and pointer users manipulate the same example with equivalent feedback.',
        experimental: 'Use a minimal simulation and make its output accessible through a text summary.',
    }[category] ?? 'Turn one mechanism described in the upstream evidence into a controllable input/output experiment.';
    const destination = 'refinement of an existing terminal command or UI interaction';
    const proposal = {
        id: id((repo.providerId ?? repo.name.toLowerCase()) + '\0' + label),
        title: 'Improve terminal interaction with ' + label,
        category, sources: [repo.name], technique: topic ?? 'README-described technique',
        evidence: [{ repository: repo.name, path: repo.evidence.path, excerpt }],
        adaptation: 'Adapt ' + label + ' as a ' + destination + ', with acceptance checks on that existing task. Do not create standalone demos or new HTML pages.',
        value: 'Help visitors discover commands, read output or navigate the existing terminal.',
        approach: 'Apply to existing help, command output or navigation. ' + design,
        difficulty: 'needs assessment', performance: 'budget and measure on mobile before implementation',
        dependencies: [], compatibility: 'requires validation in a static browser-only prototype',
        security: 'review dependency and data boundaries before implementation',
        licensing: repo.license ?? 'unknown',
        status: 'experimental',
        ratings: { originality: topic && !seedCategory.has(topic) ? 7 : 5, compatibility: 5,
            feasibility: 4, experience: 5, suitability: compatibleLicenses.has(repo.license) ? 8 : undefined },
    };
    if (repo.metrics.growth !== null) proposal.ratings.momentum = Math.max(0,
        Math.min(10, 5 + Math.sign(repo.metrics.growth) * Math.log2(1 + Math.abs(repo.metrics.growth))));
    if (!compatibleLicenses.has(repo.license)) {
        proposal.status = 'deferred';
        proposal.reason = 'Upstream reuse requires a compatible license review';
    }
    return proposal;
}

function validateIdea(idea, candidates) {
    if (!idea || !Array.isArray(idea.sources) || !idea.sources.length || idea.sources.length > 4
        || new Set(idea.sources).size !== idea.sources.length
        || !idea.sources.every(name => candidates.has(name))) return null;
    const fields = ['title', 'technique', 'adaptation', 'value', 'approach', 'difficulty', 'performance',
        'compatibility', 'security'];
    if (!fields.every(field => typeof idea[field] === 'string' && idea[field].trim()
        && idea[field].length <= 600)) return null;
    if (!Array.isArray(idea.evidence) || !idea.sources.every(name => idea.evidence.some(item =>
        item?.repository === name && typeof item.excerpt === 'string' && item.excerpt.trim().length >= 20
        && candidates.get(name).evidence.text.includes(item.excerpt)))) return null;
    return Object.fromEntries(fields.map(field => [field, idea[field].trim()]));
}

function synthesized(idea, candidates, registry) {
    const fields = validateIdea(idea, candidates);
    if (!fields) return null;
    const sources = [...idea.sources].sort();
    const licenses = sources.map(name => candidates.get(name).license);
    const rejected = idea.unacceptableRisk === true || idea.impossibleInfrastructure === true
        || idea.incompatibleLicense === true;
    const deferred = licenses.some(license => !compatibleLicenses.has(license));
    const category = registry[candidates.get(sources[0]).topics[0]]?.category ?? 'emerging';
    const ratings = Object.fromEntries(Object.keys(weights).filter(key =>
        Number.isFinite(idea.ratings?.[key]) && idea.ratings[key] >= 0 && idea.ratings[key] <= 10
        && key !== 'momentum').map(key => [key, idea.ratings[key]]));
    const evidence = sources.map(repository => ({ repository,
        path: candidates.get(repository).evidence.path,
        excerpt: idea.evidence.find(item => item?.repository === repository &&
            typeof item.excerpt === 'string' && item.excerpt.trim().length >= 20 &&
            candidates.get(repository).evidence.text.includes(item.excerpt)).excerpt.slice(0, 300) }));
    return { ...fields, id: id(sources.join('\0') + '\0' + fields.technique.toLowerCase()),
        sources, category, evidence, ratings, licensing: licenses.join(', '),
        dependencies: Array.isArray(idea.dependencies) ? idea.dependencies.filter(item =>
            typeof item === 'string').slice(0, 8).map(item => item.slice(0, 80)) : [],
        status: rejected ? 'rejected' : deferred ? 'deferred' : 'proposed',
        reason: rejected ? 'Security, license or infrastructure gate' : deferred ?
            'Upstream reuse requires a compatible license review' : undefined };
}

function orderBacklog(items, limit) {
    const priorities = { high: 4, quick: 3, experimental: 2, 'long-term': 1, deferred: 0 };
    const groups = new Map();
    for (const item of items.sort((a, b) => priorities[b.priority] - priorities[a.priority]
        || (b.score ?? -1) - (a.score ?? -1) || a.id.localeCompare(b.id))) {
        const group = groups.get(item.category) ?? [];
        group.push(item);
        groups.set(item.category, group);
    }
    const roundRobin = [];
    while (roundRobin.length < limit && groups.size) {
        for (const [category, group] of groups) {
            roundRobin.push(group.shift());
            if (!group.length) groups.delete(category);
            if (roundRobin.length === limit) break;
        }
    }
    return roundRobin;
}

export async function research({ github, trend, date, history, config = defaults, analyze, analysisVersion, signal }) {
    const prior = history ?? { repositories: {}, topics: {}, backlog: [] };
    const registry = evolveTopics(prior.topics, [], [], date, config.topics);
    const errors = [];
    const pool = new Map();
    const outcomes = [];
    function add(repo, source) {
        if (!validName.test(repo.name ?? '')) return;
        const key = repo.name.toLowerCase();
        const previous = pool.get(key);
        if (previous || pool.size < config.repositories) {
            pool.set(key, { ...previous, ...repo, sources: [...new Set([...(previous?.sources ?? []), source])] });
        }
    }

    const discovered = await Promise.resolve().then(trend).catch(() => {
        errors.push('Trending collection failed');
        return { repositories: [], unavailable: ['daily', 'weekly', 'monthly'] };
    });
    for (const repo of discovered.repositories.slice(0, Math.ceil(config.repositories / 2))) {
        add({ name: repo.name, trending: repo.ranks, description: repo.description,
            topics: [], trendingEvidence: repo.readme }, 'trending');
    }
    for (const search of searchPlan(registry, date, config.searches)) {
        if (signal?.aborted) break;
        try {
            const results = await github.search(search.query);
            const novel = results.some(repo => !prior.repositories[repo.name.toLowerCase()] && repo.license
                && compatibleLicenses.has(repo.license) && repo.topics.includes(search.topic));
            for (const repo of results) add(repo, search.strategy);
            if (search.topic) outcomes.push({ topic: search.topic, novel });
        } catch (error) {
            errors.push(search.strategy + ': ' + error.message);
            if (/rate limit|budget exhausted/.test(error.message)) break;
        }
    }
    const trendingWithoutMetadata = [...pool.values()].filter(repo => repo.trending && !repo.revision)
        .slice(0, Math.floor(config.inspections / 3));
    for (const repo of trendingWithoutMetadata) {
        if (!github.metadata || signal?.aborted) break;
        const previous = prior.repositories[repo.name.toLowerCase()];
        if (previous?.revision && Date.parse(date) - Date.parse(previous.metadataDate) < 7 * 86_400_000) {
            add({ ...repo, revision: previous.revision, license: previous.license,
                topics: previous.topics, metadataDate: previous.metadataDate }, 'trending');
            continue;
        }
        try {
            const metadata = await github.metadata(repo.name);
            if (metadata) add({ ...metadata, metadataDate: date }, 'trending');
        } catch (error) {
            errors.push(repo.name + ' metadata: ' + error.message);
            if (/rate limit|budget exhausted/.test(error.message)) break;
        }
    }
    const ordered = [...pool.values()].sort((a, b) =>
        Number(!!b.trendingEvidence?.text && compatibleLicenses.has(b.license))
        - Number(!!a.trendingEvidence?.text && compatibleLicenses.has(a.license)) ||
        Number(!!b.license) - Number(!!a.license) || Number(!!b.topics.length) - Number(!!a.topics.length)
        || Number(!!b.trending) - Number(!!a.trending));
    const topics = evolveTopics(registry, ordered, outcomes, date, config.topics);
    const inspected = [];
    const repositories = { ...prior.repositories };
    let inspections = 0;
    let sourceInspections = 0;
    for (const repo of ordered) {
        const key = repo.name.toLowerCase();
        const previous = prior.repositories[key];
        const metrics = observe(previous?.metrics, repo.stars, date);
        const revision = repo.revision ?? (repo.trendingEvidence?.text ? id(repo.trendingEvidence.text) : null);
        let evidence = repo.trendingEvidence?.text ? { path: 'README (Trending evidence)',
            text: repo.trendingEvidence.text.slice(0, 8000) } : null;
        if (!evidence && previous && revision && previous.revision === revision) evidence = previous.evidence;
        if (!evidence && inspections < config.inspections && !signal?.aborted) {
            inspections++;
            try {
                evidence = await github.inspect(repo.name);
            } catch (error) {
                if (repo.trendingEvidence?.text) evidence = { path: 'README (Trending evidence)',
                    text: repo.trendingEvidence.text.slice(0, 8000) };
                else errors.push(repo.name + ': ' + error.message);
            }
        }
        let sourceEvidence = previous?.revision === revision ? previous?.sourceEvidence : null;
        if (analyze && github.inspectSource && evidence && !sourceEvidence && !signal?.aborted
            && compatibleLicenses.has(repo.license) && sourceInspections < Math.min(config.aiCandidates, 2)) {
            sourceInspections++;
            try {
                sourceEvidence = await github.inspectSource(repo.name);
            } catch (error) {
                errors.push(repo.name + ' manifest: ' + error.message);
            }
        }
        const { trendingEvidence, ...metadata } = repo;
        const record = { ...metadata, revision, lastSeen: date, metrics, evidence, sourceEvidence };
        repositories[key] = record;
        if (evidence?.text) inspected.push(record);
    }
    const proposals = inspected.map(repo => opportunity(repo, topics)).filter(Boolean);
    let analysisCache = prior.analysisCache ?? null;
    if (analyze && config.aiCandidates && !signal?.aborted) {
        const selected = inspected.filter(repo => compatibleLicenses.has(repo.license))
            .sort((a, b) => Number(a.revision === prior.repositories[a.name.toLowerCase()]?.revision)
                - Number(b.revision === prior.repositories[b.name.toLowerCase()]?.revision))
            .slice(0, config.aiCandidates);
        const key = id(JSON.stringify([analysisVersion, config.aiTokens, config.proposals, selected.map(repo => [repo.name, repo.revision, repo.metrics.growth, repo.sourceEvidence?.text])]));
        const candidates = new Map(selected.map(repo => [repo.name, repo]));
        if (selected.length) {
            try {
                let ideas = analysisCache?.key === key ? analysisCache.ideas : null;
                if (!ideas) {
                    const result = await analyze(selected, { maxTokens: config.aiTokens,
                        maxProposals: config.proposals, signal });
                    if (!Array.isArray(result)) throw new Error('AI adapter must return an array');
                    ideas = result.slice(0, config.proposals).map(idea =>
                        synthesized(idea, candidates, topics)).filter(Boolean);
                }
                proposals.push(...ideas);
                analysisCache = { key, ideas };
            } catch (error) {
                errors.push('AI synthesis: ' + error.message);
            }
        }
    }
    const old = new Map(prior.backlog.map(proposal => [proposal.id, proposal]));
    const backlog = new Map(old);
    for (const proposal of proposals) {
        const previous = old.get(proposal.id);
        const evidenceChanged = JSON.stringify(previous?.evidence) !== JSON.stringify(proposal.evidence);
        const status = previous?.status === 'implemented' || previous?.status === 'accepted'
            || (previous?.status === 'rejected' && !evidenceChanged) ? previous.status : proposal.status;
        const result = rank(proposal.ratings, config.weights, status === 'rejected' || status === 'deferred');
        const priority = status === 'rejected' || status === 'deferred' ? 'deferred'
            : result.score >= 75 && result.confidence >= 65 ? 'high'
            : proposal.ratings.feasibility >= 8 ? 'quick'
            : proposal.ratings.feasibility < 4 ? 'long-term' : 'experimental';
        backlog.set(proposal.id, { ...proposal, status, priority, ...result,
            firstSeen: previous?.firstSeen ?? date, lastSeen: date });
    }
    const retained = [...backlog.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))
        .slice(0, config.retention);
    const ranked = orderBacklog(retained, config.proposals);
    return {
        history: { schema: 1, topics, repositories: Object.fromEntries(Object.entries(repositories)
            .sort(([, a], [, b]) => b.lastSeen.localeCompare(a.lastSeen)).slice(0, config.retention)),
            backlog: retained, analysisCache },
        report: { schema: 1, date, counts: { repositories: ordered.length, inspected: inspected.length },
            trendingUnavailable: discovered.unavailable, errors, backlog: ranked, changes: {
                added: ranked.filter(item => !old.has(item.id)).map(item => item.id),
                updated: ranked.filter(item => old.has(item.id) && ['score', 'priority', 'status'].some(
                    field => item[field] !== old.get(item.id)[field])).map(item => item.id),
                newTopics: Object.keys(topics).filter(topic => topics[topic].active && !prior.topics[topic]?.active),
            } },
    };
}
