0x00C0DE Terminal Portfolio
==========================
This site is a static browser application that emulates a compact Unix-like shell for portfolio navigation.

Architecture
------------
Entry points  : index.html, projects.html, project-*.html
Terminal loop : term.js renders the prompt, command history, and output stream
Command layer : commands-v2.js implements shell verbs plus async integrations such as fortune
ASCII media   : pictures.js converts images and webcam frames into terminal glyph output
Theme         : style.css supplies the dark-red CRT palette and prompt styling

Data model
----------
The cat command loads real .txt files over HTTP instead of embedding file contents inside JavaScript.
That keeps terminal-readable documentation versioned as standalone assets and lets the shell mirror actual files on disk.

Suggested entry points
----------------------
cat PROJECTS.txt
cat LINKS.txt
resume
fortune
