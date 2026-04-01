```
  ██████╗  ██╗  ██╗   ██████╗   ██████╗   ██████╗   ██████╗  ██████╗  ███████╗
 ██╔═████╗ ╚██╗██╔╝  ██╔═████╗ ██╔═████╗ ██╔════╝  ██╔═████╗ ██╔══██╗ ██╔════╝
 ██║██╔██║  ╚███╔╝   ██║██╔██║ ██║██╔██║ ██║       ██║██╔██║ ██║  ██║ █████╗
 ████╔╝██║  ██╔██╗   ████╔╝██║ ████╔╝██║ ██║       ████╔╝██║ ██║  ██║ ██╔══╝
 ╚██████╔╝ ██╔╝ ██╗  ╚██████╔╝ ╚██████╔╝ ╚██████╗  ╚██████╔╝ ██████╔╝ ███████╗
  ╚═════╝  ╚═╝  ╚═╝   ╚═════╝   ╚═════╝   ╚═════╝   ╚═════╝  ╚═════╝  ╚══════╝
                         T E R M I N A L   P O R T F O L I O
```

<div align="center">

![JavaScript](https://img.shields.io/badge/JavaScript-82.5%25-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![HTML](https://img.shields.io/badge/HTML-10.6%25-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS-6.9%25-1572B6?style=flat-square&logo=css3&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![Deployed](https://img.shields.io/badge/Deployed-GitHub%20Pages-181717?style=flat-square&logo=github)
![Commits](https://img.shields.io/badge/Commits-66-red?style=flat-square)

**A static, browser-native terminal emulator built as an interactive portfolio.**  
No frameworks. No build steps. Pure JavaScript + HTML + CSS.

[**→ Live Site**](https://0x00c0de.github.io) · [**→ Source**](https://github.com/0x00C0DE/0x00C0DE.github.io)

</div>

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [Core Modules](#core-modules)
5. [Data Model](#data-model)
6. [Projects](#projects)
7. [Backend & Worker](#backend--worker)
8. [Deployment](#deployment)
9. [Usage — Shell Commands](#usage--shell-commands)
10. [License](#license)

---

## Overview

`0x00C0DE.github.io` is a **browser-based Unix-like terminal** that serves as a developer portfolio. The entire UI is a scrollable command-line interface rendered inside a `<div>` — no actual terminal emulator libraries, no framework dependencies. Navigation, blog posting, project browsing, ASCII art rendering, and webcam-to-glyph conversion are all driven by a small, self-contained JavaScript shell engine.

The design philosophy is **file-system-first**: documentation lives as real `.txt` files fetched over HTTP at runtime, mirroring how a real terminal would `cat` files off disk. This means content is versionable, diffable, and human-readable without ever touching JavaScript.

---

## Architecture

```
BROWSER

  index.html
      |
      v
    term.js  <------------------------------+
      |                                     |
      +--> style.css                        |
      |                                     |
      +--> commands.js ---------------------+
              |
              +--> pictures.js --> <canvas id="canvas">
              |
              +--> fetch() --> .txt files
              |                (blog.txt, projects.txt, links.txt, etc.)
              |
              +--> fetch() --> Cloudflare Worker
                               (blog POST -> GitHub API -> blog.txt)
```

**Request flow for `cat blog.txt`:**

```
User types "cat blog.txt"
      │
      ▼
term.js parses input → dispatches to commands.js::cat()
      │
      ▼
fetch("blog.txt") over HTTP
      │
      ▼
Response text streamed line-by-line into terminal <div>
      │
      ▼
Terminal scrolls to bottom
```

**Request flow for `post <message>`:**

```
User types "post Hello world"
      │
      ▼
commands.js::post() → POST to Cloudflare Worker endpoint
      │
      ▼
Worker validates request → calls GitHub Contents API
      │
      ▼
GitHub API appends entry to blog.txt → commits to main branch
      │
      ▼
Next `cat blog.txt` reflects the new entry live
```

---

## File Structure

```
0x00C0DE.github.io/
│
├── index.html                     # Single-page entry point; bootstraps terminal
├── projects.html                  # Alternate projects listing view
│
├── project-bloom-filters.html     # Project deep-dive: Bloom Filters
├── project-collision-avoidance.html  # Project deep-dive: Collision Avoidance
├── project-proprts.html           # Project deep-dive: Property System
├── project-qr-totp.html           # Project deep-dive: QR/TOTP
├── project-shellcode-template.html   # Project deep-dive: Shellcode Template
├── project-smallsh.html           # Project deep-dive: smallsh Unix shell
│
├── term.js                        # Terminal REPL engine (prompt, history, render)
├── commands.js                    # All shell commands (cat, post, fortune, resume…)
├── pictures.js                    # ASCII/glyph image rendering + webcam support
├── style.css                      # Dark-red CRT terminal palette + layout
│
├── blog.txt                       # Live blog — appended via Cloudflare Worker
├── projects.txt                   # Project listing (machine & human readable)
├── links.txt                      # Curated external links
├── bloom.txt                      # Bloom filter project documentation
├── smallsh.txt                    # smallsh shell project documentation
├── shellcode.txt                  # Shellcode template project documentation
├── qr-totp.txt                    # QR/TOTP project documentation
├── proprts.txt                    # Property system project documentation
├── amr.txt                        # AMR project notes
├── readme.txt                     # In-terminal readme (served by `cat readme.txt`)
│
├── resume.pdf                     # Downloadable résumé (triggered by `resume`)
│
├── backend/                       # Cloudflare Worker source for blog backend
├── worker/                        # Additional worker configuration / secrets
│
├── .gitignore
├── LICENSE                        # MIT
└── README.md                      # ← you are here
```

> **Note:** All `.txt` files serve a dual purpose — they are valid plain-text documents *and* the terminal's live data source. Running `cat <file>.txt` in the terminal fetches the canonical file via HTTP, exactly as it appears in the repo.

---

## Core Modules

### `term.js` — Terminal REPL

Responsibilities:
- Renders the prompt (`guest@0x00C0DE:~$`) and input cursor into the terminal `<div>`
- Maintains a circular command history buffer (↑/↓ navigation)
- Streams multi-line output into the DOM asynchronously, preserving scroll position
- Handles `Ctrl+C` interrupt, `Tab` autocomplete stubs, and `clear` resets
- Exposes `executeCommand(cmd)` globally so `index.html` can fire a boot command via URL param (`?command=banner`)
- Calls `initVisitorTracking()` for lightweight, privacy-respecting analytics (no cookies)

```
setupTerminal()
    └── attachKeyListeners()
            ├── Enter → parseInput() → executeCommand()
            ├── ↑/↓  → historyNavigate()
            └── Ctrl+C → abortCurrentCommand()
```

### `commands.js` — Shell Verbs

Each exported function maps 1:1 to a terminal command. Key commands:

| Command | Description |
|---|---|
| `banner` | Renders the ASCII art welcome screen (default on load) |
| `cat <file>` | `fetch()`es a `.txt` file and streams it to the terminal |
| `ls` | Lists available commands and files |
| `projects` | Renders the projects index from `projects.txt` |
| `resume` | Triggers download of `resume.pdf` |
| `post <text>` | POSTs to the Cloudflare Worker; appends a dated entry to `blog.txt` |
| `fortune` | Async call to a fortune API; displays a random quote |
| `whoami` | Prints owner bio block |
| `links` | Fetches and renders `links.txt` |
| `picture` | Renders a built-in ASCII portrait via `pictures.js` |
| `webcam` | Activates webcam → live glyph stream on `<canvas>` |
| `help` | Prints the command reference |
| `clear` | Clears terminal output |

Commands that require async I/O (`cat`, `post`, `fortune`, `webcam`) return Promises and can be aborted mid-execution.

### `pictures.js` — ASCII / Glyph Renderer

Converts raster image data to terminal-style character art using a **luminance-to-glyph** mapping:

```
Luminance range  →  Glyph character
─────────────────────────────────────
0.00 – 0.10      →  █  (full block)
0.10 – 0.25      →  ▓
0.25 – 0.45      →  ▒
0.45 – 0.60      →  ░
0.60 – 0.75      →  :
0.75 – 0.88      →  .
0.88 – 1.00      →  (space)
```

For **webcam mode**, `getUserMedia()` captures frames at ~15fps into a hidden `<canvas>`, the pixel buffer is sampled, each pixel is mapped to a glyph, and the resulting string is written directly into the terminal container — producing live ASCII video.

### `style.css` — CRT Palette

The visual design uses a dark CRT aesthetic:

```
Background:    #0a0a0a   (near-black)
Primary text:  #cc0000   (deep red — "blood terminal")
Accent:        #ff3333   (bright red for prompt)
Muted:         #550000   (dark red for inactive elements)
Font:          monospace stack (system mono fallback chain)
```

Terminal container uses `overflow-y: scroll` with a hidden scrollbar, `white-space: pre-wrap` for correct glyph alignment, and a subtle `text-shadow` for glow effect.

---

## Data Model

The site has **no database**. All persistent state lives in versioned `.txt` files in the repo root:

| File | Contents |
|---|---|
| `blog.txt` | Chronological blog entries appended by the Worker |
| `projects.txt` | Project index: name, one-liner, link |
| `links.txt` | Curated URL list with descriptions |
| `bloom.txt` | Full Bloom filter project write-up |
| `smallsh.txt` | Unix shell (C) project documentation |
| `shellcode.txt` | x86/x64 shellcode template notes |
| `qr-totp.txt` | QR + TOTP implementation notes |
| `proprts.txt` | Property system project notes |
| `amr.txt` | AMR-related project documentation |
| `readme.txt` | In-terminal help / orientation file |

Because `cat` fetches files at runtime over HTTP (with `Cache-Control: no-cache` set in `index.html`), content updates are live as soon as a commit lands on `main` — no build pipeline required.

---

## Projects

Each project has a dedicated `.html` page and a corresponding `.txt` file for terminal-native reading. Projects accessible from the terminal:

| Project | Description | Files |
|---|---|---|
| **Bloom Filters** | Probabilistic data structure implementation and analysis | `bloom.txt`, `project-bloom-filters.html` |
| **Collision Avoidance** | Autonomous collision detection system | `project-collision-avoidance.html` |
| **Property System (proprts)** | Custom property/ECS-style system | `proprts.txt`, `project-proprts.html` |
| **QR + TOTP** | QR code generation + Time-based OTP implementation | `qr-totp.txt`, `project-qr-totp.html` |
| **Shellcode Template** | x86/x64 shellcode scaffolding for security research | `shellcode.txt`, `project-shellcode-template.html` |
| **smallsh** | A POSIX-subset shell written in C (CS 344 project) | `smallsh.txt`, `project-smallsh.html` |

Browse from the terminal:
```
$ projects
$ cat bloom.txt
$ cat smallsh.txt
```

Or navigate directly to `/projects.html` or any `project-*.html` page.

---

## Backend & Worker

### Blog Write Path

The `post` command enables live, authenticated blog posting from the terminal directly into the GitHub repo:

```
                  Browser
                     │
        POST /post  {"text": "..."}
                     │
                     ▼
          ┌──────────────────────┐
          │  Cloudflare Worker   │
          │  (backend/ or        │
          │   worker/ directory) │
          │                      │
          │  1. Validate token   │
          │  2. Fetch blog.txt   │
          │     from GitHub API  │
          │  3. Append entry     │
          │  4. PUT blob back    │
          │     via GitHub API   │
          │  5. Commit to main   │
          └──────────────────────┘
                     │
                     ▼
             github.com/...
             blog.txt updated
             in-place on main
```

The Worker acts as a thin authenticated proxy between the public terminal UI and the GitHub Contents REST API. Secrets (GitHub PAT, shared key) are stored as Cloudflare Worker environment variables — **never committed to the repo**.

### Directories

- **`backend/`** — Cloudflare Worker source code for the blog posting endpoint
- **`worker/`** — Additional worker config, wrangler settings, or per-route handlers

---

## Deployment

The site is deployed via **GitHub Pages** with zero configuration — the `main` branch root is the web root.

```
Push to main
    │
    ▼
GitHub Pages picks up changes immediately
    │
    ├── index.html        → https://0x00c0de.github.io/
    ├── projects.html     → https://0x00c0de.github.io/projects.html
    ├── project-*.html    → https://0x00c0de.github.io/project-*.html
    └── *.txt             → https://0x00c0de.github.io/*.txt  (fetched at runtime)
```

Cache busting is handled manually via version query strings in `index.html`:

```html
<script src="commands.js?v=20260331t"></script>
<script src="term.js?v=20260331e"></script>
<script src="pictures.js?v=20260331b"></script>
<link rel="stylesheet" href="style.css?v=20260331f">
```

The `meta http-equiv="Cache-Control" content="no-cache"` header instructs browsers not to cache the HTML entry point, ensuring `.txt` file fetches always hit the origin.

---

## Usage — Shell Commands

Start at **[https://0x00c0de.github.io](https://0x00c0de.github.io)** — the terminal loads automatically with the `banner` command.

```
╔══════════════════════════════════════════════════╗
║  guest@0x00C0DE:~$                               ║
╚══════════════════════════════════════════════════╝

  help                      List all commands
  whoami                    About Braden / 0x00C0DE
  cat blog.txt              Read the live blog
  cat projects.txt          Browse project list
  cat links.txt             View curated links
  cat readme.txt            In-terminal orientation
  projects                  Render project index
  resume                    Download résumé PDF
  fortune                   Random quote (async)
  post <your message>       Append to blog.txt
  picture                   ASCII portrait
  webcam                    Live webcam → ASCII art
  clear                     Clear terminal output
  banner                    Re-display welcome art
```

**Deep-link to a command on page load:**
```
https://0x00c0de.github.io/?command=cat%20blog.txt
```
The `command` URL parameter is parsed by `index.html` and passed directly to `executeCommand()`.

---

## License

```
MIT License

Copyright (c) 0x00C0DE

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software...
```

Full text: [LICENSE](./LICENSE)

---

<div align="center">

```
┌─────────────────────────────────────────────┐
│  guest@0x00C0DE:~$ █                        │
└─────────────────────────────────────────────┘
```

*Built without frameworks. Deployed without pipelines. Documented without databases.*

</div>
