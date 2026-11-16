import { execFileSync } from 'node:child_process';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { verifyReactBits } from './react-bits.mjs';

export const designRoutePattern = /^\/pages\/[a-z0-9-]+\.html$/;

function experiencePath(route) {
    if (typeof route !== 'string' || !designRoutePattern.test(route)) {
        throw new Error('Invalid public design route: ' + route);
    }
    return route.slice(1);
}

function isExperiencePath(path) {
    return !/^pages\/projects?[-.]/.test(path)
        && !/(?:\/|-)(?:reader|archive|digest)(?:-|\.html$)/.test(path);
}

export function selectExperiences(features, existingPaths) {
    const known = new Set(existingPaths);
    return features.filter(feature => {
        const path = experiencePath(feature.route);
        return isExperiencePath(path) && !known.has(path);
    });
}

export function validateExperience(changes, route) {
    const page = experiencePath(route);
    if (!isExperiencePath(page)) throw new Error('Selected route must be a standalone visual experience');
    if (!changes.some(change => change.path === page && change.previousMode === '000000')) {
        throw new Error('Experience must add the selected route as a new page');
    }
    for (const change of changes) {
        if (change.path === 'README.md') continue;
        if (change.previousMode !== '000000') throw new Error('Experience cannot modify existing file: ' + change.path);
        if (change.path.startsWith('pages/') && change.path !== page) {
            throw new Error('Experience can only add the selected public page; put new assets in src/');
        }
    }
}

export function selectDiscovery(report, revision) {
    if (!revision || report?.revision !== revision || !Array.isArray(report.trending?.repositories)) return null;
    const repositories = report.trending.repositories.filter(repo =>
        /^[\w-]+\/[\w.-]+$/.test(repo?.name));
    return repositories.length ? { revision, trending: { repositories } } : null;
}

export function describeHandoff(candidate, runId) {
    if (candidate.discovery) return { lead: `Trending discovery (${runId})`, surface: null };
    const [repo] = candidate.trending.repositories;
    return { lead: repo.name, surface: repo.fit.surface };
}

export function verifyEvaluation(trending, evaluation) {
    const result = selectVerifiedFeatures(trending, evaluation);
    if (result.invalidEvidence.length) {
        throw new Error('Invalid README evidence for ' + result.invalidEvidence.join(', '));
    }
    return result.features;
}

export function selectVerifiedFeatures(trending, evaluation) {
    if (trending.unavailable?.length) throw new Error('Trending windows unavailable: ' + trending.unavailable.join(', '));
    const windows = ['daily', 'weekly', 'monthly'];
    const expected = new Set(trending.repositories.flatMap(repo => windows
        .filter(window => Number.isInteger(repo.ranks?.[window]))
        .map(window => window + '/' + repo.name)));
    if (windows.some(window => ![...expected].some(key => key.startsWith(window + '/')))) {
        throw new Error('Trending coverage is missing an entire window');
    }
    for (const repo of trending.repositories) {
        if (repo.designReference) expected.add('design/' + repo.name);
    }
    const normalizeExcerpt = text => text.replace(/\s+/g, ' ').trim();
    const readmes = new Map(trending.repositories.map(repo => [
        repo.name, repo.readme?.text && normalizeExcerpt(repo.readme.text),
    ]));
    const invalidEvidence = new Set();
    for (const { window, repository, reason, readmeEvidence } of evaluation.assessments ?? []) {
        if (!reason?.trim() || !expected.delete(window + '/' + repository)) {
            throw new Error('Invalid or duplicate Trending assessment coverage');
        }
        const readme = readmes.get(repository);
        const evidence = typeof readmeEvidence === 'string' && normalizeExcerpt(readmeEvidence);
        if (readme ? !evidence || !readme.includes(evidence) : readmeEvidence !== '') {
            invalidEvidence.add(repository);
        }
    }
    if (expected.size) throw new Error('Incomplete Trending assessment coverage');
    if (!Array.isArray(evaluation.features)) throw new Error('Missing Trending feature list');
    const titles = new Set();
    for (const feature of evaluation.features) {
        if (typeof feature?.title !== 'string' || !feature.title.trim()
            || /[\u0000-\u001f\u007f]/.test(feature.title) || feature.title.length > 80
            || typeof feature.brief !== 'string' || !feature.brief.trim()
            || feature.brief.length > 3000 || feature.brief.includes('\0')
            || !readmes.get(feature.repository)) {
            throw new Error('Invalid selected Trending feature');
        }
        const title = feature.title.trim().replace(/\s+/g, ' ').toLowerCase();
        if (titles.has(title)) throw new Error('Duplicate Trending feature title');
        titles.add(title);
    }
    return {
        features: evaluation.features.filter(feature => !invalidEvidence.has(feature.repository)),
        invalidEvidence: [...invalidEvidence],
    };
}

