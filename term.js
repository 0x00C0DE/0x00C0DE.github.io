const PROMPT_USER = "guest";
const PROMPT_HOST = "localhost";
const PROMPT_PATH = "/home/0x00C0DE/Unkn0wn";

let commandHistory = [];
let historyIndex = -1;

const commandHandlers = new Map([
    ['help', help_command],
    ['banner', banner_command],
    ['cat', cat_command],
    ['date', date_command],
    ['echo', echo_command],
    ['fortune', fortune_command],
    ['github', github_command],
    ['history', history_command],
    ['instagram', instagram_command],
    ['linkedin', linkedin_command],
    ['ls', ls_command],
    ['movie', movie_command],
    ['picture', picture_command],
    ['post', post_command],
    ['projects', projects_command],
    ['pwd', pwd_command],
    ['qr-totp', qr_totp_command],
    ['resume', resume_command],
    ['userpic', userpic_command],
    ['visitors', visitors_command],
    ['whoami', whoami_command],
    ['youtube', youtube_command]
]);

function appendPrompt(container) {
    const parts = [
        ['prompt-user', PROMPT_USER],
        ['header', '@'],
        ['prompt-host', PROMPT_HOST],
        ['header', ':'],
        ['prompt-path', PROMPT_PATH],
        ['header', '$ ']
    ];

    parts.forEach(([className, text]) => {
        const span = document.createElement('span');
        span.className = className;
        span.textContent = text;
        container.append(span);
    });
}

function getSafeHref(href) {
    try {
        const parsed = new URL(href, window.location.href);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.toString();
        }
    } catch {
        // Fall through to a harmless default.
    }

    return '#';
}

function getSafeImageHref(href) {
    const safeHref = getSafeHref(href);
    if (safeHref === '#') {
        return '';
    }

    try {
        const parsed = new URL(safeHref);
        const hostname = parsed.hostname.toLowerCase();
        if (
            parsed.origin === window.location.origin ||
            hostname === 'quickchart.io' ||
            hostname.endsWith('.quickchart.io') ||
            hostname === 'i.imgur.com'
        ) {
            return parsed.toString();
        }
    } catch {
        return '';
    }

    return '';
}

