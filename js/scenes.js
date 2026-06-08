/*
 * scenes.js
 * A tiny procedural-animation engine. Every chapter in timeline-data.js has a
 * matching scene here, drawn on a single full-screen canvas. Scenes crossfade
 * into one another as you scroll, so the whole planet's history feels like one
 * continuous descent rather than a slideshow.
 *
 * Each scene is a function (ctx, env) where env carries:
 *   t      seconds since load (for animation)
 *   w, h   canvas size in CSS pixels
 *   a      this scene's alpha (0..1) for crossfading
 *   accent the chapter's accent colour
 *   rnd    a stable seeded RNG so backgrounds don't jitter between frames
 */
(function () {
  "use strict";

  // ---- small math + helpers -------------------------------------------------
  const TAU = Math.PI * 2;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const ease = (t) => t * t * (3 - 2 * t);

  // Deterministic RNG (mulberry32) so star fields stay put frame to frame.
  function makeRng(seed) {
    let s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }

  // A field of stars, reused as the cosmic backdrop almost everywhere.
  function starfield(ctx, env, count, brightness) {
    const rnd = makeRng(1337);
    for (let i = 0; i < count; i++) {
      const x = rnd() * env.w;
      const y = rnd() * env.h;
      const r = rnd() * 1.3 + 0.2;
      const tw = 0.6 + 0.4 * Math.sin(env.t * (0.5 + rnd() * 2) + i);
      ctx.globalAlpha = env.a * brightness * tw;
      ctx.fillStyle = rnd() > 0.85 ? "#bcd3ff" : "#ffffff";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // A soft radial glow — used for suns, impacts, vents, auroras.
  function glow(ctx, x, y, radius, color, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, rgba(color, a));
    g.addColorStop(0.5, rgba(color, a * 0.4));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  }

  // A lit sphere (planet / moon) with a day-night terminator.
  function planet(ctx, x, y, r, colors, lightAngle, a) {
    const lx = x + Math.cos(lightAngle) * r * 0.5;
    const ly = y + Math.sin(lightAngle) * r * 0.5;
    const g = ctx.createRadialGradient(lx, ly, r * 0.1, x, y, r);
    colors.forEach((c, i) => g.addColorStop(i / (colors.length - 1), rgba(c, a)));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    // night-side shading
    const ng = ctx.createRadialGradient(lx, ly, r * 0.2, x, y, r * 1.05);
    ng.addColorStop(0, "rgba(0,0,0,0)");
    ng.addColorStop(1, `rgba(0,0,0,${0.55 * a})`);
    ctx.fillStyle = ng;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }

  // Layered ocean horizon used by several "watery world" scenes.
  function ocean(ctx, env, top, deep, surface) {
    const g = ctx.createLinearGradient(0, env.h * 0.45, 0, env.h);
    g.addColorStop(0, rgba(surface, env.a));
    g.addColorStop(1, rgba(deep, env.a));
    ctx.fillStyle = g;
    ctx.fillRect(0, env.h * 0.5, env.w, env.h * 0.5);
    // gentle wave lines
    ctx.strokeStyle = rgba(top, env.a * 0.25);
    ctx.lineWidth = 1.5;
    for (let l = 0; l < 6; l++) {
      const y = env.h * 0.55 + l * env.h * 0.07;
      ctx.beginPath();
      for (let x = 0; x <= env.w; x += 16) {
        const yy = y + Math.sin(x * 0.01 + env.t * (0.6 + l * 0.2) + l) * (6 + l * 2);
        x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
  }

  // ---- silhouette creatures -------------------------------------------------
  // Drawn as simple, recognisable profiles so the eras read at a glance.

  function sauropod(ctx, x, y, s, color, a) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = rgba(color, a);
    ctx.beginPath();
    ctx.moveTo(-60, 0);                       // tail tip
    ctx.quadraticCurveTo(-30, -8, 0, -12);    // back
    ctx.quadraticCurveTo(20, -16, 30, -40);   // up the neck
    ctx.quadraticCurveTo(34, -54, 44, -56);   // head
    ctx.quadraticCurveTo(40, -48, 34, -44);   // jaw
    ctx.quadraticCurveTo(26, -22, 18, -8);    // front of neck
    ctx.quadraticCurveTo(12, 0, 18, 22);      // front leg
    ctx.lineTo(10, 22);
    ctx.quadraticCurveTo(8, 4, 2, 2);
    ctx.lineTo(-20, 22);                       // back leg
    ctx.lineTo(-28, 22);
    ctx.quadraticCurveTo(-26, 2, -34, 2);
    ctx.quadraticCurveTo(-50, 4, -60, 0);
    ctx.fill();
    ctx.restore();
  }

  function trex(ctx, x, y, s, color, a, stride) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = rgba(color, a);
    ctx.beginPath();
    ctx.moveTo(-58, -6);                       // tail
    ctx.quadraticCurveTo(-30, -20, -8, -30);   // back
    ctx.quadraticCurveTo(6, -38, 18, -40);     // shoulders/neck
    ctx.quadraticCurveTo(40, -44, 52, -34);    // head top
    ctx.lineTo(54, -26);                        // snout
    ctx.lineTo(40, -24);                        // jaw
    ctx.quadraticCurveTo(34, -22, 26, -20);
    ctx.lineTo(20, -10);                        // chest
    ctx.lineTo(26, 2);                          // tiny arm
    ctx.lineTo(18, -2);
    ctx.quadraticCurveTo(14, 6, 12, 18 + stride);  // front leg
    ctx.lineTo(4, 18 + stride);
    ctx.quadraticCurveTo(6, 2, 2, -4);
    ctx.lineTo(-14, 16 - stride);               // back leg
    ctx.lineTo(-22, 16 - stride);
    ctx.quadraticCurveTo(-18, -6, -28, -10);
    ctx.quadraticCurveTo(-46, -6, -58, -6);
    ctx.fill();
    ctx.restore();
  }

  function dimetrodon(ctx, x, y, s, color, a) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = rgba(color, a);
    // body
    ctx.beginPath();
    ctx.moveTo(-50, 4);
    ctx.quadraticCurveTo(-20, -6, 0, -6);
    ctx.quadraticCurveTo(30, -6, 48, 0);       // toward head
    ctx.quadraticCurveTo(56, 2, 54, 8);        // snout
    ctx.lineTo(44, 9);
    ctx.quadraticCurveTo(30, 12, 0, 12);
    ctx.lineTo(8, 24);                          // legs
    ctx.lineTo(2, 24);
    ctx.lineTo(-4, 12);
    ctx.lineTo(-30, 12);
    ctx.lineTo(-24, 24);
    ctx.lineTo(-30, 24);
    ctx.lineTo(-38, 12);
    ctx.quadraticCurveTo(-46, 12, -50, 4);
    ctx.fill();
    // sail
    ctx.beginPath();
    ctx.moveTo(-34, -4);
    ctx.quadraticCurveTo(-30, -42, -10, -46);
    ctx.quadraticCurveTo(14, -44, 26, -4);
    ctx.quadraticCurveTo(0, -16, -34, -4);
    ctx.fill();
    // sail spines
    ctx.strokeStyle = rgba(color, a * 0.5);
    ctx.lineWidth = 0.8;
    for (let i = -28; i < 24; i += 6) {
      ctx.beginPath();
      ctx.moveTo(i, -6);
      ctx.lineTo(i + 4, -40 + Math.abs(i) * 0.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function fishShape(ctx, x, y, s, color, a, wig) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = rgba(color, a);
    ctx.beginPath();
    ctx.moveTo(-28, 0);
    ctx.quadraticCurveTo(-10, -10, 12, -6);
    ctx.quadraticCurveTo(24, -3, 30, 0);       // snout
    ctx.quadraticCurveTo(24, 3, 12, 6);
    ctx.quadraticCurveTo(-10, 10, -28, 0);
    ctx.fill();
    // tail
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(-40, -10 + wig);
    ctx.lineTo(-34, 0);
    ctx.lineTo(-40, 10 + wig);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function trilobite(ctx, x, y, s, color, a) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = rgba(color, a);
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 9, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = rgba(color, a * 0.6);
    for (let i = -8; i <= 8; i += 4) {
      ctx.beginPath();
      ctx.ellipse(i, 0, 1.6, 8, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function jelly(ctx, x, y, s, color, a, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    const pulse = 1 + Math.sin(t * 1.5 + x) * 0.08;
    ctx.fillStyle = rgba(color, a * 0.7);
    ctx.beginPath();
    ctx.ellipse(0, 0, 16 * pulse, 12, 0, Math.PI, TAU);
    ctx.fill();
    ctx.strokeStyle = rgba(color, a * 0.5);
    ctx.lineWidth = 1.2;
    for (let i = -12; i <= 12; i += 5) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.quadraticCurveTo(i + Math.sin(t * 2 + i) * 4, 20, i, 34);
      ctx.stroke();
    }
    ctx.restore();
  }

  // A fern/frond, used for forests and the Ediacaran garden.
  function frond(ctx, x, y, s, color, a, sway) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.strokeStyle = rgba(color, a);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(sway * 6, -30, sway * 12, -60);
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let i = 1; i <= 7; i++) {
      const yy = -i * 8;
      const px = sway * (i * 1.6);
      ctx.beginPath();
      ctx.moveTo(px, yy);
      ctx.lineTo(px - 10, yy - 5);
      ctx.moveTo(px, yy);
      ctx.lineTo(px + 10, yy - 5);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---- the scene registry ---------------------------------------------------
  const scenes = {};

  // 1. Genesis — collapsing nebula + igniting sun
  scenes.genesis = function (ctx, env) {
    starfield(ctx, env, 400, 0.9);
    const cx = env.w * 0.5, cy = env.h * 0.5;
    // swirling protoplanetary disk
    const rnd = makeRng(99);
    ctx.save();
    ctx.translate(cx, cy);
    for (let i = 0; i < 900; i++) {
      const ang = rnd() * TAU + env.t * 0.05 * (1 - i / 900);
      const dist = 40 + rnd() * env.w * 0.42;
      const x = Math.cos(ang) * dist;
      const y = Math.sin(ang) * dist * 0.32; // flatten into a disk
      ctx.globalAlpha = env.a * (0.05 + rnd() * 0.25);
      ctx.fillStyle = rnd() > 0.6 ? env.accent : "#ffd9a0";
      ctx.fillRect(x, y, 1.4, 1.4);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    const ign = ease(clamp(env.t / 4, 0, 1));
    glow(ctx, cx, cy, 60 + ign * 160, "#fff1c4", env.a * 0.9);
    glow(ctx, cx, cy, 20 + ign * 50, "#ffffff", env.a);
  };

  // 2. Accretion — molten infant Earth
  scenes.accretion = function (ctx, env) {
    starfield(ctx, env, 250, 0.5);
    const cx = env.w * 0.5, cy = env.h * 0.52;
    const r = Math.min(env.w, env.h) * 0.26;
    glow(ctx, cx, cy, r * 2.4, "#ff5a2c", env.a * 0.45);
    planet(ctx, cx, cy, r, ["#ffd28a", "#ff7a2c", "#7a1500"], env.t * 0.2, env.a);
    // lava cracks (animated noise)
    const rnd = makeRng(7);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    for (let i = 0; i < 40; i++) {
      const a = rnd() * TAU, d = rnd() * r;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      const flick = 0.4 + 0.6 * Math.abs(Math.sin(env.t * 2 + i));
      ctx.globalAlpha = env.a * flick * 0.8;
      ctx.fillStyle = "#ffec8a";
      ctx.fillRect(x, y, 2 + rnd() * 3, 2 + rnd() * 3);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // infalling meteors
    for (let i = 0; i < 5; i++) {
      const p = (env.t * 0.3 + i / 5) % 1;
      const x = cx + (1 - p) * env.w * 0.4 - env.w * 0.1;
      const y = cy - r - (1 - p) * 200;
      ctx.strokeStyle = rgba("#ffcf8a", env.a * (1 - p));
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 16, y + 20); ctx.stroke();
    }
  };

  // 3. Theia — the Moon-forming impact
  scenes.theia = function (ctx, env) {
    starfield(ctx, env, 250, 0.6);
    const cx = env.w * 0.42, cy = env.h * 0.55;
    const r = Math.min(env.w, env.h) * 0.22;
    const hit = clamp(env.t / 3, 0, 1);
    planet(ctx, cx, cy, r, ["#ffcaa0", "#c2451c", "#3a0d00"], 0.6, env.a);
    // debris ring forming the moon
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.3);
    const rnd = makeRng(55);
    for (let i = 0; i < 500; i++) {
      const ang = rnd() * TAU + env.t * 0.4;
      const dist = r * 1.4 + rnd() * r * 1.6 * hit;
      ctx.globalAlpha = env.a * (0.1 + rnd() * 0.4);
      ctx.fillStyle = rnd() > 0.5 ? "#ffd9a0" : "#ff8a4a";
      ctx.fillRect(Math.cos(ang) * dist, Math.sin(ang) * dist * 0.35, 1.6, 1.6);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    // coalescing moon
    const mx = cx + Math.cos(env.t * 0.4) * r * 2.6;
    const my = cy + Math.sin(env.t * 0.4) * r * 0.9;
    planet(ctx, mx, my, r * (0.22 + hit * 0.12), ["#e9e4dc", "#8a8278", "#2c2a26"], 0.6, env.a);
    glow(ctx, cx + r * 0.6, cy - r * 0.4, 40, "#fff1c4", env.a * 0.6 * (1 - hit));
  };

  // 4. Oceans — blue world under heavy clouds
  scenes.oceans = function (ctx, env) {
    const sky = ctx.createLinearGradient(0, 0, 0, env.h);
    sky.addColorStop(0, rgba("#1a2740", env.a));
    sky.addColorStop(0.5, rgba("#274a6e", env.a));
    sky.addColorStop(1, rgba("#0a1828", env.a));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, env.w, env.h);
    ocean(ctx, env, "#aee0ff", "#04223f", "#2f7bb5");
    // rain
    ctx.strokeStyle = rgba("#bcd9f5", env.a * 0.35);
    ctx.lineWidth = 1;
    const rnd = makeRng(3);
    for (let i = 0; i < 220; i++) {
      const x = (rnd() * env.w + env.t * 60) % env.w;
      const y = (rnd() * env.h + env.t * 600) % (env.h * 0.6);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 14); ctx.stroke();
    }
    // lightning flashes
    const flash = Math.max(0, Math.sin(env.t * 0.7) - 0.97) * 30;
    if (flash > 0) { ctx.fillStyle = rgba("#cfe6ff", env.a * flash); ctx.fillRect(0, 0, env.w, env.h * 0.5); }
  };

  // 5. First life — deep-sea vent, lone cell
  scenes.firstlife = function (ctx, env) {
    const g = ctx.createLinearGradient(0, 0, 0, env.h);
    g.addColorStop(0, rgba("#02141f", env.a));
    g.addColorStop(1, rgba("#001016", env.a));
    ctx.fillStyle = g; ctx.fillRect(0, 0, env.w, env.h);
    // hydrothermal vent
    const vx = env.w * 0.5, vy = env.h;
    glow(ctx, vx, vy, 220, "#36e0a0", env.a * 0.3);
    // rising mineral plume / bubbles
    const rnd = makeRng(21);
    for (let i = 0; i < 90; i++) {
      const p = (env.t * 0.15 + rnd()) % 1;
      const x = vx + Math.sin(p * 6 + i) * 40 * p;
      const y = env.h - p * env.h * 0.95;
      ctx.globalAlpha = env.a * (1 - p) * 0.6;
      ctx.fillStyle = "#7ef0c2";
      ctx.beginPath(); ctx.arc(x, y, 1.5 + rnd() * 2, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // a single cell, dividing
    const cx = env.w * 0.5 + Math.sin(env.t * 0.4) * 30;
    const cy = env.h * 0.4 + Math.cos(env.t * 0.3) * 20;
    const split = (Math.sin(env.t * 0.5) * 0.5 + 0.5) * 18;
    drawCell(ctx, cx - split, cy, 26, env.a, env.t);
    drawCell(ctx, cx + split, cy, 26, env.a, env.t);
  };
  function drawCell(ctx, x, y, r, a, t) {
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r);
    g.addColorStop(0, rgba("#aef7d8", a * 0.9));
    g.addColorStop(1, rgba("#1f9c6e", a * 0.3));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba("#d8fff0", a * 0.7); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.fillStyle = rgba("#0c5b40", a * 0.8);
    ctx.beginPath(); ctx.arc(x + Math.sin(t) * 3, y + Math.cos(t) * 3, r * 0.3, 0, TAU); ctx.fill();
  }

  // 6. Stromatolites — sunlit shallows, microbial mounds
  scenes.stromatolites = function (ctx, env) {
    const sky = ctx.createLinearGradient(0, 0, 0, env.h);
    sky.addColorStop(0, rgba("#ffd9a0", env.a));
    sky.addColorStop(0.5, rgba("#e9b87a", env.a));
    sky.addColorStop(1, rgba("#6fa86a", env.a));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, env.w, env.h);
    glow(ctx, env.w * 0.75, env.h * 0.2, 200, "#fff6d8", env.a * 0.6);
    ocean(ctx, env, "#cfeec0", "#1d5a4a", "#3f9c7a");
    // mounds along the floor
    const rnd = makeRng(12);
    for (let i = 0; i < 9; i++) {
      const x = (i + 0.5) * (env.w / 9) + Math.sin(i) * 10;
      const baseY = env.h * 0.92;
      const hgt = 40 + rnd() * 60;
      ctx.fillStyle = rgba("#23402f", env.a);
      ctx.beginPath();
      ctx.moveTo(x - 24, baseY);
      for (let layer = 0; layer < 8; layer++) {
        const yy = baseY - layer / 8 * hgt;
        const ww = 24 * (1 - layer / 10);
        ctx.lineTo(x - ww, yy);
      }
      ctx.lineTo(x, baseY - hgt);
      for (let layer = 8; layer >= 0; layer--) {
        const yy = baseY - layer / 8 * hgt;
        const ww = 24 * (1 - layer / 10);
        ctx.lineTo(x + ww, yy);
      }
      ctx.closePath(); ctx.fill();
      // oxygen bubbles rising
      const p = (env.t * 0.3 + i * 0.2) % 1;
      ctx.globalAlpha = env.a * (1 - p) * 0.7;
      ctx.fillStyle = "#dffaff";
      ctx.beginPath(); ctx.arc(x, baseY - hgt - p * 120, 2, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
  };

  // 7. Great Oxidation — rusting seas, first ice
  scenes.oxygen = function (ctx, env) {
    const g = ctx.createLinearGradient(0, 0, 0, env.h);
    g.addColorStop(0, rgba("#9be8ff", env.a));
    g.addColorStop(0.5, rgba("#7aa6b8", env.a));
    g.addColorStop(1, rgba("#7a3a25", env.a));
    ctx.fillStyle = g; ctx.fillRect(0, 0, env.w, env.h);
    // banded iron formation stripes at the bottom
    for (let i = 0; i < 14; i++) {
      const y = env.h * 0.6 + i * (env.h * 0.4 / 14);
      ctx.fillStyle = i % 2 ? rgba("#8a2f1c", env.a) : rgba("#3a3030", env.a);
      ctx.fillRect(0, y, env.w, env.h * 0.4 / 14);
    }
    // oxygen bubbles flooding upward everywhere
    const rnd = makeRng(88);
    for (let i = 0; i < 120; i++) {
      const p = (env.t * 0.2 + rnd()) % 1;
      const x = rnd() * env.w;
      const y = env.h - p * env.h;
      ctx.globalAlpha = env.a * (1 - p) * 0.5;
      ctx.strokeStyle = "#dffaff"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 1 + rnd() * 3, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  // 8. Eukaryotes — endosymbiosis, a cell within a cell
  scenes.eukaryotes = function (ctx, env) {
    const g = ctx.createRadialGradient(env.w / 2, env.h / 2, 10, env.w / 2, env.h / 2, env.w * 0.6);
    g.addColorStop(0, rgba("#3a2a5a", env.a));
    g.addColorStop(1, rgba("#120a22", env.a));
    ctx.fillStyle = g; ctx.fillRect(0, 0, env.w, env.h);
    const cx = env.w / 2, cy = env.h / 2;
    const r = Math.min(env.w, env.h) * 0.26;
    // big host cell
    const cg = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 4, cx, cy, r);
    cg.addColorStop(0, rgba("#c9aaff", env.a * 0.8));
    cg.addColorStop(1, rgba("#5b3aa0", env.a * 0.3));
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba("#e6d6ff", env.a * 0.6); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
    // nucleus
    ctx.fillStyle = rgba("#3a1f6e", env.a * 0.8);
    ctx.beginPath(); ctx.arc(cx + Math.sin(env.t * 0.4) * 8, cy, r * 0.32, 0, TAU); ctx.fill();
    // mitochondria orbiting inside
    for (let i = 0; i < 6; i++) {
      const ang = env.t * 0.5 + i / 6 * TAU;
      const d = r * 0.62;
      const mx = cx + Math.cos(ang) * d, my = cy + Math.sin(ang) * d * 0.8;
      ctx.fillStyle = rgba("#ff8a5a", env.a * 0.9);
      ctx.save(); ctx.translate(mx, my); ctx.rotate(ang);
      ctx.beginPath(); ctx.ellipse(0, 0, 12, 6, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
  };

  // 9. Snowball Earth — frozen white world
  scenes.snowball = function (ctx, env) {
    starfield(ctx, env, 200, 0.5);
    const cx = env.w / 2, cy = env.h * 0.52;
    const r = Math.min(env.w, env.h) * 0.27;
    glow(ctx, cx, cy, r * 1.8, "#cfe9ff", env.a * 0.4);
    planet(ctx, cx, cy, r, ["#ffffff", "#dcecff", "#7da6c8"], 0.7, env.a);
    // cracks of ice
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.clip();
    ctx.strokeStyle = rgba("#9cc4e6", env.a * 0.6); ctx.lineWidth = 1;
    const rnd = makeRng(404);
    for (let i = 0; i < 26; i++) {
      ctx.beginPath();
      let x = cx + (rnd() - 0.5) * r * 2, y = cy + (rnd() - 0.5) * r * 2;
      ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.5) * 40; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.restore();
    // drifting snow
    for (let i = 0; i < 80; i++) {
      const x = (rnd() * env.w + env.t * 20) % env.w;
      const y = (rnd() * env.h + env.t * 40) % env.h;
      ctx.globalAlpha = env.a * 0.5; ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(x, y, 1.2, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  // 10. Ediacara — the quiet garden of fronds
  scenes.ediacara = function (ctx, env) {
    const g = ctx.createLinearGradient(0, 0, 0, env.h);
    g.addColorStop(0, rgba("#3a1f44", env.a));
    g.addColorStop(1, rgba("#120a1a", env.a));
    ctx.fillStyle = g; ctx.fillRect(0, 0, env.w, env.h);
    glow(ctx, env.w * 0.5, 0, 400, "#ff9ecb", env.a * 0.15);
    // floor
    ctx.fillStyle = rgba("#241327", env.a);
    ctx.fillRect(0, env.h * 0.85, env.w, env.h * 0.15);
    // soft fronds swaying
    const rnd = makeRng(64);
    for (let i = 0; i < 12; i++) {
      const x = (i + 0.5) * env.w / 12;
      const sway = Math.sin(env.t * 0.6 + i) * 0.8;
      frond(ctx, x, env.h * 0.86, 1.1 + rnd() * 0.6, "#ff9ecb", env.a * 0.85, sway);
    }
    // drifting motes
    for (let i = 0; i < 40; i++) {
      const x = (rnd() * env.w + env.t * 8) % env.w;
      const y = (rnd() * env.h * 0.8 + env.t * 5) % (env.h * 0.8);
      ctx.globalAlpha = env.a * 0.4; ctx.fillStyle = "#ffd6ea";
      ctx.beginPath(); ctx.arc(x, y, 1.3, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  // 11. Cambrian — explosion of forms, predators and trilobites
  scenes.cambrian = function (ctx, env) {
    const g = ctx.createLinearGradient(0, 0, 0, env.h);
    g.addColorStop(0, rgba("#1d3a52", env.a));
    g.addColorStop(1, rgba("#06121d", env.a));
    ctx.fillStyle = g; ctx.fillRect(0, 0, env.w, env.h);
    // shafts of light
    for (let i = 0; i < 5; i++) {
      const x = env.w * (0.2 + i * 0.16);
      ctx.fillStyle = rgba("#bfe6ff", env.a * 0.05);
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x + 60, 0); ctx.lineTo(x + 120, env.h); ctx.lineTo(x - 60, env.h);
      ctx.closePath(); ctx.fill();
    }
    // Anomalocaris swimming across
    const ax = (env.t * 60) % (env.w + 200) - 100;
    drawAnomalocaris(ctx, ax, env.h * 0.35 + Math.sin(env.t) * 20, env.a, env.t);
    // trilobites on the floor
    const rnd = makeRng(31);
    for (let i = 0; i < 8; i++) {
      const x = (i * 140 + env.t * 12) % (env.w + 60) - 30;
      trilobite(ctx, x, env.h * 0.88 - rnd() * 20, 1 + rnd(), "#c98a4a", env.a * 0.9);
    }
    // swimming fish/larvae specks
    for (let i = 0; i < 16; i++) {
      const x = (i * 90 + env.t * 40) % (env.w + 40) - 20;
      const y = env.h * (0.3 + (i % 5) * 0.1) + Math.sin(env.t * 2 + i) * 12;
      fishShape(ctx, x, y, 0.5, "#7fd6c2", env.a * 0.8, Math.sin(env.t * 6 + i) * 4);
    }
  };
  function drawAnomalocaris(ctx, x, y, a, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = rgba("#d98a5a", a * 0.9);
    // body
    ctx.beginPath(); ctx.ellipse(0, 0, 50, 16, 0, 0, TAU); ctx.fill();
    // side flaps
    ctx.fillStyle = rgba("#b56a3a", a * 0.8);
    for (let i = -3; i <= 3; i++) {
      const fx = i * 12;
      const flap = Math.sin(t * 4 + i) * 6;
      ctx.beginPath();
      ctx.ellipse(fx, 18 + flap, 8, 14, 0, 0, TAU); ctx.fill();
      ctx.beginPath();
      ctx.ellipse(fx, -18 - flap, 8, 14, 0, 0, TAU); ctx.fill();
    }
    // grasping arms at front
    ctx.strokeStyle = rgba("#8a4a28", a * 0.9); ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(50, -4); ctx.quadraticCurveTo(78, 4 + Math.sin(t * 3) * 6, 70, 16); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(50, 4); ctx.quadraticCurveTo(78, 12 + Math.sin(t * 3 + 1) * 6, 70, 24); ctx.stroke();
    ctx.restore();
  }

  // 12. Age of fish — Dunkleosteus
  scenes.fish = function (ctx, env) {
    const g = ctx.createLinearGradient(0, 0, 0, env.h);
    g.addColorStop(0, rgba("#15495a", env.a));
    g.addColorStop(1, rgba("#04181f", env.a));
    ctx.fillStyle = g; ctx.fillRect(0, 0, env.w, env.h);
    // schooling fish
    const rnd = makeRng(72);
    for (let i = 0; i < 30; i++) {
      const x = (i * 60 + env.t * 50) % (env.w + 40) - 20;
      const y = env.h * (0.25 + rnd() * 0.4) + Math.sin(env.t * 2 + i) * 10;
      fishShape(ctx, x, y, 0.7, "#9fe6d8", env.a * 0.8, Math.sin(env.t * 6 + i) * 4);
    }
    // Dunkleosteus cruising
    const dx = (env.t * 40) % (env.w + 400) - 200;
    drawDunkle(ctx, dx, env.h * 0.55, env.a, env.t);
  };
  function drawDunkle(ctx, x, y, a, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = rgba("#36707a", a);
    ctx.beginPath();
    ctx.moveTo(-110, 0);
    ctx.quadraticCurveTo(-60, -36, 0, -34);
    ctx.quadraticCurveTo(40, -32, 60, -18);     // armoured head
    ctx.lineTo(74, -14);
    ctx.lineTo(60, -2);                           // upper jaw blade
    ctx.lineTo(72, 6);
    ctx.lineTo(58, 14);                           // lower jaw blade
    ctx.quadraticCurveTo(40, 30, 0, 32);
    ctx.quadraticCurveTo(-60, 34, -110, 0);
    ctx.fill();
    // tail
    ctx.beginPath();
    ctx.moveTo(-100, 0); ctx.lineTo(-140, -22 + Math.sin(t * 3) * 8);
    ctx.lineTo(-126, 0); ctx.lineTo(-140, 22 + Math.sin(t * 3) * 8); ctx.closePath(); ctx.fill();
    // eye
    ctx.fillStyle = rgba("#ffe08a", a); ctx.beginPath(); ctx.arc(40, -10, 4, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // 13. Onto land — Tiktaalik on the shore
  scenes.land = function (ctx, env) {
    const sky = ctx.createLinearGradient(0, 0, 0, env.h);
    sky.addColorStop(0, rgba("#f2c97a", env.a));
    sky.addColorStop(0.6, rgba("#c98a4a", env.a));
    sky.addColorStop(1, rgba("#6fae3a", env.a));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, env.w, env.h);
    glow(ctx, env.w * 0.7, env.h * 0.25, 180, "#fff0c8", env.a * 0.5);
    // water on the left, mud on the right
    ctx.fillStyle = rgba("#2f7b8a", env.a);
    ctx.beginPath();
    ctx.moveTo(0, env.h * 0.7);
    for (let x = 0; x <= env.w * 0.5; x += 12) {
      ctx.lineTo(x, env.h * 0.7 + Math.sin(x * 0.02 + env.t) * 6);
    }
    ctx.lineTo(env.w * 0.5, env.h); ctx.lineTo(0, env.h); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba("#5a4a2c", env.a);
    ctx.fillRect(0, env.h * 0.82, env.w, env.h * 0.18);
    // early plants on the bank
    for (let i = 0; i < 8; i++) {
      const x = env.w * 0.55 + i * 50;
      frond(ctx, x, env.h * 0.84, 0.7, "#3f7a2a", env.a, Math.sin(env.t + i) * 0.4);
    }
    // Tiktaalik hauling out at the waterline
    drawTetrapod(ctx, env.w * 0.42, env.h * 0.8, env.a, env.t);
  };
  function drawTetrapod(ctx, x, y, a, t) {
    ctx.save();
    ctx.translate(x, y);
    const crawl = Math.sin(t * 2) * 6;
    ctx.fillStyle = rgba("#3a5a3a", a);
    ctx.beginPath();
    ctx.moveTo(-70, 0);
    ctx.quadraticCurveTo(-30, -14, 10, -12);
    ctx.quadraticCurveTo(40, -11, 54, -4);       // flat head
    ctx.lineTo(60, -2); ctx.lineTo(54, 4);
    ctx.quadraticCurveTo(30, 10, 0, 10);
    ctx.quadraticCurveTo(-40, 10, -70, 0);
    ctx.fill();
    // stubby limbs propping it up
    ctx.strokeStyle = rgba("#2c4a2c", a); ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(28, 6); ctx.lineTo(34 + crawl, 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-30, 6); ctx.lineTo(-36 - crawl, 20); ctx.stroke();
    // eye
    ctx.fillStyle = rgba("#ffe08a", a); ctx.beginPath(); ctx.arc(38, -4, 3, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // 14. Carboniferous — coal forest, giant dragonfly
  scenes.carbon = function (ctx, env) {
    const sky = ctx.createLinearGradient(0, 0, 0, env.h);
    sky.addColorStop(0, rgba("#7fb46a", env.a));
    sky.addColorStop(1, rgba("#1d3a1d", env.a));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, env.w, env.h);
    // dense forest layers
    const rnd = makeRng(140);
    for (let layer = 0; layer < 3; layer++) {
      const shade = ["#0f2a12", "#1d3f1d", "#2f5a2a"][layer];
      const baseY = env.h * (0.6 + layer * 0.13);
      for (let i = 0; i < 8; i++) {
        const x = rnd() * env.w;
        const h = env.h * (0.4 - layer * 0.08);
        ctx.fillStyle = rgba(shade, env.a);
        ctx.fillRect(x, baseY, 10 - layer * 2, h);
        // crown of fronds
        for (let f = 0; f < 5; f++) {
          frond(ctx, x + 5, baseY, 1 - layer * 0.2, shade, env.a, Math.cos(env.t * 0.5 + f + i) * 0.6);
        }
      }
    }
    // giant dragonfly
    const dx = (env.t * 80) % (env.w + 200) - 100;
    drawDragonfly(ctx, dx, env.h * 0.3 + Math.sin(env.t * 2) * 30, env.a, env.t);
  };
  function drawDragonfly(ctx, x, y, a, t) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = rgba("#2c3a1a", a);
    ctx.beginPath(); ctx.ellipse(0, 0, 40, 4, 0, 0, TAU); ctx.fill(); // body
    ctx.fillStyle = rgba("#3a5a2a", a);
    ctx.beginPath(); ctx.arc(34, 0, 6, 0, TAU); ctx.fill();           // head
    // beating wings
    const beat = Math.sin(t * 14) * 0.5;
    ctx.fillStyle = rgba("#bfe6c8", a * 0.4);
    for (const sx of [-12, 6]) {
      ctx.save(); ctx.translate(sx, 0); ctx.rotate(beat);
      ctx.beginPath(); ctx.ellipse(0, -24, 8, 26, 0, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.save(); ctx.translate(sx, 0); ctx.rotate(-beat);
      ctx.beginPath(); ctx.ellipse(0, 24, 8, 26, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  // 15. Rise of reptiles — Dimetrodon on dry Pangaea
  scenes.reptiles = function (ctx, env) {
    const sky = ctx.createLinearGradient(0, 0, 0, env.h);
    sky.addColorStop(0, rgba("#f2b06a", env.a));
    sky.addColorStop(0.5, rgba("#d98a4a", env.a));
    sky.addColorStop(1, rgba("#8a5a2a", env.a));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, env.w, env.h);
    glow(ctx, env.w * 0.2, env.h * 0.3, 160, "#ffe6b0", env.a * 0.5);
    // distant dunes / mountains
    for (let layer = 0; layer < 3; layer++) {
      ctx.fillStyle = rgba(["#7a4a24", "#92592c", "#a86a34"][layer], env.a);
      ctx.beginPath();
      ctx.moveTo(0, env.h);
      for (let x = 0; x <= env.w; x += 40) {
        ctx.lineTo(x, env.h * (0.6 + layer * 0.08) + Math.sin(x * 0.005 + layer) * 30);
      }
      ctx.lineTo(env.w, env.h); ctx.closePath(); ctx.fill();
    }
    // ground
    ctx.fillStyle = rgba("#6a4220", env.a); ctx.fillRect(0, env.h * 0.84, env.w, env.h * 0.16);
    // a herd of Dimetrodon basking
    drawShadowOval(ctx, env.w * 0.5, env.h * 0.9, 70, env.a);
    dimetrodon(ctx, env.w * 0.5, env.h * 0.86, 1.7, "#5a3a1a", env.a);
    drawShadowOval(ctx, env.w * 0.78, env.h * 0.86, 40, env.a);
    dimetrodon(ctx, env.w * 0.78, env.h * 0.83, 1.0, "#4a3018", env.a * 0.9);
  };
  function drawShadowOval(ctx, x, y, w, a) {
    ctx.fillStyle = `rgba(0,0,0,${0.25 * a})`;
    ctx.beginPath(); ctx.ellipse(x, y, w, w * 0.18, 0, 0, TAU); ctx.fill();
  }

  // 16. The Great Dying — volcanic apocalypse
  scenes.permian_ext = function (ctx, env) {
    const sky = ctx.createLinearGradient(0, 0, 0, env.h);
    sky.addColorStop(0, rgba("#2a0a08", env.a));
    sky.addColorStop(0.5, rgba("#7a1a0a", env.a));
    sky.addColorStop(1, rgba("#1a0604", env.a));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, env.w, env.h);
    drawVolcanoes(ctx, env);
    // ash falling
    const rnd = makeRng(202);
    for (let i = 0; i < 160; i++) {
      const x = (rnd() * env.w + env.t * 15) % env.w;
      const y = (rnd() * env.h + env.t * 70) % env.h;
      ctx.globalAlpha = env.a * 0.4; ctx.fillStyle = rnd() > 0.5 ? "#3a2a26" : "#705a52";
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
    // red haze pulse
    ctx.fillStyle = rgba("#ff2d10", env.a * (0.05 + 0.05 * Math.sin(env.t * 0.8)));
    ctx.fillRect(0, 0, env.w, env.h);
  };
  function drawVolcanoes(ctx, env) {
    const rnd = makeRng(909);
    for (let i = 0; i < 4; i++) {
      const x = env.w * (0.15 + i * 0.24);
      const baseY = env.h;
      const peak = env.h * (0.55 + rnd() * 0.1);
      ctx.fillStyle = rgba("#1a0e0a", env.a);
      ctx.beginPath();
      ctx.moveTo(x - 120, baseY); ctx.lineTo(x, peak); ctx.lineTo(x + 120, baseY); ctx.closePath(); ctx.fill();
      // lava glow at the vent
      glow(ctx, x, peak, 60, "#ff7a1a", env.a * 0.8);
      // erupting embers
      for (let e = 0; e < 14; e++) {
        const p = (env.t * 0.5 + e / 14 + i) % 1;
        const ex = x + Math.sin(e * 2 + i) * 60 * p;
        const ey = peak - p * 220;
        ctx.globalAlpha = env.a * (1 - p);
        ctx.fillStyle = "#ffca5a";
        ctx.beginPath(); ctx.arc(ex, ey, 2 + (1 - p) * 2, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // lava flow down the slope
      ctx.strokeStyle = rgba("#ff5a1a", env.a * 0.8); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, peak);
      ctx.quadraticCurveTo(x + 30, env.h * 0.8, x + 10, baseY); ctx.stroke();
    }
  }

  // 17. Triassic — first small, upright dinosaurs
  scenes.triassic = function (ctx, env) {
    const sky = ctx.createLinearGradient(0, 0, 0, env.h);
    sky.addColorStop(0, rgba("#e6b06a", env.a));
    sky.addColorStop(1, rgba("#7a5a2a", env.a));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, env.w, env.h);
    glow(ctx, env.w * 0.8, env.h * 0.2, 160, "#ffe6b0", env.a * 0.5);
    // rift valley with smoking fissure (Pangaea cracking)
    ctx.fillStyle = rgba("#5a3a1a", env.a); ctx.fillRect(0, env.h * 0.82, env.w, env.h * 0.18);
    ctx.strokeStyle = rgba("#ff7a3a", env.a * 0.6); ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(env.w * 0.1, env.h * 0.9);
    for (let x = env.w * 0.1; x < env.w * 0.9; x += 30) ctx.lineTo(x, env.h * 0.9 + Math.sin(x) * 6);
    ctx.stroke();
    // small dinosaurs running
    for (let i = 0; i < 3; i++) {
      const x = (env.t * 70 + i * 200) % (env.w + 100) - 50;
      drawShadowOval(ctx, x, env.h * 0.82, 22, env.a);
      drawSmallDino(ctx, x, env.h * 0.8, 0.9, "#3a2a14", env.a, Math.sin(env.t * 8 + i) * 4);
    }
  };
  function drawSmallDino(ctx, x, y, s, color, a, stride) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = rgba(color, a);
    ctx.beginPath();
    ctx.moveTo(-34, -6);
    ctx.quadraticCurveTo(-16, -16, -2, -18);
    ctx.quadraticCurveTo(8, -20, 16, -16);     // neck
    ctx.quadraticCurveTo(24, -14, 26, -20);    // head
    ctx.lineTo(30, -18); ctx.lineTo(24, -12);
    ctx.lineTo(12, -8); ctx.lineTo(14, 0);      // tiny arm
    ctx.lineTo(8, -4);
    ctx.lineTo(6, 12 + stride);                 // leg
    ctx.lineTo(0, 12 + stride);
    ctx.lineTo(2, -4);
    ctx.lineTo(-8, 12 - stride);                // leg
    ctx.lineTo(-14, 12 - stride);
    ctx.quadraticCurveTo(-12, -6, -20, -8);
    ctx.quadraticCurveTo(-30, -8, -34, -6);
    ctx.fill();
    ctx.restore();
  }

  // 18. End-Triassic — the door opens (rift volcanism, dawn light)
  scenes.triassic_ext = function (ctx, env) {
    const sky = ctx.createLinearGradient(0, 0, 0, env.h);
    sky.addColorStop(0, rgba("#3a1a0a", env.a));
    sky.addColorStop(0.5, rgba("#aa4a1a", env.a));
    sky.addColorStop(1, rgba("#2a1206", env.a));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, env.w, env.h);
    // a great rift glowing across the middle (Pangaea splitting)
    glow(ctx, env.w * 0.5, env.h * 0.7, env.w * 0.6, "#ff6a1a", env.a * 0.4);
    ctx.fillStyle = rgba("#1a0e08", env.a);
    ctx.beginPath();
    ctx.moveTo(0, env.h * 0.62);
    for (let x = 0; x <= env.w; x += 30) ctx.lineTo(x, env.h * 0.62 + Math.sin(x * 0.01) * 16);
    ctx.lineTo(env.w, env.h); ctx.lineTo(0, env.h); ctx.closePath(); ctx.fill();
    // glowing fissure line
    ctx.strokeStyle = rgba("#ffca5a", env.a * 0.9); ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = 0; x <= env.w; x += 20) {
      const y = env.h * 0.74 + Math.sin(x * 0.02 + env.t) * 8;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    // embers rising
    const rnd = makeRng(77);
    for (let i = 0; i < 60; i++) {
      const p = (env.t * 0.3 + rnd()) % 1;
      const x = rnd() * env.w;
      const y = env.h * 0.74 - p * env.h * 0.6;
      ctx.globalAlpha = env.a * (1 - p) * 0.7; ctx.fillStyle = "#ffb24a";
      ctx.beginPath(); ctx.arc(x, y, 1.5, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  // 19. Jurassic — giants and the first birds
  scenes.jurassic = function (ctx, env) {
    const sky = ctx.createLinearGradient(0, 0, 0, env.h);
    sky.addColorStop(0, rgba("#bfe0f2", env.a));
    sky.addColorStop(0.6, rgba("#8ac0a0", env.a));
    sky.addColorStop(1, rgba("#3a6a4a", env.a));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, env.w, env.h);
    glow(ctx, env.w * 0.18, env.h * 0.22, 140, "#fff3d0", env.a * 0.5);
    // conifer hills
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = rgba(["#2f5a3a", "#3f7a4a"][layer], env.a);
      ctx.beginPath(); ctx.moveTo(0, env.h);
      for (let x = 0; x <= env.w; x += 40) ctx.lineTo(x, env.h * (0.62 + layer * 0.1) + Math.sin(x * 0.006 + layer) * 26);
      ctx.lineTo(env.w, env.h); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = rgba("#2a4a30", env.a); ctx.fillRect(0, env.h * 0.85, env.w, env.h * 0.15);
    // a grazing sauropod, neck swaying
    drawShadowOval(ctx, env.w * 0.4, env.h * 0.9, 90, env.a);
    sauropod(ctx, env.w * 0.4, env.h * 0.88, 2.2, "#3a5a3a", env.a);
    // a second, distant
    sauropod(ctx, env.w * 0.72, env.h * 0.78, 1.2, "#2f4a30", env.a * 0.8);
    // Archaeopteryx gliding
    for (let i = 0; i < 3; i++) {
      const x = (env.t * 50 + i * 160) % (env.w + 100) - 50;
      drawBird(ctx, x, env.h * 0.28 + Math.sin(env.t * 1.5 + i) * 24, env.a, env.t + i);
    }
  };
  function drawBird(ctx, x, y, a, t) {
    ctx.save(); ctx.translate(x, y);
    const flap = Math.sin(t * 5) * 0.5;
    ctx.strokeStyle = rgba("#2a2a2a", a); ctx.lineWidth = 3; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-14, -flap * 10); ctx.quadraticCurveTo(0, flap * 6, 0, 0);
    ctx.quadraticCurveTo(0, flap * 6, 14, -flap * 10); ctx.stroke();
    ctx.restore();
  }

  // 20. Cretaceous — T. rex reign, flowers, Triceratops
  scenes.cretaceous = function (ctx, env) {
    const sky = ctx.createLinearGradient(0, 0, 0, env.h);
    sky.addColorStop(0, rgba("#f2c89a", env.a));
    sky.addColorStop(0.5, rgba("#c99a6a", env.a));
    sky.addColorStop(1, rgba("#5a6a3a", env.a));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, env.w, env.h);
    glow(ctx, env.w * 0.75, env.h * 0.2, 160, "#fff0c8", env.a * 0.5);
    // hills
    ctx.fillStyle = rgba("#4a5a2a", env.a);
    ctx.beginPath(); ctx.moveTo(0, env.h);
    for (let x = 0; x <= env.w; x += 40) ctx.lineTo(x, env.h * 0.66 + Math.sin(x * 0.006) * 26);
    ctx.lineTo(env.w, env.h); ctx.closePath(); ctx.fill();
    // flowering ground
    ctx.fillStyle = rgba("#3a4a22", env.a); ctx.fillRect(0, env.h * 0.82, env.w, env.h * 0.18);
    const rnd = makeRng(150);
    for (let i = 0; i < 40; i++) {
      const x = rnd() * env.w, y = env.h * (0.84 + rnd() * 0.14);
      ctx.fillStyle = rgba(["#ff6a8a", "#ffd24a", "#fff", "#c98aff"][i % 4], env.a * 0.9);
      ctx.beginPath(); ctx.arc(x, y, 2.4, 0, TAU); ctx.fill();
    }
    // a Triceratops grazing on the right
    drawShadowOval(ctx, env.w * 0.78, env.h * 0.9, 60, env.a);
    drawTriceratops(ctx, env.w * 0.78, env.h * 0.86, 1.5, "#5a4a2a", env.a);
    // T. rex striding in, the apex
    const tx = env.w * 0.35 + Math.sin(env.t * 0.3) * 30;
    drawShadowOval(ctx, tx, env.h * 0.9, 60, env.a);
    trex(ctx, tx, env.h * 0.86, 2.0, "#3a2a1a", env.a, Math.sin(env.t * 2) * 4);
  };
  function drawTriceratops(ctx, x, y, s, color, a) {
    ctx.save(); ctx.translate(x, y); ctx.scale(-s, s); // face left
    ctx.fillStyle = rgba(color, a);
    ctx.beginPath();
    ctx.moveTo(-50, 0);
    ctx.quadraticCurveTo(-20, -18, 14, -16);     // back
    ctx.quadraticCurveTo(30, -16, 38, -22);      // frill top
    ctx.quadraticCurveTo(50, -16, 50, -2);       // frill
    ctx.lineTo(44, -10);                          // horn base
    ctx.lineTo(58, -16);                          // brow horn
    ctx.lineTo(46, -4);
    ctx.lineTo(56, 2);                            // nose horn
    ctx.lineTo(44, 4);
    ctx.quadraticCurveTo(30, 12, 0, 12);
    ctx.lineTo(8, 26); ctx.lineTo(2, 26); ctx.lineTo(-2, 12);   // legs
    ctx.lineTo(-30, 12); ctx.lineTo(-24, 26); ctx.lineTo(-30, 26); ctx.lineTo(-38, 12);
    ctx.quadraticCurveTo(-46, 10, -50, 0);
    ctx.fill();
    ctx.restore();
  }

  // 21. K-Pg — the asteroid and the long dark
  scenes.kpg_ext = function (ctx, env) {
    const impact = clamp(env.t / 2.5, 0, 1); // 0 incoming, 1 aftermath
    const sky = ctx.createLinearGradient(0, 0, 0, env.h);
    sky.addColorStop(0, rgba("#1a0604", env.a));
    sky.addColorStop(0.5, rgba(lerpHex("#3a1408", "#7a1a06", impact), env.a));
    sky.addColorStop(1, rgba("#0a0202", env.a));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, env.w, env.h);
    // the incoming asteroid streaks from upper-left
    if (impact < 1) {
      const p = impact;
      const ax = lerp(-100, env.w * 0.5, p);
      const ay = lerp(-100, env.h * 0.78, p);
      // fiery tail
      ctx.strokeStyle = rgba("#ffd06a", env.a);
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax - 160 * (1 - p) - 40, ay - 120 * (1 - p) - 30); ctx.stroke();
      glow(ctx, ax, ay, 40, "#fff", env.a);
      ctx.fillStyle = rgba("#2a1a14", env.a);
      ctx.beginPath(); ctx.arc(ax, ay, 14, 0, TAU); ctx.fill();
    }
    // the impact flash and shockwave
    if (impact >= 0.98) {
      const aft = (env.t - 2.5);
      glow(ctx, env.w * 0.5, env.h * 0.8, 200 + aft * 200, "#ff8a2a", env.a * Math.max(0, 0.8 - aft * 0.15));
      // expanding shock ring
      const ring = (aft * 300) % env.w;
      ctx.strokeStyle = rgba("#ffca6a", env.a * Math.max(0, 0.6 - aft * 0.1));
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(env.w * 0.5, env.h * 0.8, ring, 0, TAU); ctx.stroke();
      // rain of molten ejecta
      const rnd = makeRng(660);
      for (let i = 0; i < 120; i++) {
        const pp = (env.t * 0.4 + rnd()) % 1;
        const x = rnd() * env.w;
        const y = pp * env.h;
        ctx.globalAlpha = env.a * (1 - pp) * 0.7; ctx.strokeStyle = "#ffb24a"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y + 16); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // silhouetted dino watching the sky
    drawSilhouetteDino(ctx, env.w * 0.2, env.h * 0.92, env.a);
  };
  function drawSilhouetteDino(ctx, x, y, a) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = `rgba(0,0,0,${0.9 * a})`;
    ctx.beginPath();
    ctx.moveTo(-40, 0);
    ctx.quadraticCurveTo(-20, -30, -6, -46);
    ctx.quadraticCurveTo(2, -56, 14, -54);
    ctx.lineTo(18, -48); ctx.lineTo(8, -44);
    ctx.quadraticCurveTo(0, -26, -2, -2);
    ctx.lineTo(4, 0); ctx.lineTo(-2, 0);
    ctx.lineTo(-10, 0);
    ctx.quadraticCurveTo(-26, 0, -40, 0);
    ctx.fill();
    ctx.restore();
  }
  function lerpHex(h1, h2, t) {
    const a = hexToRgb(h1), b = hexToRgb(h2);
    const c = a.map((v, i) => Math.round(lerp(v, b[i], t)));
    return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  }

  // 22. Mammals — green recovery, small mammals, a whale ancestor
  scenes.mammals = function (ctx, env) {
    const sky = ctx.createLinearGradient(0, 0, 0, env.h);
    sky.addColorStop(0, rgba("#cfe6f2", env.a));
    sky.addColorStop(0.6, rgba("#a0c98a", env.a));
    sky.addColorStop(1, rgba("#5a7a3a", env.a));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, env.w, env.h);
    glow(ctx, env.w * 0.8, env.h * 0.2, 150, "#fff6e0", env.a * 0.5);
    // rolling grassland
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = rgba(["#5a8a3a", "#7aae4a"][layer], env.a);
      ctx.beginPath(); ctx.moveTo(0, env.h);
      for (let x = 0; x <= env.w; x += 40) ctx.lineTo(x, env.h * (0.66 + layer * 0.1) + Math.sin(x * 0.005 + layer) * 20);
      ctx.lineTo(env.w, env.h); ctx.closePath(); ctx.fill();
    }
    // small mammals scurrying
    for (let i = 0; i < 4; i++) {
      const x = (env.t * 45 + i * 130) % (env.w + 80) - 40;
      drawMammal(ctx, x, env.h * 0.86 + (i % 2) * 20, 0.8, "#6a4a2a", env.a, Math.sin(env.t * 8 + i) * 3);
    }
    // primate ancestor up in a tree on the right
    drawTree(ctx, env.w * 0.85, env.h * 0.88, env.a, env.t);
  };
  function drawMammal(ctx, x, y, s, color, a, bob) {
    ctx.save(); ctx.translate(x, y + bob); ctx.scale(s, s);
    ctx.fillStyle = rgba(color, a);
    ctx.beginPath(); ctx.ellipse(0, 0, 18, 9, 0, 0, TAU); ctx.fill(); // body
    ctx.beginPath(); ctx.arc(16, -4, 6, 0, TAU); ctx.fill();          // head
    ctx.strokeStyle = rgba(color, a); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.quadraticCurveTo(-30, -8, -34, 0); ctx.stroke(); // tail
    // legs
    ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(10, 16); ctx.moveTo(-8, 8); ctx.lineTo(-10, 16); ctx.stroke();
    ctx.restore();
  }
  function drawTree(ctx, x, y, a, t) {
    ctx.strokeStyle = rgba("#4a3420", a); ctx.lineWidth = 10; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 120); ctx.stroke();
    ctx.fillStyle = rgba("#3f7a3a", a);
    ctx.beginPath(); ctx.arc(x, y - 140, 50, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 40, y - 110, 34, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 40, y - 110, 34, 0, TAU); ctx.fill();
    // a small primate clinging
    ctx.fillStyle = rgba("#3a2410", a);
    const px = x - 30 + Math.sin(t) * 4;
    ctx.beginPath(); ctx.arc(px, y - 96, 7, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(px, y - 82, 5, 9, 0, 0, TAU); ctx.fill();
  }

  // 23. Humans — savanna, fire, a figure looking up at stars
  scenes.humans = function (ctx, env) {
    const sky = ctx.createLinearGradient(0, 0, 0, env.h);
    sky.addColorStop(0, rgba("#0a1430", env.a));
    sky.addColorStop(0.5, rgba("#3a2a4a", env.a));
    sky.addColorStop(1, rgba("#1a1020", env.a));
    ctx.fillStyle = sky; ctx.fillRect(0, 0, env.w, env.h);
    starfield(ctx, env, 300, 0.9);
    // the Milky Way band
    ctx.save();
    ctx.globalAlpha = env.a * 0.15;
    const mg = ctx.createLinearGradient(0, env.h * 0.1, env.w, env.h * 0.4);
    mg.addColorStop(0, "rgba(180,200,255,0)");
    mg.addColorStop(0.5, "rgba(200,210,255,0.8)");
    mg.addColorStop(1, "rgba(180,200,255,0)");
    ctx.fillStyle = mg;
    ctx.fillRect(0, env.h * 0.12, env.w, env.h * 0.2);
    ctx.restore();
    // horizon
    ctx.fillStyle = rgba("#0c0810", env.a); ctx.fillRect(0, env.h * 0.78, env.w, env.h * 0.22);
    // a campfire
    const fx = env.w * 0.62, fy = env.h * 0.8;
    glow(ctx, fx, fy, 90 + Math.sin(env.t * 6) * 8, "#ffb24a", env.a * 0.7);
    for (let i = 0; i < 8; i++) {
      const p = (env.t * 1.5 + i / 8) % 1;
      ctx.globalAlpha = env.a * (1 - p);
      ctx.fillStyle = i % 2 ? "#ffca5a" : "#ff7a2a";
      ctx.beginPath(); ctx.arc(fx + Math.sin(p * 8 + i) * 6, fy - p * 40, (1 - p) * 6 + 1, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // a human figure, standing, looking up
    drawHuman(ctx, env.w * 0.4, env.h * 0.8, env.a);
  };
  function drawHuman(ctx, x, y, a) {
    ctx.fillStyle = `rgba(8,6,10,${a})`;
    // head tilted up
    ctx.beginPath(); ctx.arc(x, y - 70, 7, 0, TAU); ctx.fill();
    // body
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 60);
    ctx.lineTo(x + 6, y - 60);
    ctx.lineTo(x + 4, y - 24);
    ctx.lineTo(x - 4, y - 24);
    ctx.closePath(); ctx.fill();
    // legs
    ctx.strokeStyle = `rgba(8,6,10,${a})`; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x - 2, y - 26); ctx.lineTo(x - 6, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 2, y - 26); ctx.lineTo(x + 6, y); ctx.stroke();
    // one arm raised toward the sky
    ctx.beginPath(); ctx.moveTo(x + 4, y - 54); ctx.lineTo(x + 18, y - 74); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 4, y - 54); ctx.lineTo(x - 10, y - 36); ctx.stroke();
  }

  // expose
  window.SCENES = scenes;
})();
