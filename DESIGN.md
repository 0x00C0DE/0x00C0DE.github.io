---
name: 0x00C0DE portfolio
description: A terminal-first developer portfolio with directly browsable project pages.
---

## Overview

The homepage is a Unix-like terminal. Command text, prompts, file listings, and ASCII graphics are part of the interface. The project index, individual project pages, résumé, and Bitcoin workspace provide direct entry points.

## Colors

Use the existing terminal theme and ANSI palette in `src/term.js`. Preserve the contrast between command input, results, links, and errors. Carry meaning in text as well as color.

## Typography

The terminal uses monospace. `src/terminal-pretext-core.mjs` uses an 18px Courier New fallback. Keep character alignment for ASCII content and use Pretext for wrapping proportional rich content where the current renderer uses it. Canvas text and hit targets must agree on line breaks.

## Layout

Keep the prompt reachable after output, including on narrow and short viewports. Preserve responsive behavior by checking wrapping, scroll position, and input focus at desktop and mobile sizes. Check the terminal and direct HTML routes independently.

## Components

`src/term.js` coordinates terminal interactions. `src/terminal-canvas-core.mjs` and the Pretext modules provide layout and rendering. Browser-native controls and links on direct HTML pages provide conventional navigation.

## Do's and Don'ts

- Check keyboard input, focus, and link access when changing Canvas-rendered content.
- Check mobile input and scrolling with the soft keyboard.
- Exercise reduced-motion preferences when changing rain, banner, or introductory animation.
- Verify representative desktop and mobile renders before accepting visual changes.