function renderOutputObject(container, line) {
    if (!line || typeof line !== 'object') {
        container.textContent = String(line ?? '');
        return;
    }

    if (line.type === 'banner') {
        const banner = document.createElement('div');
        banner.className = 'banner-art';
        banner.textContent = line.title || '';
        container.append(banner);

        if (line.subtitle) {
            const subtitle = document.createElement('div');
            subtitle.className = 'banner-subtitle';
            subtitle.textContent = line.subtitle;
            container.append(subtitle);
        }
        return;
    }

    if (line.type === 'visitor-widget' && typeof window.buildVisitorWidgetElement === 'function') {
        container.append(window.buildVisitorWidgetElement(line.stats));
        return;
    }

    if (line.type === 'text-link') {
        if (line.prefix) {
            container.append(document.createTextNode(line.prefix));
        }
        const anchor = document.createElement('a');
        anchor.href = getSafeHref(line.href || '#');
        anchor.textContent = line.text || line.href || '';
        if (line.newTab) {
            anchor.target = '_blank';
            anchor.rel = 'noreferrer';
        }
        container.append(anchor);
        return;
    }

    if (line.type === 'inline-image') {
        const isSafeSource = typeof window.isSafeBlogImageSource === 'function'
            ? window.isSafeBlogImageSource(line.src)
            : false;

        if (!isSafeSource) {
            container.textContent = '[invalid embedded image]';
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'terminal-inline-image-wrapper';

        if (line.deletable && typeof window.deleteBlogImageByBlockIndex === 'function') {
            const actions = document.createElement('div');
            actions.className = 'terminal-inline-image-actions';

            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'terminal-inline-image-delete';
            deleteButton.textContent = 'delete';

            const status = document.createElement('span');
            status.className = 'terminal-inline-image-status';

            deleteButton.addEventListener('click', async () => {
                const password = window.prompt('Enter delete password');
                if (password === null) {
                    return;
                }

                deleteButton.disabled = true;
                status.textContent = ' deleting...';

                try {
                    const result = await window.deleteBlogImageByBlockIndex(
                        line.imageBlockIndex,
                        password,
                        typeof line.imageKey === 'string' ? line.imageKey : '',
                        typeof line.src === 'string' ? line.src : '',
                        typeof line.entryTimestamp === 'string' ? line.entryTimestamp : '',
                        Number.isInteger(line.entryImageIndex) ? line.entryImageIndex : null,
                        typeof line.previousTextLine === 'string' ? line.previousTextLine : '',
                        typeof line.nextTextLine === 'string' ? line.nextTextLine : ''
                    );
                    if (!result.ok) {
                        status.textContent = ` ${result.error}`;
                        deleteButton.disabled = false;
                        return;
                    }

                    status.textContent = ' deleted';
                    deleteButton.remove();
                    image.remove();
                } catch (error) {
                    status.textContent = ' unable to delete image right now';
                    deleteButton.disabled = false;
                }
            });

            actions.append(deleteButton, status);
            wrapper.append(actions);
        }

        const image = document.createElement('img');
        image.className = 'terminal-inline-image';
        image.src = line.src;
        image.alt = line.alt || 'Embedded blog image';
        image.decoding = 'async';
        image.loading = 'lazy';
        wrapper.append(image);
        container.append(wrapper);
        return;
    }

    container.textContent = typeof line.text === 'string' ? line.text : String(line ?? '');
}

function renderOutputLine(container, line) {
    if (line && typeof line === 'object') {
        renderOutputObject(container, line);
        return;
    }

    if (typeof window.renderTerminalLineContent === 'function') {
        window.renderTerminalLineContent(container, line);
        return;
    }

    container.textContent = String(line ?? '');
}

function renderAsciiLines(element, asciiLines) {
    const lines = Array.isArray(asciiLines) ? asciiLines : [];
    element.textContent = lines.join('\n');
}

function createAsciiViewerShell(options = {}) {
    const viewer = document.createElement('div');
    viewer.className = 'ascii-viewer';

    const toolbar = document.createElement('div');
    toolbar.className = 'ascii-toolbar';

    const title = document.createElement('span');
    title.className = 'ascii-title';
    title.textContent = options.title || 'ascii viewer';

    const actions = document.createElement('div');
    actions.className = 'ascii-actions';

    let saveButton = null;
    if (options.download) {
        saveButton = document.createElement('button');
        saveButton.type = 'button';
        saveButton.className = 'ascii-save';
        saveButton.id = 'ascii-save-button';
        saveButton.textContent = options.download.label || 'save';
        actions.append(saveButton);
    }

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'ascii-close';
    closeButton.id = 'ascii-close-button';
    closeButton.textContent = 'close';
    actions.append(closeButton);

    toolbar.append(title, actions);

    const hint = document.createElement('div');
    hint.className = 'ascii-hint';
    hint.textContent = options.hint || 'drag to pan, pinch to zoom';

    const scrollRegion = document.createElement('div');
    scrollRegion.className = 'ascii-scroll';
    scrollRegion.id = 'ascii-scroll-region';

    const asciiArt = document.createElement('div');
    asciiArt.id = 'asciiArt';
    scrollRegion.append(asciiArt);

    viewer.append(toolbar, hint, scrollRegion);

    return {
        viewer,
        asciiArt,
        scrollRegion,
        closeButton,
        saveButton
    };
}

function setupTerminal() {
    const terminal = document.getElementById("terminal");
    terminal.classList.remove("viewer-mode");
    terminal.innerHTML = '';
    const inputLine = document.createElement('div');
    inputLine.className = 'input-line';
    appendPrompt(inputLine);
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'terminal-input';
    input.id = 'command-input';
    input.autocomplete = 'off';
    inputLine.append(input);
    terminal.append(inputLine);
    terminal.scrollTop = 0;
    terminal.scrollLeft = 0;
    input.addEventListener("keydown", handleKeyDown);
    input.focus();
}

async function showMovie(args) {
    const width = args[0] ? args[0] : 160;
    const height = args[1] ? args[1] : 80;
    const terminal = document.getElementById("terminal");
    terminal.classList.add("viewer-mode");
    terminal.scrollTop = 0;
    terminal.scrollLeft = 0;
    terminal.replaceChildren();
    const viewer = createAsciiViewerShell({
        title: 'movie',
        hint: 'live camera ascii art, drag to pan, pinch to zoom'
    });
    const videoFeed = document.createElement('video');
    videoFeed.id = 'videoFeed';
    videoFeed.autoplay = true;
    videoFeed.playsInline = true;
    videoFeed.style.display = 'none';
    viewer.viewer.append(videoFeed);
    terminal.append(viewer.viewer);
    const canvas = document.getElementById("canvas");
    canvas.width = width;
    canvas.height = height;
    const asciiArtDiv = viewer.asciiArt;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    videoFeed.srcObject = stream;
    const intervalId = setInterval(function () {
        if (videoFeed.readyState === videoFeed.HAVE_ENOUGH_DATA) {
            context.drawImage(videoFeed, 0, 0, width, height);
            const asciiArt = processImage(context, width, height);
            renderAsciiLines(asciiArtDiv, asciiArt);
        }
    }, 200);

    const restoreTerminal = () => {
        stream.getTracks().forEach(track => track.stop());
        clearInterval(intervalId);
        document.removeEventListener("keydown", handleMovieKeyDown);
        viewer.closeButton.removeEventListener("click", restoreTerminal);
        setupTerminal();
    };

    const handleMovieKeyDown = event => {
        if (event.key === "Escape") {
            restoreTerminal();
        }
    };

    document.addEventListener("keydown", handleMovieKeyDown);
    viewer.closeButton.addEventListener("click", restoreTerminal);
}

function renderAsciiArtToCanvas(asciiLines, options = {}) {
    const lines = Array.isArray(asciiLines) ? asciiLines : [];
    const canvas = document.createElement("canvas");
    const scale = Math.max(1, Math.min(3, Math.ceil(window.devicePixelRatio || 1)));
    const fontSize = options.fontSize || 16;
    const lineHeight = Math.round(fontSize * 1.15);
    const horizontalPadding = options.horizontalPadding || 28;
    const verticalPadding = options.verticalPadding || 28;
    const fontFamily = '"Courier New", monospace';
    const context = canvas.getContext("2d");

    context.font = `${fontSize}px ${fontFamily}`;
    const maxLineWidth = lines.reduce((currentMax, line) => {
        return Math.max(currentMax, Math.ceil(context.measureText(line).width));
    }, 0);

    const logicalWidth = Math.max(320, maxLineWidth + horizontalPadding * 2);
    const logicalHeight = Math.max(200, lines.length * lineHeight + verticalPadding * 2);
    canvas.width = logicalWidth * scale;
    canvas.height = logicalHeight * scale;

    const renderContext = canvas.getContext("2d");
    renderContext.scale(scale, scale);
    renderContext.fillStyle = "#070001";
    renderContext.fillRect(0, 0, logicalWidth, logicalHeight);

    const glow = renderContext.createLinearGradient(0, 0, 0, logicalHeight);
    glow.addColorStop(0, "rgba(85, 10, 16, 0.82)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    renderContext.fillStyle = glow;
    renderContext.fillRect(0, 0, logicalWidth, logicalHeight);

    renderContext.font = `${fontSize}px ${fontFamily}`;
    renderContext.textBaseline = "top";
    renderContext.fillStyle = "#ff5f6d";

    lines.forEach((line, index) => {
        renderContext.fillText(line, horizontalPadding, verticalPadding + index * lineHeight);
    });

    return canvas;
}

function exportCanvasAsBlob(canvas, type = "image/png") {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (!blob) {
                reject(new Error("unable to export image"));
                return;
            }
            resolve(blob);
        }, type);
    });
}

