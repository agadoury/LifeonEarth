# Life on Earth — A Journey Through Deep Time

A live, cinematic web app that takes you on a scroll-driven descent through
**4.6 billion years** of planetary history — from the birth of the solar system
to the rise of the dinosaurs, the great extinctions, and us.

Everything is rendered live on an HTML canvas: there are no images, no video,
and no build step. Each era is a procedurally-animated scene that crossfades
into the next as you scroll, while a persistent **deep-time clock** counts the
years ticking away beneath you.

## The journey

| Era | What you'll see |
| --- | --- |
| **Genesis** (4.6 Bya) | A collapsing cloud of dust ignites into the Sun |
| **Earth Forms** (4.54 Bya) | A molten world assembles from colliding worldlets |
| **The Moon** (4.51 Bya) | The Theia impact tears a moon out of the young Earth |
| **Oceans** (4.4 Bya) | Endless rains fill the first global ocean |
| **First Life** (3.8 Bya) | A single cell sparks to life at a deep-sea vent |
| **Cyanobacteria → Oxygen** | Microbes build reefs and poison the air with oxygen |
| **Complex Cells** (1.8 Bya) | A cell swallows a cell — the eukaryote is born |
| **Snowball Earth** (720 Mya) | The whole planet freezes over |
| **Cambrian Explosion** (541 Mya) | Eyes, jaws, claws — life invents the body |
| **Age of Fish → Onto Land** | Backbones, then the first step ashore |
| **Coal Forests → Rise of Reptiles** | Giant bugs, then reptiles conquer dry land |
| **The Great Dying** (252 Mya) | Earth's worst extinction nearly ends everything |
| **Dawn of the Dinosaurs** (230 Mya) | Small, upright hunters inherit the world |
| **Age of Giants → Reign of the Tyrant** | Sauropods, the first birds, and *T. rex* |
| **The Day the Sky Fell** (66 Mya) | The Chicxulub asteroid ends the dinosaurs |
| **Age of Mammals → A Mind Awakes** | The meek inherit the Earth — and look back |

Mass-extinction chapters get their own alarming treatment, with the death toll
and cause called out.

## Running it

It's a fully static site. Either open `index.html` directly, or serve it:

```bash
# Python
python3 -m http.server 8000

# or Node
npx serve .
```

Then visit <http://localhost:8000>.

### Controls
- **Scroll** to travel through time.
- **↑ / ↓ arrow keys** jump chapter to chapter.
- **Hover the right-hand rail** to jump to any era.

## How it's built

```
index.html             structure + HUD + intro/outro + static timeline panels
css/styles.css          cinematic styling, typography, responsive layout
js/timeline-data.js     the "script" of deep time — every chapter's content
js/scenes.js            procedural canvas animations, one per era
js/app.js               scroll tracking, the deep-time clock, the render loop
build.js                generates the static panels + the standalone build
dist/life-on-earth.html one self-contained file (all CSS/JS inlined)
```

No frameworks, no dependencies — just HTML, CSS, and vanilla JavaScript with a
single `<canvas>`.

### Progressive enhancement

The timeline panels are **static HTML**, generated into `index.html` from
`js/timeline-data.js` by `build.js`. The JavaScript only *enhances* them with
the live canvas animations and the deep-time clock — so the full story is
readable even with JavaScript disabled or in a viewer that doesn't run scripts.

### Rebuilding

After editing `js/timeline-data.js` (or any CSS/JS), regenerate the static
panels and the single-file build:

```bash
node build.js
```

This rewrites the panel markup in `index.html` and refreshes
`dist/life-on-earth.html`.

## A single file you can open anywhere

`dist/life-on-earth.html` is the **entire experience in one self-contained
file** — every line of CSS and JavaScript is inlined. Download it and
double-click; it runs straight from `file://` with no server, no clone, and no
network (decorative web-fonts fall back to system fonts when offline).
