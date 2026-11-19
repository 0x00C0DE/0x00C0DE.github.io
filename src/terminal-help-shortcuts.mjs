export const HELP_SHORTCUTS = Object.freeze([
    ['List files', 'ls'], ['Read blog', 'cat blog.txt'], ['Command history', 'history']
]);

export function prepareHelpCommand(command, prepare) {
    if (!HELP_SHORTCUTS.some(([, value]) => value === command)) return false;
    prepare(command);
    return true;
}
