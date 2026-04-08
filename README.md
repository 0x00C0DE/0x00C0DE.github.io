# 0x00C0DE.github.io

Canvas-first terminal portfolio powered by [Pretext](https://github.com/chenglou/pretext).

## What changed

This branch replaces the old DOM/CSS terminal renderer with a canvas renderer that:

- draws the terminal directly to a single visible `<canvas>`
- uses Pretext for multiline text layout instead of DOM measurement
- avoids `getBoundingClientRect`, `offsetHeight`, and CSS-driven text reflow in the live terminal path
- keeps the existing command layer in `commands.js`

The result is much closer to Cheng Lou's intended Pretext usage:

1. prepare text once
2. relayout cheaply for width changes
3. render the resulting lines manually

## Runtime architecture

```text
index.html / projects.html / project-*.html
  -> pictures.js
  -> commands.js
  -> term.js
      -> terminal-canvas-core.mjs
          -> pretext-browser.mjs
          -> terminal-pretext-core.mjs
          -> terminal-visuals-core.mjs
```

### Live rendering path

`terminal-canvas-core.mjs` owns the live UI.

- It draws prompts, command history, wrapped output, widgets, and media into canvas.
- It handles keyboard input itself instead of relying on a styled DOM terminal.
- It keeps the command API surface from the old `term.js` so `commands.js` still works.

### Pretext integration

`terminal-pretext-core.mjs` now supports the correct Pretext lifecycle:

- `prepareTerminalText(...)` builds a reusable prepared paragraph
- `layoutPreparedTerminalText(...)` relayouts that prepared paragraph at a width
- `layoutPreparedTerminalEditorialText(...)` routes prepared text around obstacles

The older convenience wrappers still exist:

- `buildTerminalPretextLayout(...)`
- `buildTerminalEditorialLayout(...)`

Those wrappers now delegate to the new prepare/layout split, so tests and simple callers still work.

### Compatibility shim

`terminal-pretext-runtime.mjs` is now only a compatibility shim for the old loader in `commands.js`.
The live terminal no longer uses DOM-based Pretext rendering.

## Files that matter now

- `term.js`
  - thin bridge that lazy-loads the real canvas runtime
- `terminal-canvas-core.mjs`
  - canvas terminal engine, input loop, block layout, media drawing, and viewer mode
- `terminal-pretext-core.mjs`
  - link-aware tokenization plus cached Pretext prepare/layout helpers
- `commands.js`
  - shell commands, blog parsing, session state, visitor APIs, QR/TOTP, uploads
- `pictures.js`
  - image/video frame to ASCII conversion helpers
- `terminal-session-core.mjs`
  - prompt/session state helpers
- `terminal-visuals-core.mjs`
  - animated binary rain helpers used by elevated sessions
- `vendor/pretext/`
  - vendored browser copy of `@chenglou/pretext`

## Removed from the live path

- `style.css`
  - deleted from this branch
- DOM terminal row rendering
- CSS layout classes for terminal wrapping
- DOM reflow-based terminal presentation

## Entry pages

All live terminal entry pages now boot the same canvas terminal:

- `index.html`
- `projects.html`
- `project-bloom-filters.html`
- `project-collision-avoidance.html`
- `project-proprts.html`
- `project-qr-totp.html`
- `project-shellcode-template.html`
- `project-smallsh.html`

Each page keeps its own `DEFAULT_COMMAND`, but the visible UI is now the same canvas-driven shell.

## Local development

This repo is still static-first. A simple static server is enough for the frontend:

```sh
python -m http.server 4173
```

Open:

- `http://127.0.0.1:4173/index.html`

Note:

- the visitor/blog worker is configured for the production GitHub Pages origin
- when served from `127.0.0.1`, visitor API calls will log CORS errors
- that does not affect the local canvas renderer itself

## Tests

Syntax checks:

```sh
node --check commands.js
node --check term.js
node --check terminal-canvas-core.mjs
node --check terminal-pretext-core.mjs
node --check terminal-pretext-runtime.mjs
```

Unit tests:

```sh
node --test tests/terminal-session-core.test.mjs tests/terminal-visuals-core.test.mjs tests/terminal-pretext-core.test.mjs tests/pretext-lab-core.test.mjs tests/pretext-package-sync.test.mjs
```

## Notes

- `pretext-lab.html` and the lab helpers remain in the repo as a diagnostic/demo surface.
- The production terminal no longer depends on that lab runtime or on DOM text rows.
- The branch intentionally keeps `commands.js` mostly intact and moves the architectural change into the renderer layer.

## License

MIT
