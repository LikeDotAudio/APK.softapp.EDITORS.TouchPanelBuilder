// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* everythingView.js — the two pages Everything (js/everything.js) draws on a
   running touch panel (run.html), after the family GUI file's pages.

   EVERYTHING IN — one tile per data point: a number gets its own needle meter (the
   same `vu` control the panel's own READING draws, controls.js, scaled to a tile;
   its range held by stickyDecade), a word gets a text tile. Its colour is its
   identity's (toneOf). A tile is redrawn ONLY when its point's proven reply comes
   in (it ticks once); a timer only greys what has gone stale (5 min, the trust
   rule) or offline (a recorder NULL). Measured first, settings after.

   EVERYTHING OVER TIME — every data point's trend, small multiples on ONE canvas
   sharing one time axis (the house log "doppler" time, Log/Linear, Log first),
   so a moment lines up across all of them; a cursor line and readout of every
   value at the hovered time. Low cost (owner): one canvas, each series decimated
   to min/max per pixel column, redrawn only on a new proven value, a pan / zoom
   or a resize, and not at all while the page or the tab is hidden. A NULL (the
   unit offline) breaks the line. Pan: drag; zoom: wheel; the SpaceMouse through
   APKGraphPuck (vendor/apk-graph-puck), the one graph receiver.

   EXPORT. Both pages are tables to APKTable (vendor/apk-table, the one export
   path): the CSV button is the registered table's exportCsv. */

