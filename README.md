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

![JavaScript](https://img.shields.io/badge/JavaScript-main%20runtime-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![HTML](https://img.shields.io/badge/HTML-entry%20pages-E34F26?style=flat-square&logo=html5&logoColor=white)
![Canvas](https://img.shields.io/badge/Canvas-live%20renderer-8B0000?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)
![Deployed](https://img.shields.io/badge/Deployed-GitHub%20Pages-181717?style=flat-square&logo=github)
![Pretext](https://img.shields.io/badge/Pretext-terminal%20integrated-B22222?style=flat-square)

**A static, browser-native terminal portfolio built around a canvas-first Pretext renderer.**  
No frameworks. No frontend build step. No DOM reflow-driven text layout in the live terminal path.

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

`0x00C0DE.github.io` is a **browser-based Unix-like terminal** that serves as a developer portfolio. The live UI is now rendered directly into a visible `<canvas>` instead of being composed out of styled DOM rows, and multiline text layout is delegated to Cheng Lou's [Pretext](https://github.com/chenglou/pretext) so the terminal can wrap, relayout, and route text without relying on `getBoundingClientRect`, `offsetHeight`, or browser reflow as part of the main rendering path.

The design philosophy is still **file-system-first**: documentation lives as real `.txt` files fetched over HTTP at runtime, mirroring how a real terminal would `cat` files off disk. This keeps content versionable, diffable, and human-readable without introducing a database or a frontend toolchain.

The live blog still centers on `blog.txt`, and the Worker still supports three media storage modes inside that document: inline `[image-base64]` blocks for `png/jpg/jpeg/webp`, compact reversible `[image-z85]` blocks for smaller GIF payloads, and hosted `[image-url]` blocks for larger GIF or MP4 assets served through the Worker from `R2` with private `B2` fallback. The public `post` flow now also supports mixed text/media templates with repeated `[image]` placeholders, exact-count file picking, and optional Turnstile-backed verification before the append request reaches the Worker.

The latest terminal update is the big one: the production terminal now follows the intended Pretext flow much more closely. Text is tokenized once, prepared once, and then laid out repeatedly for different widths or obstacle maps before the resulting fragments are drawn manually into canvas. That means plain terminal output, echoed commands, wrapped links, and the editorial `cat blog.txt` layout all avoid DOM measurement and CSS-driven text wrapping in the live render path.

Elevated sessions still split responsibilities: `root` enables the red animated glyph-rain background and unlocks a root-only editorial `cat blog.txt` view where images, GIFs, and MP4 blocks can be dragged across the terminal to live-reflow the banner, visitor widget, timestamps, and blog text, while `godlike` uses the same password as blog/image deletion and is the only session that can see or trigger inline delete controls. Switching back with `su guest` restores the original guest prompt and default background styling.

Credit to Cheng Lou for the original [Pretext](https://github.com/chenglou/pretext) project, the pure JavaScript/TypeScript multiline text measurement and layout library this terminal integration builds on.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                 BROWSER                                      │
│                                                                              │
│  ┌──────────────┐      ┌──────────────┐      ┌──────────────────────┐        │
│  │  index.html  │─────→│   term.js    │─────→│ terminal-canvas-core │        │
│  │ projects.html│      │ (boot bridge)│      │   .mjs (canvas REPL) │        │
│  └──────────────┘      └──────────────┘      └───────┬─────────┬────┘        │
│                                                      │         │             │
│                                ┌─────────────────────▼──────┐  │             │
│                                │ commands.js (shell verbs / │  │             │
│                                │ blog parsing / auth)       │  │             │
│                                └──────────────┬─────────────┘  │             │
│                                               │                │             │
│                     ┌───────────────┐      ┌──▼────────────────▼───┐         │
│                     │ pictures.js   │      │ terminal-pretext-core │         │
│                     │ ASCII / video │      │ prepare/layout adapter│         │
│                     └───────────────┘      └────────────┬──────────┘         │
│                                                         │                    │
│                                ┌────────────────────────▼──────────────────┐ │
│                                │ pretext-browser.mjs / vendor/pretext      │ │
│                                │ Cheng Lou's text measurement + layout     │ │
│                                └────────────────────────┬──────────────────┘ │
│                                                         │                    │
│                    ┌──────────────────┐   ┌─────────────▼────────────┐       │
│                    │ banner-wave-core │   │ terminal-visuals-core    │       │
│                    │ banner glyph     │   │ elevated rain helpers    │       │
│                    │ segmentation     │   └──────────────────────────┘       │
│                    └──────────────────┘                                      │
│                                                         │                    │
│                              ┌──────────────────────────▼─────────────────┐  │
│                              │ visible <canvas id="terminal-canvas">      │  │
│                              │ hidden  <canvas id="canvas"> scratch       │  │
│                              └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
          │ fetch()                                         │ fetch()/POST
          ▼                                                 ▼
  ┌───────────────┐                              ┌────────────────────────────┐
  │   .txt files  │                              │      Cloudflare Worker     │
  │ (content DB)  │                              │ blog append/image/visitor  │
  │ blog.txt      │                              │ endpoints backed by GitHub │
  │ projects.txt  │                              └────────────────────────────┘
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
terminal-canvas-core.mjs parses input → dispatches to commands.js::cat()
      │
      ▼
fetch("blog.txt") over HTTP
      │
      ▼
commands.js parses blog text/media blocks and terminal links
      │
      ▼
terminal-pretext-core prepares + lays out wrapped fragments via Pretext
      │
      ▼
terminal-canvas-core draws the resulting text, widgets, and media into canvas
```

When the active session is `root`, `cat blog.txt` routes the banner, visitor widget, timestamps, and blog entries through a root-only editorial stage where draggable images, GIFs, and MP4 blocks act as live obstacles for Pretext line layout. Delete controls stay fully hidden unless the active session is `godlike`.

**Request flow for `post <message>`:**

```
User types "post first [image] second [image] third"
      │
      ▼
commands.js::post() → POST mixed content blocks to the Cloudflare Worker
      │
      ▼
Worker validates content/rate limits/Turnstile → calls GitHub Contents API
      │
      ▼
GitHub API appends entry to blog.txt → commits to main branch
      │
      ▼
Next `cat blog.txt` reflects the new entry live
```

The universal `post ... [image] ...` flow shares the same Worker path as text-only posts, and the legacy `post --image` alias still routes through that same pipeline. PNG/JPEG/JPG/WEBP images remain inline in `blog.txt`, while hosted media blocks now cover larger GIFs and MP4 uploads through `/api/blog/media/...`. When a post template requests multiple `[image]` placeholders, the browser reopens the file chooser once per placeholder and requires the exact same number of selected media files before publishing; stopping early cancels the entire post instead of partially publishing it. When Turnstile is enabled on the Worker, the browser also acquires a fresh token immediately before the append request is sent. Each entry supports up to 10 attached media blocks.

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
├── term.js                           # Thin boot bridge that loads the canvas runtime
├── terminal-canvas-core.mjs          # Canvas terminal engine, input loop, viewer, and blog/media interactions
├── commands.js                       # Shell commands, blog/media parsing, session auth, and helper bridges
├── pictures.js                       # ASCII/glyph image rendering + webcam support
├── banner-wave-core.mjs              # Grapheme-aware banner wave segmentation helpers
├── terminal-session-core.mjs         # Pure session state for guest/root/godlike prompt behavior
├── terminal-visuals-core.mjs         # Pure helpers for elevated animated glyph rain
├── terminal-pretext-core.mjs         # Link-aware tokenization plus Pretext prepare/layout helpers
├── terminal-pretext-runtime.mjs      # Legacy no-op shim retained for older compatibility expectations
├── pretext-lab.html                  # Standalone layout lab for Pretext experiments
├── pretext-lab.mjs                   # Browser controller for the lab
├── pretext-lab-core.mjs              # Shared lab state and query serialization helpers
├── pretext-browser.mjs               # Shared browser wrapper around the synced Pretext package
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
├── scripts/sync-pretext-package.mjs  # Syncs vendor/pretext from the npm package
├── vendor/pretext/                   # npm-synced Pretext runtime used in-browser
├── package.json                      # Root npm manifest for frontend package tooling
├── package-lock.json                 # Locked frontend dependency graph
│
├── .gitignore
├── LICENSE
└── README.md                         # You are here
```

> **Note:** All `.txt` files serve a dual purpose. They are valid plain-text documents and the terminal's live data source. Running `cat <file>.txt` in the terminal fetches the canonical file over HTTP exactly as it appears in the repo.

> **Pretext update:** the standalone lab still exists, but the production terminal is now also canvas-first and Pretext-backed. The old `style.css`-driven terminal path is intentionally gone from the live renderer.

---

## Core Modules

### `term.js` — Boot Bridge

Responsibilities:
- Exposes the stable `bootTerminalSite(...)` entrypoint consumed by the HTML pages
- Lazy-loads `terminal-canvas-core.mjs` so the live renderer stays modular
- Re-exports prompt/session/history helpers expected by existing command code
- Keeps the page-level boot surface small while the actual REPL lives elsewhere

### `terminal-canvas-core.mjs` — Canvas Terminal Runtime

Responsibilities:
- Draws the prompt, command history, wrapped output, banner, visitor widget, and viewer mode into the visible canvas
- Handles keyboard input, scrolling, prompt echo, cursor blinking, and pointer interactions directly
- Renders inline images, GIFs, and MP4 placeholders without relying on DOM text rows
- Enables root-only draggable editorial blog layout and godlike-only inline delete controls
- Owns the canonical live command history snapshot used by the `history` command bridge
- Uses the hidden scratch canvas for measurement and media preparation while keeping the live path canvas-driven

```
bootTerminalSite()
    └── setupTerminal()
            ├── attachKeyListeners()
            ├── bindPointerHandlers()
            ├── relayout blocks with Pretext
            └── draw every frame into <canvas id="terminal-canvas">
```

### `commands.js` — Shell Verbs

The terminal command map routes each shell verb to its handler, with most command behavior implemented in `commands.js`. Active commands:

| Command | Description |
|---|---|
| `banner` | Renders the canvas welcome screen |
| `cat <file>` | Fetches a `.txt` file and streams it to the terminal |
| `clear` | Clears terminal output and rebuilds the prompt |
| `date` | Prints the browser's current date/time string |
| `echo <text>` | Prints the provided text back to the terminal |
| `fortune` | Displays a random quote from the fortune endpoint |
| `github` | Opens the GitHub profile in a new tab |
| `help` | Prints the command reference |
| `history` | Prints recent command history from the active terminal session |
| `instagram` | Opens Instagram in a new tab |
| `linkedin` | Opens LinkedIn in a new tab |
| `ls` | Lists the available terminal-readable `.txt` files |
| `video [w h]` | Activates webcam to live ASCII/glyph output in the zoomable viewer |
| `mypic [w h]` | Renders a built-in ASCII portrait |
| `post [text] ... [image] ...` | Appends a blog entry; omit `[image]` for text-only posts or use one selected `png/jpg/jpeg/webp/gif/mp4` file per placeholder (up to 10). When Turnstile is configured, a fresh verification token is requested immediately before submit. Example: `post first [image] second [image] third` |
| `pretext [text]` | Reports terminal Pretext status or opens the lab with `pretext lab [text]` |
| `projects` | Opens the dedicated projects terminal page |
| `pwd` | Prints the simulated working directory |
| `qr-totp ...` | Browser-side QR enrollment, QR export, and TOTP generation/verification |
| `resume` | Opens `resume.pdf` in a new tab |
| `su` / `su guest` / `su godlike` | Switches to `root`, back to `guest`, or into password-gated `godlike` |
| `userpic [w h]` | Converts an uploaded or captured photo to ASCII art |
| `visitors` | Renders the live visitor stats widget |
| `whoami` | Prints the current simulated terminal username |
| `youtube` | Opens YouTube in a new tab |

Commands that require async I/O (`cat`, `post`, `fortune`, `video`, `userpic`, `qr-totp`, `visitors`) return Promises and can be aborted mid-execution.

For blog rendering, `cat blog.txt` groups entries into structured text/media blocks, understands inline base64 image blocks, compact reversible GIF blocks, and hosted media URL blocks for GIF and MP4 assets. When the active user is `root`, it reflows the banner, visitor widget, timestamps, and blog entries through a draggable editorial layout that treats media as terminal-wide obstacles; delete controls remain hidden unless the active user is `godlike`.

`commands.js` also exposes bridge helpers used by the canvas runtime, including current visitor stats, filename normalization, and the shared live history path used by `history`, while coordinating exact-count media selection, the guest/root/godlike session model, `su godlike` authentication, Turnstile token acquisition for `post`, and image/post delete flows.

### `terminal-session-core.mjs` — Session State

Responsibilities:
- Normalizes the simulated shell session into a small pure state object
- Restricts `su` transitions to implicit `root` plus explicit `guest` / `godlike`
- Produces the prompt snapshot consumed by the browser renderer and `whoami` / `pwd`, including elevated session flags

### `terminal-visuals-core.mjs` — Elevated Visual Helpers

Responsibilities:
- Decides whether the elevated animated background should be active
- Builds randomized falling glyph columns for the elevated shell visual mode
- Mutates glyph streams over time so columns change while they fall instead of remaining static

### `terminal-pretext-core.mjs` — Link-aware Wrapping Adapter

Responsibilities:
- Tokenizes terminal strings into plain-text and link fragments
- Preserves terminal link metadata while Pretext splits content into visual lines
- Prepares reusable text layouts once and relayouts them cheaply for width changes
- Adds obstacle-aware line routing for the root-only editorial `blog.txt` view
- Provides a pure, testable adapter shared by the browser runtime and unit tests

### `terminal-pretext-runtime.mjs` — Compatibility Shim

Responsibilities:
- Preserves the older browser-facing Pretext hook names for legacy/manual callers
- Stays out of the live canvas boot path
- Returns inert values while the real renderer lives in `terminal-canvas-core.mjs`

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

For webcam mode, `getUserMedia()` captures frames into a hidden `<canvas>`, samples the pixel buffer, maps each sample to a glyph, and writes the resulting string back into the terminal runtime.

### `banner-wave-core.mjs` — Banner Glyph Segmentation

Responsibilities:
- Splits the banner title into grapheme-safe glyph units
- Keeps wave animation indexing stable across non-ASCII text and whitespace
- Supports the canvas banner renderer without reintroducing DOM-based span wrapping

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

Because `cat` fetches files at runtime over HTTP, content updates are live as soon as a commit lands on `main`. Authorized delete actions are only exposed during a `godlike` session, remove the matching media block or full entry from `blog.txt`, and hosted GIF or MP4 deletes can cascade into `R2` or `B2` when necessary.

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
      POST /api/blog/append {"contentBlocks":[...],"turnstileToken":"..."}
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

In practice, the browser builds `contentBlocks` from the mixed text/media template, uploads or stages any required media, and then requests a fresh Turnstile token immediately before the append request when verification is enabled.

The Worker acts as a thin authenticated proxy between the public terminal UI, the GitHub API, and hosted blog media storage. The same package serves `/api/blog/append`, `/api/blog/delete-image`, `/api/blog/delete-entry`, `/api/blog/media/...`, `/api/terminal/su`, and visitor endpoints while `R2QuotaGuard` and `B2QuotaGuard` Durable Objects enforce conservative storage and operation thresholds before either provider reaches its free-tier limit.

Secrets live in Cloudflare environment variables and are not committed to the repo. Current runtime secrets include `GITHUB_PAT`, `TURNSTILE_SECRET_KEY`, `BLOG_IMAGE_DELETE_PASSWORD`, `B2_APPLICATION_KEY`, and `CLOUDFLARE_BILLING_API_TOKEN`. `BLOG_IMAGE_DELETE_PASSWORD` is also the password used by `su godlike`.

Inline `png/jpg/jpeg/webp` images stay inside `blog.txt`, compact GIF payloads can still be serialized directly into the file, and larger GIF or MP4 uploads are stored as hosted Worker media URLs with `R2` as the primary store and private `B2` as the backup. When `TURNSTILE_SECRET_KEY` is configured, the browser obtains a fresh token immediately before posting and the Worker verifies that token server-side before appending. The Worker also blocks posts and deletes while GitHub Pages is still catching up to the previous `blog.txt` commit so the live site and the repo do not drift.

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
<script src="pictures.js?v=20260331b"></script>
<script src="commands.js?v=20260413d"></script>
<script src="term.js?v=20260413a"></script>
```

The entry pages now mount a visible `terminal-canvas` plus a hidden scratch canvas, and they intentionally do **not** include a stylesheet link for the live terminal renderer. Frontend-only changes go live with a push to `main`. A separate Worker redeploy is only needed when `backend/`, `worker/`, or `worker/wrangler.jsonc` changes.

The live entry pages default to the deployed Worker endpoints and the public Turnstile site key through `window.*` fallbacks inside `commands.js`. For local/dev overrides, inject values before `commands.js` loads:

```html
<script>
  window.BLOG_POST_API_URL = "https://your-worker-subdomain.workers.dev/api/blog/append";
  window.TURNSTILE_SITE_KEY = "your-turnstile-sitekey";
</script>
```

---

## Testing

The recent terminal updates were added with red/green TDD around the session/elevated-shell rules, Pretext wrapping and editorial layout adapters, package-sync guardrails, the Worker-backed blog/media flows, the live history bridge, and the Turnstile-enabled posting path before wiring them into the browser runtime.

Current checks:

```bash
node --test tests/terminal-session-core.test.mjs tests/terminal-visuals-core.test.mjs tests/terminal-pretext-core.test.mjs tests/pretext-lab-core.test.mjs tests/pretext-package-sync.test.mjs
node --check commands.js
node --check term.js
node --check banner-wave-core.mjs
node --check terminal-canvas-core.mjs
node --check terminal-session-core.mjs
node --check terminal-visuals-core.mjs
node --check terminal-pretext-core.mjs
node --check terminal-pretext-runtime.mjs
node --check pretext-browser.mjs
node --check pretext-lab.mjs
node --check scripts/sync-pretext-package.mjs
node --test tests/history-command-browser.test.mjs
node --test --test-name-pattern "help consolidates post into the universal multi-media form" tests/help-render-browser.test.mjs
node --test tests/blog-upload-browser.test.mjs
node --check worker/src/index.js
node --check worker/src/index.test.js
node --test worker/src/index.test.js
```

The Pretext lab remains available at [pretext-lab.html](https://0x00c0de.github.io/pretext-lab.html) for manual layout experiments and visual smoke testing.

---

## Usage — Shell Commands

Start at **[https://0x00c0de.github.io](https://0x00c0de.github.io)**. The terminal loads automatically with the `banner` command.

Plain terminal output, echoed commands, and `help` descriptions now use Pretext-backed wrapping and render directly into canvas, so they relayout cleanly on mobile and when the window width changes. The prompt starts in the original guest shell, `su` switches into `root`, `su guest` switches back to the guest shell and restores the default background, and `su godlike` authenticates against the same password used for blog/image deletion. When the active user is `root`, `cat blog.txt` enters the editorial layout with draggable media reflow across the banner, widget, timestamps, and blog text; delete controls stay hidden unless the active user is `godlike`. The `history` command now reads from the same live canvas runtime history used by the prompt, and `post` can request a fresh Turnstile token immediately before submit when the Worker secret is configured.

```text
╔══════════════════════════════════════════════════╗
║  guest@localhost:/home/0x00C0DE/Unkn0wn$         ║
╚══════════════════════════════════════════════════╝

  help                       List all commands
  date                       Show current date and time
  echo hello                 Print text
  history                    Show recent commands from the active session
  whoami                     Print the current terminal username
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
  su godlike                 Authenticate into the godlike shell
  qr-totp --generate-qr ...  Enroll a QR/TOTP secret in-browser
  qr-totp --get-otp          Generate the current 6-digit code
  fortune                    Random quote
  post [text] ... [image] ... Append to blog.txt; omit [image] for text-only posts or use one selected png/jpg/jpeg/webp/gif/mp4 file per placeholder (up to 10). When enabled, Turnstile verification runs right before submit. Example: post first [image] second [image] third
  mypic                      ASCII portrait
  video                      Live webcam to ASCII art
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

*Built without frameworks. Rendered without DOM reflow. Documented without databases.*

</div>
