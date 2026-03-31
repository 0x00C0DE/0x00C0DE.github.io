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
    projects: projects_command,
    pwd: pwd_command,
    resume: resume_command,
    whoami: whoami_command,
    youtube: youtube_command
};

function promptMarkup() {
    return `<span class="prompt-user">${PROMPT_USER}</span><span class="header">@</span><span class="prompt-host">${PROMPT_HOST}</span><span class="header">:</span><span class="prompt-path">${PROMPT_PATH}</span><span class="header">$ </span>`;
}

function setupTerminal() {
    document.getElementById("terminal").innerHTML = `<div class="input-line">${promptMarkup()}<input type="text" class="terminal-input" id="command-input" autocomplete="off"></div>`;
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
