export function createJob(mode = 'foreground') {
    if (!['foreground', 'background'].includes(mode)) throw new RangeError('Invalid job mode');
    return { mode, stage: 0 };
}

function validate(job) {
    createJob(job.mode);
    if (!Number.isInteger(job.stage) || job.stage < 0 || job.stage > 3) {
        throw new RangeError('Invalid lifecycle stage');
    }
}

export function advanceJob(job) {
    validate(job);
    return { ...job, stage: Math.min(3, job.stage + 1) };
}

export function describeJob(job) {
    validate(job);
    const foreground = job.mode === 'foreground';
    const events = [
        'Command prepared. No child exists yet.',
        `fork creates a child; exec replaces its program. ${foreground
            ? 'Parent waits in waitpid; prompt stays waiting.'
            : 'Parent returns to the prompt while the child runs.'}`,
        'Child exits with status 0. Completion can notify the parent via SIGCHLD; status awaits collection.',
        `waitpid collects exit status 0 and reaps the child. ${foreground
            ? 'Foreground wait returns; prompt is ready.'
            : 'Background completion is collected at a later prompt check.'}`
    ];
    return {
        child: ['Not started', 'Running', 'Completed · not reaped', 'Reaped'][job.stage],
        prompt: foreground && (job.stage === 1 || job.stage === 2) ? 'Waiting' : 'Ready',
        events: events.slice(0, job.stage + 1),
        next: ['Launch child', 'Complete child', 'Reap child', 'Finished'][job.stage]
    };
}
