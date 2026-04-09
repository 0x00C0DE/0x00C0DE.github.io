let terminalCanvasCore = null;
const terminalCanvasCorePromise = import('./terminal-canvas-core.mjs?v=20260409c')
    .then(core => {
        terminalCanvasCore = core;
        return core;
    });

async function withTerminalCanvasCore(callback) {
    const core = await terminalCanvasCorePromise;
    return callback(core);
}

window.setupTerminal = () => withTerminalCanvasCore(core => core.setupTerminal());
window.executeCommand = commandLine => withTerminalCanvasCore(core => core.executeCommand(commandLine));
window.getPromptPath = () => terminalCanvasCore ? terminalCanvasCore.getPromptPath() : '/home/0x00C0DE/Unkn0wn';
window.getPromptUser = () => terminalCanvasCore ? terminalCanvasCore.getPromptUser() : 'guest';
window.getPromptHost = () => terminalCanvasCore ? terminalCanvasCore.getPromptHost() : 'localhost';
window.refreshTerminalInputPrompt = () => withTerminalCanvasCore(core => core.refreshTerminalInputPrompt());
window.refreshTerminalVisitorStats = () => withTerminalCanvasCore(core => core.refreshTerminalVisitorStats());
window.syncTerminalSessionAwareLines = () => withTerminalCanvasCore(core => core.syncTerminalSessionAwareLines());
window.syncTerminalVisualEffects = () => withTerminalCanvasCore(core => core.syncTerminalVisualEffects());
window.showAsciiStill = (asciiLines, options) => withTerminalCanvasCore(core => core.showAsciiStill(asciiLines, options));
window.showImageStill = (imageUrl, options) => withTerminalCanvasCore(core => core.showImageStill(imageUrl, options));
window.showVideo = args => withTerminalCanvasCore(core => core.showVideo(args));
window.showMovie = args => withTerminalCanvasCore(core => core.showVideo(args));
window.bootTerminalSite = defaultCommand => withTerminalCanvasCore(core => core.bootTerminalSite(defaultCommand));
