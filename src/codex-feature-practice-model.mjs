const answers = {
    bloom: {
        a: 'Reconsider: all queried bits are set, so the filter cannot prove absence.',
        b: 'Correct: probably present is a false positive for this absent word.',
        c: 'Reconsider: set bits do not prove that a word was inserted.'
    },
    robot: {
        a: 'Reconsider: current clearance is 15, but the proposed segment leaves only 7.',
        b: 'Correct: the proposed forward segment violates the 8-unit gap.',
        c: 'Reconsider: a forward hazard does not mean every steering candidate is blocked.'
    },
    layout: {
        a: 'Correct: measured wrapping can move words onto additional lines.',
        b: 'Reconsider: available width does not set the font size.',
        c: 'Reconsider: the widest measured line can be shorter than the available width.'
    }
};

export function feedback(question, choice) {
    if (!Object.hasOwn(answers, question) || !Object.hasOwn(answers[question], choice)) {
        throw new RangeError('Choose one of the listed predictions.');
    }
    return answers[question][choice];
}
