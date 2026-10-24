# The Interplanetary Internet

An interactive educational guide about networking across interplanetary distances. One long, scroll-driven page: read why the internet breaks in space, send packets at real speed, chat across the void, race light, understand the cosmic speed limit, learn how real space networks cope, and take a quiz.

## How to run

No build step, no dependencies, no server required.

- Double-click `index.html` (opens over `file://`), **or**
- Serve the folder: `python3 -m http.server` and open `http://localhost:8000/`.

The page makes **zero network requests** at runtime and stores nothing.

## File map

```
interplanetary-internet/
├── index.html        # All static markup and copy
├── tests.html        # Section 10 test page (loads core.js + data.js only)
├── README.md
├── assets/
│   └── soroosh-bagherieh.jpg   # Developer photo (footer)
├── css/
│   └── styles.css    # Design tokens, layout, components, responsive, reduced-motion
└── js/
    ├── core.js       # Constants, fmt, physics, ticker, shared UI components
    ├── data.js       # Destinations, travellers, facts, personas, ladder, glossary, quiz data
    ├── starfield.js  # Decorative 3-layer starfield canvas
    ├── simulator.js  # Section 8.3 — packet simulator
    ├── chat.js       # Section 8.4 — chat across space
    ├── light.js      # Section 8.5 — light laps, race, ladder, bandwidth widget
    ├── limit.js      # Section 8.6 — energy wall, causality, entanglement demo
    ├── dtn.js        # Section 8.7 — page-load timeline, store-and-forward, DSN
    ├── quiz.js       # Section 8.8 — 10-question quiz
    └── main.js       # Boot order, nav, scroll-spy, reveal, glossary, footer links
```

Scripts load with classic `<script defer>` tags in dependency order and share a single global namespace object, `window.IPI`. No modules, no bundler, works from `file://`.

## Test page

Open `tests.html` (double-click or via the local server). It loads `js/core.js` and `js/data.js`, runs the assertions from Section 10.2 of the spec, and prints PASS/FAIL lines plus a summary.

Current status: **92 passed, 0 failed**.

You can also run the same assertions headlessly in Node:

```bash
node /tmp/opencode/run-tests.js   # dev harness used during the build
```
