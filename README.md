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

## Spec conflicts

Two places in the spec contradict the exact `fmt.duration` algorithm given in Section 3.3. The algorithm wins; the stale expectations appear only in the QA notes:

1. **`fmt.multiplierReadout(10000000)`** — Section 10.2 expects `"115 d 17 h"`, but Section 3.3's exact algorithm produces `"115 d 18 h"` (10,000,000 s = 115 d 17 h 46 m, which rounds to 18 h under the specified two-unit rounding). The widget and test page use `"115 d 18 h"`.
2. **Moon page-load `4R`** — Section 10.2 expects `"10.26 s"`, but `fmt.duration` (s < 60 → one decimal) produces `"10.3 s"`. The page-load timeline uses `"10.3 s"`.

Related sanity note: the Energy Wall comparison at full slider (`s = 1`) yields `KE / 6.2e20 ≈ 102.5`, which `sig3` renders as `"103 years of the world's total energy use"` — the QA checklist's "≈ 102 years" is approximate.

## Unspecified details

Small implementation choices the spec left open:

- **Chat Proxima recommended speed**: Section 8.4.2 specifies 100,000,000× for the chat widget, while the simulator and Light Race use 10,000,000×. Each widget follows its own section.
- **Race status column width**: CSS uses a `14ch` grid column (the spec suggested 12 ch; 14 avoids clipping "Finished ✓ 6th").
- **Page-load row 3 end label**: the cached-page row shows `"0 s"` in the end-label column (the full marker text lives on the green marker itself).
- **Chat pane empty-state copy refresh**: the "Say hello — it will take …" placeholder is rendered once per conversation reset (distance is fixed per destination).
- **DSN "Talking to" when paused**: the label still reflects the current rotation (frozen at 0 when reduced-motion starts it).
- **Store-and-forward classic mode**: a bundle that arrives at an intermediate node with the next link up continues immediately; only bundles that need a down link at departure time are lost.
- **Energy-wall gap readout**: values below 1 km/s are shown exactly as the spec formula dictates (`sig3(ε·299792.458) + " m/s"`).
- **Quiz progress bar**: fills from 0 % (question 1) to 100 % (results screen).
- **Solar conjunction button**: ignores repeat clicks while the 8-second conjunction is already running.