async function downloadAsciiArtImage(asciiLines, options = {}) {
    const canvas = renderAsciiArtToCanvas(asciiLines, options);
    const blob = await exportCanvasAsBlob(canvas, "image/png");
    const filename = options.filename || "ascii-art.png";
    await downloadBlob(blob, filename, options.title || "ASCII art image");
}

async function downloadBlob(blob, filename, title) {
    if (navigator.canShare && typeof File !== "undefined") {
        try {
            const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title
                });
                return;
            }
        } catch (error) {
            if (error && error.name !== "AbortError") {
                console.error("blob share failed", error);
            } else {
                return;
            }
        }
    }

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

async function downloadImageResource(imageUrl, options = {}) {
    const safeImageUrl = getSafeImageHref(imageUrl);
    if (!safeImageUrl) {
        throw new Error("image url is not allowed");
    }

    const response = await fetch(safeImageUrl, { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`unable to fetch image resource (${response.status})`);
    }
    const blob = await response.blob();
    await downloadBlob(blob, options.filename || "image-download.svg", options.title || "Image download");
}

function showImageStill(imageUrl, options = {}) {
    const safeImageUrl = getSafeImageHref(imageUrl);
    if (!safeImageUrl) {
        throw new Error("image url is not allowed");
    }

    const terminal = document.getElementById("terminal");
    terminal.classList.add("viewer-mode");
    terminal.scrollTop = 0;
    terminal.scrollLeft = 0;
    terminal.replaceChildren();
    const viewer = createAsciiViewerShell(options);
    const image = document.createElement("img");
    image.className = "viewer-image";
    image.src = safeImageUrl;
    image.alt = options.title || "image viewer";
    image.decoding = "async";
    viewer.asciiArt.replaceChildren(image);
    terminal.append(viewer.viewer);
    viewer.scrollRegion.scrollTop = 0;
    viewer.scrollRegion.scrollLeft = 0;

    const restoreTerminal = () => {
        document.removeEventListener("keydown", handleImageKeyDown);
        viewer.closeButton.removeEventListener("click", restoreTerminal);
        if (viewer.saveButton) {
            viewer.saveButton.removeEventListener("click", handleImageSave);
        }
        setupTerminal();
    };

    const handleImageKeyDown = event => {
        if (event.key === "Escape") {
            restoreTerminal();
        }
    };

    const handleImageSave = async () => {
        try {
            if (viewer.saveButton) {
                viewer.saveButton.disabled = true;
                viewer.saveButton.textContent = "saving";
            }
            await downloadImageResource(safeImageUrl, {
                filename: options.download && options.download.filename ? options.download.filename : "image-download.svg",
                title: options.title || "Image download"
            });
        } catch (error) {
            console.error("image save failed", error);
        } finally {
            if (viewer.saveButton) {
                viewer.saveButton.disabled = false;
                viewer.saveButton.textContent = options.download && options.download.label ? options.download.label : "save";
            }
        }
    };

    document.addEventListener("keydown", handleImageKeyDown);
    viewer.closeButton.addEventListener("click", restoreTerminal);
    if (viewer.saveButton) {
        viewer.saveButton.addEventListener("click", handleImageSave);
    }
}