export function selectLead(report, revision, acceptsSurface = () => true) {
    if (!revision || report?.revision !== revision || !Array.isArray(report.trending?.repositories)) return null;
    return report.trending.repositories.find(repo => /^[\w-]+\/[\w.-]+$/.test(repo?.name)
        && typeof repo.fit?.surface === 'string' && acceptsSurface(repo.fit.surface)
        && !(report.projectNavigationPublished && repo.fit.capability === 'native-project-navigation')) ?? null;
}

export function validateChanges(changes) {
    const allowed = /^(?:README\.md|pages\/[a-z0-9-]+\.(?:html|css|mjs)|src\/codex-feature-[a-z0-9-]+\.(?:mjs|css|jsx|react-bits\.json)|tests\/codex-feature-[a-z0-9-]+\.test\.mjs)$/;
    if (changes.length < 3 || changes.length > 10
        || changes.some(({ mode, previousMode, path }) => !allowed.test(path)
            || (mode !== '100644' && !(mode === '100755' && previousMode === mode)))
        || !changes.some(change => change.path === 'README.md')
        || !changes.some(change => change.path.startsWith('tests/'))
        || !changes.some(change => /^(pages|src)\//.test(change.path))) {
        throw new Error('Proposal must include a README update, a feature test, and only allowed regular files');
    }
}

export function reviewApproved(text) {
    try {
        const result = JSON.parse(text);
        return result?.decision === 'approve'
            && Array.isArray(result.findings) && result.findings.length === 0;
    } catch {
        return false;
    }
}

function git(...args) {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 });
}

function verifyIndex(route) {
    const files = git('diff', '--cached', '--raw', '--no-renames', '-z').split('\0');
    const changes = [];
    for (let i = 0; i < files.length - 1; i += 2) {
        const match = /^:(\d{6}) (\d{6}) [a-f0-9]+ [a-f0-9]+ ([AM])$/.exec(files[i]);
        if (!match) throw new Error('Unexpected staged operation');
        changes.push({ previousMode: match[1], mode: match[2], path: files[i + 1] });
    }
    validateChanges(changes);
    validateExperience(changes, route);
    const stats = git('diff', '--cached', '--numstat', '--no-renames', '-z').split('\0').filter(Boolean);
    let lines = 0;
    for (const stat of stats) {
        const [added, removed] = stat.split('\t');
        if (!/^\d+$/.test(added) || !/^\d+$/.test(removed)) throw new Error('Binary proposal rejected');
        lines += Number(added) + Number(removed);
    }
    if (lines > 400) throw new Error('Proposal exceeds 400 changed lines');
    git('diff', '--cached', '--check');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    if (process.argv[2] === 'describe') {
        const candidate = JSON.parse(await readFile(process.argv[3], 'utf8'));
        console.log(JSON.stringify(describeHandoff(candidate, process.argv[4])));
    } else if (process.argv[2] === 'evaluation') {
        const [, , , reportPath, evaluationPath, selectionPath] = process.argv;
        const report = JSON.parse(await readFile(reportPath, 'utf8'));
        const evaluation = JSON.parse(await readFile(evaluationPath, 'utf8'));
        verifyReactBits(report.reactBits, evaluation);
        const { features, invalidEvidence } = selectVerifiedFeatures(report.trending, evaluation);
        if (invalidEvidence.length) {
            console.warn('Excluded repositories with invalid README evidence: ' + invalidEvidence.join(', '));
            if (!features.length) throw new Error('No verified feature selection with complete README evidence');
        }
        const existing = git('ls-files', '-z', '--', 'pages/').split('\0');
        const experiences = selectExperiences(features, existing);
        if (features.length && !experiences.length) console.log('No qualifying new visual experience route.');
        await writeFile(selectionPath, JSON.stringify(experiences));
        console.log(`Verified ${evaluation.assessments.length} daily, weekly, and monthly Trending assessments.`);
    } else if (process.argv[2] === 'verify') {
        verifyIndex(process.argv[3]);
    } else if (process.argv[2] === 'review') {
        const approved = reviewApproved(await readFile(process.argv[3], 'utf8'));
        await appendFile(process.env.GITHUB_OUTPUT, 'approved=' + approved + '\n');
    } else {
        const report = JSON.parse(await readFile(process.argv[2], 'utf8'));
        if (selectDiscovery(report, process.env.GITHUB_SHA)) {
            await appendFile(process.env.GITHUB_OUTPUT, 'eligible=true\n');
            console.log('Trending shortlist is available for open-ended site evaluation.');
        }
    }
}
