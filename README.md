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
![Pretext](https://img.shields.io/badge/Pretext-terminal%20integrated-B22222?style=flat-square)

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
9. [Testing](#testing)
10. [Usage — Shell Commands](#usage--shell-commands)
11. [License](#license)

---

## Overview

`0x00C0DE.github.io` is a **browser-based Unix-like terminal** that serves as a developer portfolio. The entire UI is a scrollable command-line interface rendered inside a `<div>` with no terminal emulator libraries and no framework dependencies. Navigation, blog posting, project browsing, ASCII art rendering, QR/TOTP enrollment, webcam-to-glyph conversion, and password-gated blog deletion are driven by a small JavaScript shell engine.

The design philosophy is **file-system-first**: documentation lives as real `.txt` files fetched over HTTP at runtime, mirroring how a real terminal would `cat` files off disk. This keeps content versionable, diffable, and human-readable without introducing a database or build step.

The live blog still centers on `blog.txt`, but the Worker now supports three media storage modes inside that document: inline `[image-base64]` blocks for `png/jpg/jpeg/webp`, compact reversible `[image-z85]` blocks for smaller GIF payloads, and hosted `[image-url]` blocks for larger GIF or MP4 assets served through the Worker from `R2` with private `B2` fallback.

The latest terminal updates integrate **Pretext** directly into the live render path and add a constrained `su` session toggle. Plain text output, echoed commands, wrapped links, and the `help` descriptions now reflow through a link-aware layout engine that behaves correctly on mobile and on browser resize, while `su` now only supports `su` for `root` and `su guest` for the default guest shell.

When the prompt is running as `root`, the terminal also enables a red animated glyph-rain background and root-colored prompt text. Switching back with `su guest` restores the original CRT background and standard prompt styling.

Credit to Cheng Lou for the original [Pretext](https://github.com/chenglou/pretext) project, the pure JavaScript/TypeScript multiline text measurement and layout library this terminal integration builds on.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                 BROWSER                                      │
│                                                                              │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────────┐               │
│  │  index.html  │─────→│   term.js    │─────→│  commands.js  │               │
│  │ projects.html│      │  (loop/REPL) │      │ (shell verbs) │               │
│  └──────────────┘      └──────┬───────┘      └──────┬────────┘               │
│                               │                     │                        │
│                     ┌─────────▼─────┐     ┌─────────▼──────────────────┐     │
│                     │  style.css    │     │ terminal-pretext-runtime   │     │
│                     │ (CRT palette) │     │ (DOM wrapping + reflow)    │     │
│                     └───────────────┘     └─────────┬──────────────────┘     │
│                                                     │                        │
│                                   ┌─────────────────▼─────────────────┐      │
│                                   │ terminal-pretext-core.mjs         │      │
│                                   │ vendor/pretext/layout.js          │      │
│                                   │ (tokenization + wrapped lines)    │      │
│                                   └─────────────────┬─────────────────┘      │
│                                                     │                        │
│                     ┌───────────────┐      ┌────────▼────────┐               │
│                     │ pictures.js   │      │ <canvas> / DOM  │               │
│                     │ (ASCII/video) │      │ rendered output │               │
│                     └───────────────┘      └─────────────────┘               │
└──────────────────────────────────────────────────────────────────────────────┘
          │ fetch()                                 │ fetch()/POST
          ▼                                         ▼
  ┌───────────────┐                      ┌────────────────────────────┐
  │   .txt files  │                      │      Cloudflare Worker     │
  │ (content DB)  │                      │ blog append/image/visitor  │
  │ blog.txt      │                      │ endpoints backed by GitHub │
  │ projects.txt  │                      └────────────────────────────┘
  │ links.txt     │
  │ readme.txt    │
  │ etc.          │
  └───────────────┘
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
commands.js sends line output into the terminal renderer
      │
      ▼
Pretext wraps visible rows while preserving terminal links
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

`post --image` and inline-image posts share the same Worker path. PNG/JPEG/JPG/WEBP images remain inline in `blog.txt`, while hosted media blocks now cover larger GIFs and MP4 uploads through `/api/blog/media/...`.

---

## File Structure

```
0x00C0DE.github.io/
│
├── index.html                        # Main terminal entry page
├── projects.html                     # Projects-focused terminal entry page
│
├── project-bloom-filters.html        # Project deep-dive: Bloom Filters
├── project-collision-avoidance.html  # Project deep-dive: Collision Avoidance
├── project-proprts.html              # Project deep-dive: Property System
├── project-qr-totp.html              # Project deep-dive: QR/TOTP
├── project-shellcode-template.html   # Project deep-dive: Shellcode Template
├── project-smallsh.html              # Project deep-dive: smallsh Unix shell
│
├── term.js                           # Terminal REPL engine, prompt rendering, and root visual effects
├── commands.js                       # Shell commands, fetch/post logic, Pretext bridge
├── pictures.js                       # ASCII/glyph image rendering + webcam support
├── style.css                         # CRT palette, root visual mode, terminal layout, mobile help grid
├── terminal-session-core.mjs         # Pure session state for prompt/su behavior
├── terminal-visuals-core.mjs         # Pure helpers for root-only animated glyph rain
├── terminal-pretext-core.mjs         # Link-aware tokenization and wrapped-line slicing
├── terminal-pretext-runtime.mjs      # Browser Pretext renderer + resize reflow
├── pretext-lab.html                  # Standalone layout lab for Pretext experiments
├── pretext-lab.mjs                   # Browser controller for the lab
├── pretext-lab-core.mjs              # Shared lab state and query serialization helpers
│
├── blog.txt                          # Live blog, appended via Cloudflare Worker
├── projects.txt                      # Project listing
├── links.txt                         # Curated external links
├── bloom.txt                         # Bloom filter project documentation
├── smallsh.txt                       # smallsh shell project documentation
├── shellcode.txt                     # Shellcode template project documentation
├── qr-totp.txt                       # QR/TOTP project documentation
├── proprts.txt                       # Property system project documentation
├── amr.txt                           # AMR project notes
├── readme.txt                        # In-terminal readme served by `cat readme.txt`
│
├── resume.pdf                        # Downloadable resume
│
├── backend/                          # Local backend/server helpers
├── worker/                           # Cloudflare Worker package and deployment scripts
├── tests/                            # Node tests for session, visuals, and Pretext logic
├── vendor/pretext/                   # Vendored Pretext runtime used in-browser
│
├── wrangler.jsonc                    # Worker configuration
├── .gitignore
├── LICENSE
└── README.md                         # You are here
```

> **Note:** All `.txt` files serve a dual purpose. They are valid plain-text documents and the terminal's live data source. Running `cat <file>.txt` in the terminal fetches the canonical file over HTTP exactly as it appears in the repo.

> **Pretext update:** the standalone lab still exists, but Pretext now also powers the production terminal renderer on the live site.

---

## Core Modules

### `term.js` — Terminal REPL

Responsibilities:
- Renders the prompt (`guest@localhost:/home/0x00C0DE/Unkn0wn$`) and input cursor into the terminal container
- Maintains command history and input handling
- Streams multi-line output into the DOM while preserving scroll position
- Handles `Ctrl+C`, `clear`, and boot-command execution
- Boots each entry page through `bootTerminalSite(...)`
- Switches between the default guest shell and the root shell prompt state
- Enables the animated glyph-rain background only while the terminal user is `root`
- Waits for the Pretext runtime before the first command renders
- Calls `initVisitorTracking()` for lightweight analytics
- Renders password-gated delete buttons for blog images and whole blog entries returned by `cat blog.txt`

```
setupTerminal()
    └── attachKeyListeners()
            ├── Enter  → parseInput() → executeCommand()
            ├── ↑ / ↓  → historyNavigate()
            └── Ctrl+C → abortCurrentCommand()
```

### `commands.js` — Shell Verbs

The terminal command map in `term.js` routes each shell verb to its handler, with most command behavior implemented in `commands.js`. Active commands:

| Command | Description |
|---|---|
| `banner` | Renders the ASCII art welcome screen |
| `cat <file>` | Fetches a `.txt` file and streams it to the terminal |
| `clear` | Clears terminal output and rebuilds the prompt |
| `date` | Prints the browser's current date/time string |
| `echo <text>` | Prints the provided text back to the terminal |
| `fortune` | Displays a random quote from the fortune endpoint |
| `github` | Opens the GitHub profile in a new tab |
| `help` | Prints the command reference |
| `history` | Prints recent command history |
| `instagram` | Opens Instagram in a new tab |
| `linkedin` | Opens LinkedIn in a new tab |
| `ls` | Lists the available terminal-readable `.txt` files |
| `movie [w h]` | Activates webcam to live ASCII/glyph output |
| `picture [w h]` | Renders a built-in ASCII portrait |
| `post <text>` | Appends a text-only blog entry through the Worker |
| `post --image [text]` | Appends one selected `png/jpg/jpeg/webp/gif/mp4` media file |
| `post ... [image] ...` | Inserts one selected image inline between text blocks |
| `pretext [text]` | Reports terminal Pretext status or opens the lab with `pretext lab [text]` |
| `projects` | Opens the dedicated projects terminal page |
| `pwd` | Prints the simulated working directory |
| `qr-totp ...` | Browser-side QR enrollment, QR export, and TOTP generation/verification |
| `resume` | Opens `resume.pdf` in a new tab |
| `su` / `su guest` | Switches only between the `root` shell and the default `guest` shell |
| `userpic [w h]` | Converts an uploaded or captured photo to ASCII art |
| `visitors` | Renders the live visitor stats widget |
| `whoami` | Prints the current simulated terminal username |
| `youtube` | Opens YouTube in a new tab |

Commands that require async I/O (`cat`, `post`, `fortune`, `movie`, `userpic`, `qr-totp`, `visitors`) return Promises and can be aborted mid-execution.

For blog rendering, `cat blog.txt` now understands inline base64 image blocks, compact reversible GIF blocks, and hosted media URL blocks for GIF and MP4 assets. It also attaches password-gated delete controls to rendered blog media and whole entries.

`commands.js` also exposes the terminal text rendering bridge. It lazy-loads `terminal-pretext-runtime.mjs`, routes plain string output through Pretext when available, falls back to the older regex-based renderer if the module cannot be loaded, parses `[image-base64]`, `[image-z85]`, and `[image-url]` blog blocks, and coordinates the root/guest session toggle plus image/post delete flows with the prompt renderer.

### `terminal-session-core.mjs` — Session State

Responsibilities:
- Normalizes the simulated shell session into a small pure state object
- Restricts `su` transitions to two supported targets: implicit `root` and explicit `guest`
- Produces the prompt snapshot consumed by the browser renderer and `whoami` / `pwd`

### `terminal-visuals-core.mjs` — Root Visual Helpers

Responsibilities:
- Decides whether the root-only animated background should be active
- Builds randomized falling glyph columns for the root shell visual mode
- Mutates glyph streams over time so columns change while they fall instead of remaining static

### `terminal-pretext-core.mjs` — Link-aware Wrapping Adapter

Responsibilities:
- Tokenizes terminal strings into plain-text and link fragments
- Preserves terminal link metadata while Pretext splits content into visual lines
- Allows a single link to remain clickable even when it spans multiple wrapped rows
- Provides a pure, testable adapter shared by the browser runtime and unit tests

### `terminal-pretext-runtime.mjs` — Browser Layout Runtime

Responsibilities:
- Imports the vendored `vendor/pretext/layout.js` runtime on demand
- Measures container width, computed font, and line height in the browser
- Renders wrapped output as DOM rows while preserving anchors and text fragments
- Reflows terminal output on resize so mobile layouts stay aligned

### `pictures.js` — ASCII / Glyph Renderer

Converts raster image data to terminal-style character art using a luminance-to-glyph mapping:

```
Luminance range  →  Glyph character
────────────────────────────────────
0.00 – 0.10      →  █  (full block)
0.10 – 0.25      →  ▓
0.25 – 0.45      →  ▒
0.45 – 0.60      →  ░
0.60 – 0.75      →  :
0.75 – 0.88      →  .
0.88 – 1.00      →  (space)
```

For webcam mode, `getUserMedia()` captures frames into a hidden `<canvas>`, samples the pixel buffer, maps each sample to a glyph, and writes the resulting string into the terminal container to produce live ASCII video.

### `style.css` — CRT Palette

The visual design uses a dark CRT aesthetic:

```
Background:    #0a0a0a   (near-black)
Primary text:  #cc0000   (deep red)
Accent:        #ff3333   (bright red for prompt)
Muted:         #550000   (dark red for inactive elements)
Font:          monospace stack with Courier New styling
```

The stylesheet also contains the Pretext-specific layout classes and the root-only visual mode:
- `.terminal-pretext-enabled` and `.terminal-pretext-row` for wrapped terminal rows
- `.terminal-help-entry` for the help command's three-column grid layout
- Mobile-safe wrapping rules that keep long help descriptions in the right-hand column instead of drifting under the command name
- Root prompt and background styles that only activate when the terminal session is `root`

---

## Data Model

The site has **no database**. Persistent content lives in versioned `.txt` files in the repo root:

```
┌──────────────┬─────────────────────────────────────────────────────────────┐
│ File         │ Contents                                                    │
├──────────────┼─────────────────────────────────────────────────────────────┤
│ blog.txt     │ Chronological blog entries appended by Worker               │
│ projects.txt │ Project index with names, blurbs, and links                 │
│ links.txt    │ Curated URL list with descriptions                          │
│ bloom.txt    │ Full Bloom filter project write-up                          │
│ smallsh.txt  │ Unix shell project documentation                            │
│ shellcode.txt│ Shellcode template notes                                    │
│ qr-totp.txt  │ QR and TOTP implementation notes                            │
│ proprts.txt  │ Property system project notes                               │
│ amr.txt      │ AMR-related project documentation                           │
│ readme.txt   │ In-terminal orientation file                                │
└──────────────┴─────────────────────────────────────────────────────────────┘
```

Because `cat` fetches files at runtime over HTTP, content updates are live as soon as a commit lands on `main`. Authorized delete actions remove the matching media block or full entry from `blog.txt`, and hosted GIF or MP4 deletes also cascade into `R2` or `B2`.

---

## Projects

Each project has a dedicated `.html` page and, where applicable, a corresponding `.txt` file for terminal-native reading:

| Project | Description | Files |
|---|---|---|
| **Bloom Filters** | Probabilistic data structure implementation and analysis | `bloom.txt`, `project-bloom-filters.html` |
| **Collision Avoidance** | Autonomous collision detection system | `project-collision-avoidance.html` |
| **Property System (proprts)** | Custom property and trading-system write-up | `proprts.txt`, `project-proprts.html` |
| **QR + TOTP** | Browser-side QR enrollment, QR export, and TOTP tooling | `qr-totp.txt`, `project-qr-totp.html` |
| **Shellcode Template** | x86/x64 shellcode scaffolding for security research | `shellcode.txt`, `project-shellcode-template.html` |
| **smallsh** | A POSIX-subset shell written in C | `smallsh.txt`, `project-smallsh.html` |

Browse from the terminal:

```text
$ projects
$ cat bloom.txt
$ cat smallsh.txt
```

---

## Backend & Worker

### Blog Write Path

The `post` command enables live, authenticated blog posting from the terminal directly into the repo:

```
                  Browser
                     │
      POST /api/blog/append {"text": "..."}
                     │
                     ▼
          ┌──────────────────────────┐
          │    Cloudflare Worker     │
          │                          │
          │ 1. Validate request      │
          │ 2. Fetch blog.txt        │
          │ 3. Append content        │
          │ 4. PUT updated blob      │
          │ 5. Commit to main        │
          └──────────────────────────┘
                     │
                     ▼
             github.com/.../blog.txt
```

The Worker acts as a thin authenticated proxy between the public terminal UI, the GitHub API, and hosted blog media storage. The same package now serves `/api/blog/append`, `/api/blog/delete-image`, `/api/blog/delete-entry`, `/api/blog/media/...`, and visitor endpoints while `R2QuotaGuard` and `B2QuotaGuard` Durable Objects enforce conservative storage and operation thresholds before either provider reaches its free-tier limit.

Secrets live in Cloudflare environment variables and are not committed to the repo. Current runtime secrets include `GITHUB_PAT`, `BLOG_IMAGE_DELETE_PASSWORD`, `B2_APPLICATION_KEY`, and `CLOUDFLARE_BILLING_API_TOKEN`.

Inline `png/jpg/jpeg/webp` images stay inside `blog.txt`, compact GIF payloads can still be serialized directly into the file, and larger GIF or MP4 uploads are stored as hosted Worker media URLs with `R2` as the primary store and private `B2` as the backup. The Worker also blocks posts and deletes while GitHub Pages is still catching up to the previous `blog.txt` commit so the live site and the repo do not drift.

### Directories

- `backend/` contains local backend/server helpers
- `worker/` contains the Worker package, `worker/wrangler.jsonc`, and deployment entry points

---

## Deployment

The frontend is deployed via **GitHub Pages** and served directly from the `main` branch root.

```
Push to main
    │
    ▼
GitHub Pages publishes the updated frontend
    │
    ├── index.html        → https://0x00c0de.github.io/
    ├── projects.html     → https://0x00c0de.github.io/projects.html
    ├── project-*.html    → https://0x00c0de.github.io/project-*.html
    └── *.txt             → https://0x00c0de.github.io/*.txt
```

Cache busting is handled manually through version query strings in the terminal entry pages:

```html
<script src="commands.js?v=20260403c"></script>
<script src="term.js?v=20260403j"></script>
<script src="pictures.js?v=20260331b"></script>
<link rel="stylesheet" href="style.css?v=20260403i">
```

Frontend-only changes go live with a push to `main`. A separate Worker redeploy is only needed when `backend/`, `worker/`, or `worker/wrangler.jsonc` changes.

---

## Testing

The recent terminal updates were added with red/green TDD around both the pure adapter/session/visual layers and the Worker-backed blog/media flows before wiring them into the browser runtime.

Current checks:

```bash
node --test tests/terminal-session-core.test.mjs tests/terminal-visuals-core.test.mjs tests/terminal-pretext-core.test.mjs tests/pretext-lab-core.test.mjs
node --check commands.js
node --check term.js
node --check terminal-session-core.mjs
node --check terminal-visuals-core.mjs
node --check terminal-pretext-core.mjs
node --check terminal-pretext-runtime.mjs
node --check worker/src/index.js
node --check worker/src/index.test.js
node worker/src/index.test.js
```

The Pretext lab remains available at [pretext-lab.html](https://0x00c0de.github.io/pretext-lab.html) for manual layout experiments and visual smoke testing.

---

## Usage — Shell Commands

Start at **[https://0x00c0de.github.io](https://0x00c0de.github.io)**. The terminal loads automatically with the `banner` command.

Plain terminal output, echoed commands, and `help` descriptions now use Pretext-backed wrapping, so they reflow cleanly on mobile and when the window width changes. The prompt starts in the original guest shell, `su` switches into `root`, and `su guest` switches back to the guest shell and restores the default background. `cat blog.txt` also renders password-gated delete controls for individual images and entire blog entries.

```text
╔══════════════════════════════════════════════════╗
║  guest@localhost:/home/0x00C0DE/Unkn0wn$         ║
╚══════════════════════════════════════════════════╝

  help                       List all commands
  date                       Show current date and time
  echo hello                 Print text
  history                    Show recent commands
  whoami                     About Braden / 0x00C0DE
  pwd                        Print the simulated working directory
  cat blog.txt               Read the live blog
  cat projects.txt           Browse project list
  cat links.txt              View curated links
  cat readme.txt             In-terminal orientation
  ls                         List available text files
  pretext                    Show terminal Pretext status
  pretext lab hello world    Open the standalone layout lab with preloaded text
  github                     Open GitHub in a new tab
  linkedin                   Open LinkedIn in a new tab
  instagram                  Open Instagram in a new tab
  youtube                    Open YouTube in a new tab
  projects                   Render project index
  resume                     Download resume PDF
  su                         Switch to the root shell
  su guest                   Return to the guest shell
  qr-totp --generate-qr ...  Enroll a QR/TOTP secret in-browser
  qr-totp --get-otp          Generate the current 6-digit code
  fortune                    Random quote
  post <your message>        Append to blog.txt
  post --image [caption]     Append one selected png/jpg/jpeg/webp/gif/mp4 file
  post hello [image] goodbye Insert one selected image inline
  picture                    ASCII portrait
  movie                      Live webcam to ASCII art
  userpic                    Uploaded/captured image to ASCII art
  clear                      Clear terminal output
  visitors                   Show the live visitor widget
  banner                     Re-display welcome art
```

**Deep-link to a command on page load:**

```text
https://0x00c0de.github.io/?command=cat%20blog.txt
```

The `command` URL parameter is parsed by the entry page and passed directly into the terminal boot flow.

When GIF or MP4 media is hosted instead of stored inline, the blog still renders through `cat blog.txt` using Worker-backed media URLs. If `R2` or `B2` guardrails trip, those hosted assets intentionally stop rendering instead of pushing the provider past its configured threshold.

---

## License

```text
MIT License

Copyright (c) 0x00C0DE

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
```

Full text: [LICENSE](./LICENSE)

---

<div align="center">

```text
┌─────────────────────────────────────────────┐
│  guest@localhost:/home/0x00C0DE/Unkn0wn$ █  │
└─────────────────────────────────────────────┘
```

*Built without frameworks. Deployed without pipelines. Documented without databases.*

</div>
