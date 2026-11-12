const HOUR = 3_600_000;
const RESERVE = 0.15;
const LAUNCH_MARGIN = 1.5 * HOUR;

function timestamp(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT.+(?:Z|[+-]\d\d:\d\d)$/.test(value)) return NaN;
    return Date.parse(value);
}

function fresh(value, now) {
    const age = now - timestamp(value);
    return age >= 0 && age <= 4 * HOUR;
}

function fraction(value) {
    return Number.isFinite(value) && value >= 0 && value <= 1;
}

function planBudget(observation, now) {
    if (!fresh(observation?.observedAt, now) || !fraction(observation.weeklyRemaining)) return null;
    const reset = timestamp(observation.weeklyResetAt);
    if (!(reset > now)) return null;

    const hoursLeft = (reset - now) / HOUR;
    const previousReset = timestamp(observation.previousWeeklyResetAt);
    if (Number.isFinite(previousReset) && previousReset > timestamp(observation.observedAt)) return null;
    const hoursSinceReset = (now - previousReset) / HOUR;
    const weekly = observation.weeklyRemaining;
    const hasShortWindow = observation.shortWindowApplies !== false;
    const shortReset = timestamp(observation.shortResetAt);
    if (hasShortWindow && (!(shortReset > now) || !fraction(observation.shortRemaining))) return null;
    const short = hasShortWindow ? observation.shortRemaining : 1;

    let phase = 'steady';
    if (hoursLeft <= 24) phase = 'final-24h';
    else if (hoursLeft <= 48) phase = 'final-48h';
    else if (hoursSinceReset >= 0 && hoursSinceReset < 24) phase = 'first-24h';

    return {
        phase,
        reset,
        remaining: weekly,
        shortRemaining: hasShortWindow ? short : null,
        shortReset: hasShortWindow ? shortReset : Infinity,
        fits(task) {
            if (weekly <= 0 || short <= 0) return false;
            if (!task.urgent && weekly < 0.25 && phase !== 'final-24h') return false;
            const reserve = task.urgent || phase === 'final-24h' ? 0 : RESERVE;
            const allowance = Math.max(0, weekly - reserve);
            const slots = Math.max(1, Math.ceil(hoursLeft / 6));
            const cap = task.urgent || phase === 'final-24h' ? allowance : Math.min(allowance, 3 * allowance / slots);
            return task.weeklyFraction <= cap && (!hasShortWindow || task.shortFraction <= short);
        },
        cost: task => task.weeklyFraction,
    };
}

function apiBudget(api, now) {
    if (!fresh(api?.observedAt, now)) return null;
    const start = timestamp(api.periodStart);
    const reset = timestamp(api.periodEnd);
    if (!(start <= timestamp(api.observedAt) && now < reset && reset - start === 168 * HOUR)) return null;
    const amounts = [api.limitCents, api.bookedCents, api.pendingCents];
    if (!amounts.every(amount => Number.isSafeInteger(amount) && amount >= 0)) return null;
    const remaining = Math.max(0, api.limitCents - api.bookedCents - api.pendingCents);
    const slots = Math.max(1, Math.ceil((reset - now) / (6 * HOUR)));
    return {
        phase: 'internal-api-allocation',
        reset,
        remaining,
        shortRemaining: null,
        fits(task) {
            const available = remaining - Math.ceil(api.limitCents * RESERVE);
            const cap = task.urgent ? remaining : Math.min(available, 3 * available / slots);
            return Number.isSafeInteger(task.apiCostCents) && task.apiCostCents > 0 && task.apiCostCents <= cap;
        },
        cost: task => task.apiCostCents,
    };
}

export function planCycle({
    now, mode, tasks = [], observation, api, active, duplicate, cooldownUntil, impeccableReady,
}) {
    const decision = { mode, phase: null, task: null };
    if (active || duplicate) return { ...decision, reason: 'work-active' };
    if (cooldownUntil > now) return { ...decision, reason: 'cooldown' };
    const budget = mode === 'chatgpt-plan' ? planBudget(observation, now)
        : mode === 'openai-api' ? apiBudget(api, now) : null;
    if (!budget) return { ...decision, reason: 'usage-unknown' };

    decision.phase = budget.phase;
    decision.remaining = budget.remaining;
    decision.shortRemaining = budget.shortRemaining;
    decision.windowEndsAt = new Date(budget.reset).toISOString();
    if (Math.min(budget.reset, budget.shortReset ?? Infinity) - now <= LAUNCH_MARGIN) return { ...decision, reason: 'reset-too-close' };

    const eligible = tasks.filter(task => task.risk === 'low'
        && (!task.frontend || impeccableReady === true)
        && typeof task.id === 'string'
        && Number.isFinite(task.value) && task.value > 0
        && fraction(task.confidence) && task.confidence >= 0.7
        && (mode !== 'chatgpt-plan' || (
            fraction(task.weeklyFraction) && task.weeklyFraction > 0
            && (budget.shortRemaining === null || (fraction(task.shortFraction) && task.shortFraction > 0))
        ))
        && budget.fits(task));
    const score = task => task.value * task.confidence / budget.cost(task);
    eligible.sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id, 'en'));
    const task = eligible[0]?.id ?? null;
    return { ...decision, task, reason: task ? 'eligible-for-review' : 'no-eligible-task' };
}