import { CONTROL_DEFINITIONS } from './controls.js';
import { Everything, engineering, askerName, timeToFrac, fracToTime } from './everything.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const clock = (ms) => {
  const d = new Date(ms);
  const two = (n) => String(n).padStart(2, '0');
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}`;
};

/* The download name: <model>_<serial or resource>_<what>_<timestamp>. */
export function fileStem(who, what, now = Date.now()) {
  const clean = (v) => String(v || '').replace(/[^A-Za-z0-9.-]+/g, '_').replace(/^_+|_+$/g, '');
  return [clean(who.model) || 'device', clean(who.serial || who.resource) || 'unit', what,
    new Date(now).toISOString().replace(/[:.]/g, '-')].join('_');
}

function register(id, columns, rows) {
  const T = window.APKTable;
  return T && typeof T.register === 'function' ? T.register(id, { columns: () => columns, rows }) : null;
}

/* ------------------------------------------------------------ EVERYTHING IN */

function tileHtml(every, p, now) {
  const unit = every.unitOf(p);
  const fresh = every.fresh(p, now);
  const cls = `ei-tile${fresh ? '' : ' is-haze'}${p.offline ? ' is-offline' : ''}`;
  const foot = `<div class="ei-foot"><span class="ei-scpi">${esc(p.scpi)}</span>
      <span>${p.offline ? 'offline' : p.at ? clock(p.at) : '—'} · ${esc(askerName(p.asker))}</span></div>`;
  if (p.value === null && !p.offline && p.raw !== '') {
    return `<div class="${cls} ei-text" data-id="${esc(p.id)}" style="--tone:${p.colour}">
      <div class="ei-name">${esc(p.label)}</div><div class="ei-word">${esc(p.raw)}</div>${foot}</div>`;
  }
  // The needle reads the proven value only; offline or never read, it rests.
  const meter = CONTROL_DEFINITIONS.vu.render({
    label: p.label, value: p.offline ? null : p.value,
    shown: p.value === null ? '—' : engineering(p.value, unit),
    behavior: { unit: unit || ' ', decade: p.decade }, needle: p.colour, style: {},
  });
  return `<div class="${cls}" data-id="${esc(p.id)}" style="--tone:${p.colour}">
    <div class="ei-name">${esc(p.label)}</div><div class="ei-meter">${meter}</div>${foot}</div>`;
}

export function mountEverythingIn(host, every, who) {
  host.innerHTML = `<div class="ev-page">
      <div class="ev-head"><b>EVERYTHING IN</b><span class="ev-count"></span>
        <span class="ev-why">every answer the unit gave, one meter each · live only on its own reply · grey when 5 min unproven or offline</span>
        <button type="button" class="ev-btn" data-export>⤓ CSV</button></div>
      <div class="ei-grid"></div></div>`;
  const grid = host.querySelector('.ei-grid');
  const count = host.querySelector('.ev-count');
  const table = register(`everything-in-${who.key || 'unit'}`, [
    { key: 'point', label: 'data point' }, { key: 'scpi', label: 'scpi' }, { key: 'value', label: 'value' },
    { key: 'unit', label: 'unit' }, { key: 'raw', label: 'answer' }, { key: 'time', label: 'time' }, { key: 'asker', label: 'asker' }],
  () => every.points().map(p => ({ point: p.label, scpi: p.scpi, value: p.value ?? '', unit: every.unitOf(p), raw: p.raw,
    time: p.at ? new Date(p.at).toISOString() : '', asker: p.asker })));
  host.querySelector('[data-export]').addEventListener('click', () => table && table.exportCsv(`${fileStem(who, 'everything_in')}.csv`));

  const order = () => every.points().map(p => p.id).join('|');
  let laid = '';
  const all = () => {
    const now = Date.now();
    const pts = every.points();
    grid.innerHTML = pts.length ? pts.map(p => tileHtml(every, p, now)).join('')
      : '<div class="ev-empty">Nothing has come in from this unit since the panel opened — every answer it gives will appear here.</div>';
    laid = order();
    count.textContent = `${pts.length} data point${pts.length === 1 ? '' : 's'}`;
  };
  all();
  /* Arrival: only the touched tiles are redrawn, and they tick once. */
  const update = (touched) => {
    if (order() !== laid) { all(); }
    const now = Date.now();
    for (const p of touched || []) {
      const old = grid.querySelector(`[data-id="${CSS.escape(p.id)}"]`);
      if (!old) continue;
      const box = document.createElement('div');
      box.innerHTML = tileHtml(every, p, now);
      const el = box.firstElementChild;
      el.classList.add('is-tick');
      old.replaceWith(el);
    }
  };
  /* Staleness is time passing, not data: a class flip every 5 s, nothing redrawn. */
  const timer = setInterval(() => {
    const now = Date.now();
    for (const p of every.points()) {
      const el = grid.querySelector(`[data-id="${CSS.escape(p.id)}"]`);
      if (el) el.classList.toggle('is-haze', !every.fresh(p, now));
    }
  }, 5000);
  return { update, all, stop: () => { clearInterval(timer); if (table && table.unregister) table.unregister(); } };
}

/* ------------------------------------------------------ EVERYTHING OVER TIME */

/** min/max per pixel column of one run, inside [from, to]: what a line of that width can show. */
export function decimate(run, from, to, width, log) {
  const cols = new Map();
  for (const h of run) {
    if (h.t < from || h.t > to) continue;
    const x = Math.round(timeToFrac(h.t, from, to, log) * (width - 1));
    const c = cols.get(x);
    if (!c) cols.set(x, { x, lo: h.v, hi: h.v, first: h.v, last: h.v });
    else { c.lo = Math.min(c.lo, h.v); c.hi = Math.max(c.hi, h.v); c.last = h.v; }
  }
  return [...cols.values()].sort((a, b) => a.x - b.x);
}

export function mountEverythingOverTime(host, every, who, opts = {}) {
  let log = true;
  try { log = localStorage.getItem('apk.everything.logTime') !== '0'; } catch (_) { /* default: log */ }
  const view = { span: 10 * 60 * 1000, to: Date.now(), follow: true };
  host.innerHTML = `<div class="ev-page">
      <div class="ev-head"><b>EVERYTHING OVER TIME</b><span class="ev-count"></span>
        <span class="ev-seg"><button type="button" class="ev-btn" data-log="1">Log</button><button type="button" class="ev-btn" data-log="0">Linear</button></span>
        <button type="button" class="ev-btn" data-live>● Live</button>
        <span class="ev-why">drag to pan · wheel to zoom · the puck too · a gap is the unit offline</span>
        <button type="button" class="ev-btn" data-export>⤓ CSV</button></div>
      <div class="et-wrap"><canvas class="et-canvas"></canvas><div class="et-cursor" hidden></div><div class="et-read" hidden></div></div></div>`;
  const wrap = host.querySelector('.et-wrap');
  const canvas = host.querySelector('.et-canvas');
  const cursor = host.querySelector('.et-cursor');
  const read = host.querySelector('.et-read');
  const count = host.querySelector('.ev-count');
  const LEFT = 150; const RIGHT = 70; const ROW = 64; const GAP = 6;
  const table = register(`everything-over-time-${who.key || 'unit'}`, [
    { key: 'time', label: 'time' }, { key: 'point', label: 'data point' }, { key: 'scpi', label: 'scpi' },
    { key: 'value', label: 'value' }, { key: 'unit', label: 'unit' }], () => every.seriesRows());
  host.querySelector('[data-export]').addEventListener('click', () => table && table.exportCsv(`${fileStem(who, 'everything_over_time')}.csv`));
  const segs = host.querySelectorAll('[data-log]');
  const live = host.querySelector('[data-live]');
  const paintButtons = () => {
    segs.forEach(b => b.classList.toggle('on', (b.dataset.log === '1') === log));
    live.classList.toggle('on', view.follow);
  };
  segs.forEach(b => b.addEventListener('click', () => {
    log = b.dataset.log === '1';
    try { localStorage.setItem('apk.everything.logTime', log ? '1' : '0'); } catch (_) { /* this view only */ }
    paintButtons(); schedule();
  }));
  live.addEventListener('click', () => { view.follow = true; view.to = Date.now(); paintButtons(); schedule(); });

  const range = () => ({ from: view.to - view.span, to: view.to });
  const plotW = () => Math.max(50, canvas.clientWidth - LEFT - RIGHT);
  let pts = [];
  let raf = 0;
  const visible = () => host.isConnected && !document.hidden && host.offsetParent !== null;
  function schedule() {
    if (raf || !visible()) return;
    raf = requestAnimationFrame(() => { raf = 0; draw(); });
  }
  function draw() {
    pts = every.points().filter(p => p.history.length);
    count.textContent = `${pts.length} trend${pts.length === 1 ? '' : 's'}`;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth;
    const h = Math.max(ROW, pts.length * (ROW + GAP) + 18);
    canvas.style.height = `${h}px`;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const { from, to } = range();
    const pw = plotW();
    g.font = '11px system-ui, sans-serif';
    pts.forEach((p, i) => {
      const y0 = i * (ROW + GAP);
      g.fillStyle = 'rgba(255,255,255,0.03)';
      g.fillRect(LEFT, y0, pw, ROW);
      g.fillStyle = p.colour;
      g.fillText(p.label.length > 24 ? `${p.label.slice(0, 23)}…` : p.label, 6, y0 + 14);
      g.fillStyle = '#64748b';
      g.fillText(p.scpi.length > 26 ? `${p.scpi.slice(0, 25)}…` : p.scpi, 6, y0 + 28);
      const runs = Everything.runs(p.history).map(r => decimate(r, from, to, pw, log)).filter(r => r.length);
      if (!runs.length) return;
      let lo = Infinity; let hi = -Infinity;
      for (const r of runs) for (const c of r) { lo = Math.min(lo, c.lo); hi = Math.max(hi, c.hi); }
      if (lo === hi) { const d = Math.abs(lo) * 0.05 || 1; lo -= d; hi += d; }
      const Y = (v) => y0 + ROW - 4 - ((v - lo) / (hi - lo)) * (ROW - 8);
      const unit = every.unitOf(p);
      g.fillStyle = '#94a3b8';
      g.fillText(engineering(hi, unit), LEFT + pw + 4, y0 + 11);
      g.fillText(engineering(lo, unit), LEFT + pw + 4, y0 + ROW - 3);
      g.strokeStyle = p.colour; g.lineWidth = 1.5;
      for (const r of runs) {
        g.beginPath();
        r.forEach((c, k) => {
          const x = LEFT + c.x;
          if (k === 0) g.moveTo(x, Y(c.first)); else g.lineTo(x, Y(c.first));
          if (c.hi !== c.lo) { g.lineTo(x, Y(c.hi)); g.lineTo(x, Y(c.lo)); }
          g.lineTo(x, Y(c.last));
        });
        g.stroke();
        if (r.length === 1) { g.fillStyle = p.colour; g.fillRect(LEFT + r[0].x - 1.5, Y(r[0].last) - 1.5, 3, 3); }
      }
    });
    // The time axis, once, under all of them.
    g.fillStyle = '#64748b';
    const yA = h - 4;
    for (let k = 0; k <= 4; k++) {
      const f = k / 4;
      const t = fracToTime(f, from, to, log);
      const ago = Math.round((to - t) / 1000);
      g.fillText(ago <= 0 ? 'now' : ago < 120 ? `-${ago}s` : `-${Math.round(ago / 60)}m`, LEFT + f * pw - (k === 4 ? 18 : 0), yA);
    }
    paintButtons();
  }

  /* The cursor: a line and a readout of every value at that time — no redraw. */
  const valueAt = (p, t) => {
    let at = null;
    for (const h of p.history) { if (h.t > t) break; at = h; }
    return at;
  };
  wrap.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left - LEFT;
    if (x < 0 || x > plotW()) { cursor.hidden = true; read.hidden = true; return; }
    const { from, to } = range();
    const t = fracToTime(x / plotW(), from, to, log);
    cursor.hidden = false; read.hidden = false;
    cursor.style.left = `${LEFT + x}px`;
    read.style.left = `${Math.min(LEFT + x + 8, r.width - 240)}px`;
    read.innerHTML = `<b>${clock(t)}</b>` + pts.map(p => {
      const h = valueAt(p, t);
      const v = !h ? '—' : h.v === null ? 'offline' : engineering(h.v, every.unitOf(p));
      return `<div><i style="background:${p.colour}"></i>${esc(p.label)} <span>${esc(v)}</span></div>`;
    }).join('');
  });
  wrap.addEventListener('pointerleave', () => { cursor.hidden = true; read.hidden = true; });

  /* Pan (drag) and zoom (wheel, about the pointer), in the axis's own frac space. */
  let drag = null;
  wrap.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, to: view.to }; wrap.setPointerCapture(e.pointerId); });
  wrap.addEventListener('pointerup', () => { drag = null; });
  wrap.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dt = ((e.clientX - drag.x) / plotW()) * view.span;
    view.to = Math.min(Date.now(), drag.to - dt);
    view.follow = view.to >= Date.now() - 1000;
    schedule();
  });
  wrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (e.clientX - r.left - LEFT) / plotW()));
    const { from, to } = range();
    const at = fracToTime(f, from, to, log);
    const k = e.deltaY > 0 ? 1.25 : 0.8;
    view.span = Math.min(30 * 86400e3, Math.max(5000, view.span * k));
    if (!view.follow) view.to = Math.min(Date.now(), at + (view.to - at) * k);
    schedule();
    if (opts.onWindow) opts.onWindow(range());
  }, { passive: false });

  const puck = window.APKGraphPuck && window.APKGraphPuck.attach ? window.APKGraphPuck.attach({
    el: wrap, name: 'everything-over-time',
    getView: () => { const { from, to } = range(); return { x: [from, to], y: null }; },
    setView: ({ x }) => {
      if (!x) return;
      view.span = Math.max(5000, x[1] - x[0]);
      view.to = Math.min(Date.now(), x[1]);
      view.follow = view.to >= Date.now() - 1000;
      schedule();
      if (opts.onWindow) opts.onWindow(range());
    },
    reset: () => { view.span = 10 * 60 * 1000; view.follow = true; view.to = Date.now(); schedule(); },
    anchorX: () => (view.follow ? 1 : null),
  }) : null;

  /* LIVE: the right edge is now. It moves with a new proven value; between values the
     axis is only re-cut once a second, and not at all while hidden. */
  const tick = setInterval(() => { if (view.follow) { view.to = Date.now(); schedule(); } }, 1000);
  const onVis = () => schedule();
  document.addEventListener('visibilitychange', onVis);
  const onResize = () => schedule();
  window.addEventListener('resize', onResize);
  schedule();
  return {
    update: () => { if (view.follow) view.to = Date.now(); schedule(); },
    all: schedule,
    stop: () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', onResize);
      if (puck) puck();
      if (table && table.unregister) table.unregister();
    },
  };
}