function showAsciiStill(asciiLines, options = {}) {
    const terminal = document.getElementById("terminal");
    terminal.classList.add("viewer-mode");
    terminal.scrollTop = 0;
    terminal.scrollLeft = 0;
    terminal.replaceChildren();
    const viewer = createAsciiViewerShell(options);
    terminal.append(viewer.viewer);
    renderAsciiLines(viewer.asciiArt, asciiLines);
    viewer.scrollRegion.scrollTop = 0;
    viewer.scrollRegion.scrollLeft = 0;

    const restoreTerminal = () => {
        document.removeEventListener("keydown", handleAsciiKeyDown);
        viewer.closeButton.removeEventListener("click", restoreTerminal);
        if (viewer.saveButton) {
            viewer.saveButton.removeEventListener("click", handleAsciiSave);
        }
        setupTerminal();
    };

    const handleAsciiKeyDown = event => {
        if (event.key === "Escape") {
            restoreTerminal();
        }
    };

    const handleAsciiSave = async () => {
        try {
            if (viewer.saveButton) {
                viewer.saveButton.disabled = true;
                viewer.saveButton.textContent = "saving";
            }
            await downloadAsciiArtImage(asciiLines, {
                filename: options.download && options.download.filename ? options.download.filename : "ascii-art.png",
                title: options.title || "ASCII art image"
            });
        } catch (error) {
            console.error("ascii save failed", error);
        } finally {
            if (viewer.saveButton) {
                viewer.saveButton.disabled = false;
                viewer.saveButton.textContent = options.download && options.download.label ? options.download.label : "save";
            }
        }
    };

    document.addEventListener("keydown", handleAsciiKeyDown);
    viewer.closeButton.addEventListener("click", restoreTerminal);
    if (viewer.saveButton) {
        viewer.saveButton.addEventListener("click", handleAsciiSave);
    }
}

