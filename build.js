/*
 * build.js
 * Generates the static timeline markup so the page is readable without any
 * JavaScript, then emits the single-file standalone build.
 *
 *   node build.js
 *
 * Source of truth for content : js/timeline-data.js
 * Outputs                     : index.html  (static panels injected)
 *                               dist/life-on-earth.html  (everything inlined)
 */
const fs = require("fs");
const path = require("path");

// load the timeline data (defines window.TIMELINE)
const sandbox = { window: {} };
const vm = require("vm");
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync("js/timeline-data.js", "utf8"), sandbox);
const TIMELINE = sandbox.window.TIMELINE;

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---- build the panels + rail ------------------------------------------------
const panelsHTML = TIMELINE.map((c, i) => {
  const facts = c.facts.map((f) => `<li>${esc(f)}</li>`).join("");
  const extinction = c.extinction
    ? `
        <div class="panel__extinction">
          <div class="ext__row"><span class="ext__label">DEATH TOLL</span><span class="ext__val">${esc(c.extinction.kills)}</span></div>
          <div class="ext__row"><span class="ext__label">CAUSE</span><span class="ext__val">${esc(c.extinction.cause)}</span></div>
        </div>`
    : "";
  return `
    <section class="panel" data-index="${i}" data-scene="${c.id}" data-accent="${c.accent}" data-age="${c.age}" data-era="${esc(c.era)}" style="--accent:${c.accent}">
      <div class="panel__card${c.extinction ? " panel__card--extinction" : ""}">
        <p class="panel__tag">${esc(c.tag)}</p>
        <h2 class="panel__title">${esc(c.title)}</h2>
        <p class="panel__lead">${esc(c.lead)}</p>${extinction}
        <ul class="panel__facts">${facts}</ul>
      </div>
    </section>`;
}).join("\n");

const railHTML = TIMELINE.map((c, i) =>
  `<button class="rail__item" data-index="${i}"><span class="rail__tick"></span><span class="rail__label">${esc(c.rail)}</span></button>`
).join("\n    ");

// ---- inject into index.html -------------------------------------------------
let html = fs.readFileSync("index.html", "utf8");
html = html.replace(
  /(<nav class="rail" id="rail"[^>]*>)[\s\S]*?(<\/nav>)/,
  `$1\n    ${railHTML}\n  $2`
);
html = html.replace(
  /(<main id="story">)[\s\S]*?(<\/main>)/,
  `$1${panelsHTML}\n  $2`
);
fs.writeFileSync("index.html", html);
console.log(`index.html: injected ${TIMELINE.length} static panels + rail items`);

// ---- emit the single-file standalone build ---------------------------------
const css = fs.readFileSync("css/styles.css", "utf8");
const scenes = fs.readFileSync("js/scenes.js", "utf8");
const app = fs.readFileSync("js/app.js", "utf8");

let standalone = html
  .replace(/\s*<link rel="stylesheet" href="css\/styles.css" \/>/, `\n  <style>\n${css}\n  </style>`)
  .replace(
    /\s*<script src="js\/scenes.js"><\/script>\s*<script src="js\/app.js"><\/script>/,
    `\n  <script>\n${scenes}\n${app}\n  </script>`
  );

fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync(path.join("dist", "life-on-earth.html"), standalone);
const kb = (Buffer.byteLength(standalone) / 1024).toFixed(1);
const leftover = (standalone.match(/href="css|src="js/g) || []).length;
console.log(`dist/life-on-earth.html: ${kb} KB, leftover local refs: ${leftover}`);
