About this site
---------------
This portfolio now renders as a canvas terminal instead of a DOM terminal.

Architecture
------------
Entry points  : index.html, projects.html, project-*.html
Terminal loop : term.js loads terminal-canvas-core.mjs
Layout engine : Pretext measures and wraps text without DOM reflow
Command layer : commands.js implements shell verbs and backend integrations
ASCII media   : pictures.js converts images and webcam frames into glyph output

What changed
------------
The live terminal no longer depends on style.css or DOM row layout.
Prompts, wrapped output, links, widgets, and media are drawn directly to canvas.

Suggested entry points
----------------------
cat blog.txt
cat projects.txt
cat links.txt
pretext
resume
fortune

Blog backend
------------
The public deployment path still uses a Cloudflare Worker that updates blog.txt through the GitHub API.