async function handleKeyDown(e) {
    const input = e.target;
    if (e.key === "Enter") {
        const command = input.value.trim();
        await executeCommand(command);
    } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (historyIndex > 0) {
            historyIndex--;
            input.value = commandHistory[historyIndex];
        }
    } else if (e.key === "ArrowDown") {
        e.preventDefault();
        if (historyIndex < commandHistory.length - 1) {
            historyIndex++;
            input.value = commandHistory[historyIndex];
        } else if (historyIndex === commandHistory.length - 1) {
            historyIndex = commandHistory.length;
            input.value = "";
        }
    } else if (e.key === "Tab") {
        e.preventDefault();
        const partial = input.value.toLowerCase();
        const matches = Array.from(commandHandlers.keys()).filter(cmd => cmd.startsWith(partial));
        if (matches.length === 1) {
            input.value = matches[0];
        }
    }
}

async function executeCommand(commandLine) {
    if (!commandLine) {
        return;
    }
    commandHistory.push(commandLine);
    if (commandHistory.length > 100) {
        commandHistory.shift();
    }
    historyIndex = commandHistory.length;
    const terminal = document.getElementById("terminal");
    const inputLine = terminal.querySelector(".input-line");
    const commandDiv = document.createElement("div");
    commandDiv.className = "terminal-line";
    appendPrompt(commandDiv);
    commandDiv.append(document.createTextNode(commandLine));
    terminal.insertBefore(commandDiv, inputLine);

    const parts = commandLine.split(" ");
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (cmd === "clear") {
        setupTerminal();
        return;
    }
    if (cmd === "movie") {
        showMovie(args);
        return;
    }

    let output = null;
    const commandHandler = commandHandlers.get(cmd);
    if (typeof commandHandler === 'function') {
        output = await commandHandler(args);
    } else {
        output = [`bash: ${cmd}: command not found`];
    }

    if (output && output.length > 0) {
        output.forEach(line => {
            const outputDiv = document.createElement("div");
            outputDiv.className = "terminal-line";
            if (typeof line === 'string' && (line.includes("not found") || line.includes("No such file") || line.includes("Unexpected"))) {
                outputDiv.classList.add("error");
            }
            renderOutputLine(outputDiv, line);
            terminal.insertBefore(outputDiv, inputLine);
        });
    }

    document.getElementById("command-input").value = "";
    terminal.scrollTop = terminal.scrollHeight;
}

document.addEventListener("click", () => {
    const input = document.getElementById("command-input");
    if (input) {
        input.focus();
    }
});

window.setupTerminal = setupTerminal;
window.executeCommand = executeCommand;
window.getPromptPath = () => PROMPT_PATH;
window.getPromptUser = () => PROMPT_USER;
window.getPromptHost = () => PROMPT_HOST;
window.showAsciiStill = showAsciiStill;
window.showImageStill = showImageStill;
