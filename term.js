const PROMPT_USER = "guest";
const PROMPT_HOST = "localhost";
const PROMPT_PATH = "/home/0x00C0DE/Unk0wn";

let commandHistory = [];
let historyIndex = -1;

const commands = {
    help: help_command,
    banner: banner_command,
    cat: cat_command,
    date: date_command,
    echo: echo_command,
    fortune: fortune_command,
    github: github_command,
    help: help_command,
    history: history_command,
    instagram: instagram_command,
    linkedin: linkedin_command,
    ls: ls_command,
    movie: movie_command,
    picture: picture_command,
    post: post_command,
    projects: projects_command,
    pwd: pwd_command,
    resume: resume_command,
    userpic: userpic_command,
    whoami: whoami_command,
    youtube: youtube_command
};

function promptMarkup() {
    return `<span class="prompt-user">${PROMPT_USER}</span><span class="header">@</span><span class="prompt-host">${PROMPT_HOST}</span><span class="header">:</span><span class="prompt-path">${PROMPT_PATH}</span><span class="header">$ </span>`;
}

function setupTerminal() {
    const terminal = document.getElementById("terminal");
    terminal.classList.remove("viewer-mode");
    terminal.innerHTML = `<div class="input-line">${promptMarkup()}<input type="text" class="terminal-input" id="command-input" autocomplete="off"></div>`;
    const input = document.getElementById("command-input");
    input.addEventListener("keydown", handleKeyDown);
    input.focus();
}

async function showMovie(args) {
    const width = args[0] ? args[0] : 160;
    const height = args[1] ? args[1] : 80;
    document.getElementById("terminal").innerHTML = `<video id="videoFeed" autoplay playsinline></video><div id="asciiArt"></div>`;
    const videoFeed = document.getElementById("videoFeed");
    const canvas = document.getElementById("canvas");
    canvas.width = width;
    canvas.height = height;
    const asciiArtDiv = document.getElementById("asciiArt");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    videoFeed.srcObject = stream;
    const intervalId = setInterval(function () {
        if (videoFeed.readyState === videoFeed.HAVE_ENOUGH_DATA) {
            context.drawImage(videoFeed, 0, 0, width, height);
            const asciiArt = processImage(context, width, height);
            asciiArtDiv.innerHTML = asciiArt.join("<br>");
        }
    }, 200);
    document.addEventListener("keydown", function () {
        stream.getTracks().forEach(track => track.stop());
        clearInterval(intervalId);
        setupTerminal();
    }, { once: true });
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

    if (navigator.canShare && typeof File !== "undefined") {
        try {
            const file = new File([blob], filename, { type: "image/png" });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: options.title || "ASCII art image"
                });
                return;
            }
        } catch (error) {
            if (error && error.name !== "AbortError") {
                console.error("ascii share failed", error);
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

function showAsciiStill(asciiLines, options = {}) {
    const terminal = document.getElementById("terminal");
    terminal.classList.add("viewer-mode");
    terminal.innerHTML = `
        <div class="ascii-viewer">
            <div class="ascii-toolbar">
                <span class="ascii-title">${options.title || "ascii viewer"}</span>
                <div class="ascii-actions">
                    ${options.download ? `<button type="button" class="ascii-save" id="ascii-save-button">${options.download.label || "save"}</button>` : ""}
                    <button type="button" class="ascii-close" id="ascii-close-button">close</button>
                </div>
            </div>
            <div class="ascii-hint">${options.hint || "drag to pan, pinch to zoom"}</div>
            <div class="ascii-scroll" id="ascii-scroll-region">
                <div id="asciiArt"></div>
            </div>
        </div>
    `;
    document.getElementById("asciiArt").innerHTML = asciiLines.join("<br>");

    const restoreTerminal = () => {
        document.removeEventListener("keydown", handleAsciiKeyDown);
        const closeButton = document.getElementById("ascii-close-button");
        if (closeButton) {
            closeButton.removeEventListener("click", restoreTerminal);
        }
        const saveButton = document.getElementById("ascii-save-button");
        if (saveButton) {
            saveButton.removeEventListener("click", handleAsciiSave);
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
            const saveButton = document.getElementById("ascii-save-button");
            if (saveButton) {
                saveButton.disabled = true;
                saveButton.textContent = "saving";
            }
            await downloadAsciiArtImage(asciiLines, {
                filename: options.download && options.download.filename ? options.download.filename : "ascii-art.png",
                title: options.title || "ASCII art image"
            });
        } catch (error) {
            console.error("ascii save failed", error);
        } finally {
            const saveButton = document.getElementById("ascii-save-button");
            if (saveButton) {
                saveButton.disabled = false;
                saveButton.textContent = options.download && options.download.label ? options.download.label : "save";
            }
        }
    };

    document.addEventListener("keydown", handleAsciiKeyDown);
    document.getElementById("ascii-close-button").addEventListener("click", restoreTerminal);
    const saveButton = document.getElementById("ascii-save-button");
    if (saveButton) {
        saveButton.addEventListener("click", handleAsciiSave);
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
        const matches = Object.keys(commands).filter(cmd => cmd.startsWith(partial));
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
    commandDiv.innerHTML = `${promptMarkup()}${commandLine}`;
    terminal.insertBefore(commandDiv, inputLine);

    const parts = commandLine.split(" ");
    const cmd = parts[0];
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
    if (commands[cmd]) {
        output = await commands[cmd](args);
    } else {
        output = [`bash: ${cmd}: command not found`];
    }

    if (output && output.length > 0) {
        output.forEach(line => {
            const outputDiv = document.createElement("div");
            outputDiv.className = "terminal-line";
            if (line.includes("not found") || line.includes("No such file") || line.includes("Unexpected")) {
                outputDiv.classList.add("error");
            }
            outputDiv.innerHTML = line;
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
