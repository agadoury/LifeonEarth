/*
 * app.js
 * Wires the timeline data to the DOM and to the canvas scene engine.
 *   - Builds a full-screen story panel for every chapter.
 *   - Tracks scroll to decide the active chapter + a smooth local progress.
 *   - Drives the deep-time clock, the era label, the progress bar and rail.
 *   - Runs the animation loop, crossfading scenes as chapters change.
 */
(function () {
  "use strict";

  const TIMELINE = window.TIMELINE;
  const SCENES = window.SCENES;

  // ---- build the story panels ----------------------------------------------
  const story = document.getElementById("story");
  const rail = document.getElementById("rail");

  TIMELINE.forEach((c, i) => {
    const panel = document.createElement("section");
    panel.className = "panel";
    panel.dataset.scene = c.id;
    panel.dataset.index = i;
    panel.style.setProperty("--accent", c.accent);

    const factList = c.facts.map((f) => `<li>${f}</li>`).join("");

    const extinctionBlock = c.extinction
      ? `<div class="panel__extinction">
           <div class="ext__row"><span class="ext__label">DEATH TOLL</span><span class="ext__val">${c.extinction.kills}</span></div>
           <div class="ext__row"><span class="ext__label">CAUSE</span><span class="ext__val">${c.extinction.cause}</span></div>
         </div>`
      : "";

    panel.innerHTML = `
      <div class="panel__card${c.extinction ? " panel__card--extinction" : ""}">
        <p class="panel__tag">${c.tag}</p>
        <h2 class="panel__title">${c.title}</h2>
        <p class="panel__lead">${c.lead}</p>
        ${extinctionBlock}
        <ul class="panel__facts">${factList}</ul>
      </div>`;
    story.appendChild(panel);

    // rail dot
    const dot = document.createElement("button");
    dot.className = "rail__item";
    dot.dataset.index = i;
    dot.innerHTML = `<span class="rail__tick"></span><span class="rail__label">${c.rail}</span>`;
    dot.addEventListener("click", () => {
      panel.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    rail.appendChild(dot);
  });

  const panels = Array.from(document.querySelectorAll(".panel"));
  const railItems = Array.from(document.querySelectorAll(".rail__item"));

  // ---- canvas setup ---------------------------------------------------------
  const canvas = document.getElementById("stage");
  const ctx = canvas.getContext("2d");
  let DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  // ---- HUD elements ---------------------------------------------------------
  const clockAge = document.getElementById("clockAge");
  const clockEra = document.getElementById("clockEra");
  const progressFill = document.getElementById("progressFill");
  const progressPct = document.getElementById("progressPct");
  const hud = document.getElementById("hud");

  // Format a year-count (in millions of years ago) into human-readable text.
  function formatAge(ma) {
    if (ma <= 0.0001) return ['Today', ''];
    if (ma < 1) {
      const years = Math.round(ma * 1e6 / 1000) * 1000; // round to nearest thousand
      return [years.toLocaleString(), 'years ago'];
    }
    if (ma >= 1000) {
      const billions = (ma / 1000).toFixed(2);
      return [billions, 'billion years ago'];
    }
    return [Math.round(ma).toLocaleString(), 'million years ago'];
  }

  // ---- scroll state ---------------------------------------------------------
  let activeIndex = 0;
  let localProgress = 0; // 0..1 within the active chapter
  let displayAge = TIMELINE[0].age;

  function computeScrollState() {
    const mid = window.innerHeight / 2;
    let best = 0, bestDist = Infinity;
    panels.forEach((p, i) => {
      const r = p.getBoundingClientRect();
      const center = r.top + r.height / 2;
      const dist = Math.abs(center - mid);
      if (dist < bestDist) { bestDist = dist; best = i; }
    });
    activeIndex = best;

    // local progress through the active panel (0 at top entering, 1 at bottom leaving)
    const r = panels[activeIndex].getBoundingClientRect();
    localProgress = clamp((mid - r.top) / r.height, 0, 1);

    // overall document progress for the bar
    const doc = document.documentElement;
    const total = doc.scrollHeight - window.innerHeight;
    const pct = total > 0 ? clamp(window.scrollY / total, 0, 1) : 0;
    progressFill.style.width = (pct * 100).toFixed(1) + "%";
    progressPct.textContent = Math.round(pct * 100) + "%";

    // fade the HUD in once we leave the hero
    hud.classList.toggle("hud--visible", window.scrollY > window.innerHeight * 0.5);

    // rail highlight
    railItems.forEach((it, i) => it.classList.toggle("rail__item--active", i === activeIndex));
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ---- scene crossfade engine ----------------------------------------------
  let curScene = TIMELINE[0].id;
  let prevScene = null;
  let fade = 1;              // 0..1 progress of crossfade into curScene
  let curAccent = TIMELINE[0].accent;
  let prevAccent = TIMELINE[0].accent;

  function setScene(id, accent) {
    if (id === curScene) return;
    prevScene = curScene;
    prevAccent = curAccent;
    curScene = id;
    curAccent = accent;
    fade = 0;
  }

  // ---- animation loop -------------------------------------------------------
  let start = performance.now();
  const sceneClocks = {}; // per-scene local time so each animation starts at 0

  function frame(now) {
    const t = (now - start) / 1000;

    computeScrollState();

    // pick the active scene
    const active = TIMELINE[activeIndex];
    setScene(active.id, active.accent);

    // advance crossfade
    if (fade < 1) fade = Math.min(1, fade + 0.035);

    // smoothly interpolate the displayed deep-time age between chapters
    const next = TIMELINE[Math.min(activeIndex + 1, TIMELINE.length - 1)];
    const targetAge = lerp(active.age, next.age, localProgress);
    displayAge = lerp(displayAge, targetAge, 0.12);
    const [num, unit] = formatAge(displayAge);
    clockAge.innerHTML = unit ? `${num} <em>${unit}</em>` : `<em>${num}</em>`;
    clockEra.textContent = active.era;

    // track per-scene clocks (reset when a scene becomes current)
    if (!(curScene in sceneClocks)) sceneClocks[curScene] = t;
    if (prevScene && !(prevScene in sceneClocks)) sceneClocks[prevScene] = t;

    // paint
    ctx.clearRect(0, 0, W, H);
    // deep space base wash, tinted by the active accent
    const base = ctx.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, "#05060c");
    base.addColorStop(1, "#02030a");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);

    // draw previous scene fading out, then current scene fading in
    if (prevScene && fade < 1 && SCENES[prevScene]) {
      SCENES[prevScene](ctx, {
        t: t - (sceneClocks[prevScene] || t), w: W, h: H,
        a: 1 - fade, accent: prevAccent,
      });
    }
    if (SCENES[curScene]) {
      SCENES[curScene](ctx, {
        t: t - (sceneClocks[curScene] || t), w: W, h: H,
        a: fade, accent: curAccent,
      });
    }

    // subtle cinematic vignette over everything
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.85);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // ---- misc controls --------------------------------------------------------
  document.getElementById("restartBtn").addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  // keyboard: arrow / space jumps chapter to chapter
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" || e.key === "PageDown") {
      e.preventDefault();
      const target = panels[Math.min(activeIndex + 1, panels.length - 1)];
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (e.key === "ArrowUp" || e.key === "PageUp") {
      e.preventDefault();
      if (activeIndex === 0) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
      const target = panels[Math.max(activeIndex - 1, 0)];
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
})();
