// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* runner.js — the touch panel, RUNNING (run.html).

   Opened from the Discovery Engine (Discovered VISA → the Online badge) with the
   box's own link: ?model=&family=&resource=&serial=. It builds the same panel the
   builder starts from (devicePanel.js: the device's presented Instruments-tab
   panel, else its api.json) and then RUNS it: a touch fires the control's
   command through KOMAND (runPanel.js says exactly what goes on the wire), and
   each readout shows the instrument's readback as it arrives.

   The bus: inside the OS shell the shell's own broker; a page on the portal has
   the broker comes from config/discovered.json
   `broker_urls` — a tunable, never a port written here. No bus: the panel is
   drawn, every control says it cannot send, and nothing is pretended. */

import { CONTROL_DEFINITIONS, widgetStyleVars } from './controls.js';
import { linkQuery, linkSearch, isPanelFor, panelFromPresented, panelFromVariables, presentedFromPart, partUrl, deckOrder } from './devicePanel.js';
import { ControlLibrary, modelKey } from './library.js';
// The app's discovery tunables, through the shared client (ROAD-3502).
const loadDiscoveredConfig = () => (window.APKSoftapp?.discoveredConfig
  ? window.APKSoftapp.discoveredConfig(new URL('../config/discovered.json', import.meta.url).href) : Promise.resolve({}));
import {
  controlTopic, handlerFor, fireMessages, directMessages, touchKind, clampValue, readingText, readbackTopics, readbackOf, brokerFor,
  idnBound,
} from './runPanel.js';
import { savedIdentity, savedTopic, readSaved } from './savedPanel.js';
import { Everything, sdkIndex } from './everything.js';
import { mountEverythingIn, mountEverythingOverTime } from './everythingView.js';
import { rolesFor, isMonitoring, deviceKeyOf, seriesOf, toBytes, tracesFromRig, withTracePage } from './tracePanel.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const W = 1280;
const H = 800;

const state = { panel: null, page: '', link: null, write: '', key: '', bus: null, on: new Set(), els: new Map(), template: false };

function say(text, ms = 3500) {
  const el = $('say');
  el.textContent = text;
  clearTimeout(say.t);
  if (ms) say.t = setTimeout(() => { el.textContent = ''; }, ms);
}

function pill(id, text, s) {
  const el = $(id);
  el.hidden = false;
  el.textContent = text;
  el.dataset.state = s;
}

/* ---------------------------------------------------------------- the panel */

async function presented(want) {
  const q = `model=${encodeURIComponent(want.model)}`;
  for (const url of [`/api/instrument/panel?${q}`, `/api/os/instrument/panel?${q}`]) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) continue;
      return ((await r.json()).panels || []).find(d => isPanelFor(d, want)) || null;
    } catch (_) { /* not served under this spelling */ }
  }
  return null;
}

/** The box itself, as the OS API finds it by protocol + resource: its Write topic. */
async function findBox(want) {
  if (!want.resource && !want.serial) return null;
  const q = new URLSearchParams({ protocol: want.protocol || 'visa', resource: want.resource, model: want.model || '', serial: want.serial || '' });
  try {
    const r = await fetch(`/api/instrument/status?${q}`, { cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch (_) { return null; }
}

/** Every family's thing.json roles (WEB.OsApi /api/instrument/families), or {}. */
async function familyRoles() {
  for (const url of ['/api/instrument/families', '/api/os/instrument/families']) {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (r.ok) return await r.json();
    } catch (_) { /* not served under this spelling */ }
  }
  return {};
}

/** The retained rig a box's traces arrive on (Captures/Rig/<device>), or ''. */
function rigTopicOf(writeTopic) {
  const C = window.APKContracts;
  const key = deviceKeyOf(writeTopic);
  return key && C && C.Topics.captures ? C.Topics.captures.topic({ kind: 'Rig', capture: C.captureSegment(key) }) : '';
}

/* A BIM PART'S OWN PANEL, NO UNIT (?bim=<part>, ROAD-3687): the library's OPEN TOUCH
   PANEL on a part. The template is drawn as the node would stamp it; nothing is bound
   to a box, so nothing is sent (fire() refuses) and nothing read is shown. */
async function partPanel(id) {
  try {
    const r = await fetch(partUrl(id), { cache: 'no-store' });
    if (!r.ok) return null;
    const part = await r.json();
    const doc = presentedFromPart(part);
    const p = doc ? panelFromPresented(doc, { width: W, height: H }) : null;
    if (p) p.name = `${part.name || part.model || id} TOUCH PANEL`.toUpperCase();
    return p;
  } catch (_) { return null; }
}

async function loadPanel(want) {
  if (want.bim) return partPanel(want.bim);
  const doc = await presented(want);
  if (doc) return panelFromPresented(doc, { placement: want.placement, width: W, height: H });
  try {
    const vars = await new ControlLibrary().variables(modelKey(want.family, want.model));
    return panelFromVariables(vars, { model: want.model, family: want.family, width: W, height: H });
  } catch (_) { return null; }
}

/* ---------------------------------------------------------------- the bus */

async function connectBus() {
  const S = window.APKSoftapp;
  if (!S || !window.APKContracts) return null;
  // Inside the OS shell its broker is the one (apk-bus asks the shell); only a
  // page on its own is handed the configured one.
  let shell = false;
  try { shell = window.parent !== window && !!(window.parent.OS && window.parent.OS.brokerUrl); } catch (_) { /* other origin */ }
  if (shell) return S.bus();
  const cfg = await loadDiscoveredConfig();
  const urls = brokerFor(cfg, location);
  return S.bus(urls.length ? { brokerUrl: urls[0] } : undefined);
}

function publish(msgs) {
  const link = state.bus;
  if (!link || !link.connected) return false;
  // Not retained, in order: config first, then any arguments, then the value.
  for (const m of msgs) link.publish(m.topic, m.payload, { qos: 0, retain: false });
  return true;
}

function fire(w, value, args = null) {
  if (state.template) { say('A part\'s panel template: no unit is bound, so nothing is sent.'); return false; }
  if (!handlerFor(w) && w.direct) {
    // A network device's own control topic: no KOMAND between (ROAD-3523).
    if (!publish(directMessages(w, value))) { say('No broker: nothing was sent.'); return false; }
    const el = state.els.get(w.id);
    if (el) { el.classList.remove('sent'); void el.offsetWidth; el.classList.add('sent'); }
    say(`${w.direct.verb} ← ${value}`, 2000);
    return true;
  }
  const h = handlerFor(w, state.write);
  if (!h) { say(`${w.label}: not wired to a command`); return false; }
  if (!h.target) { say(`${w.label}: the box was not found on the bus, so there is nowhere to send ${h.command}`); return false; }
  const topic = controlTopic(window.APKContracts.Topics.gui.topic, state.key, w.id);
  if (!publish(fireMessages(topic, h, value, args))) { say('No broker: nothing was sent.'); return false; }
  const el = state.els.get(w.id);
  if (el) { el.classList.remove('sent'); void el.offsetWidth; el.classList.add('sent'); }
  say(`${h.command} ← ${typeof value === 'object' ? JSON.stringify(value) : value}`, 2000);
  return true;
}

function applyDomainFrom(w, val) {
  const df = w.behavior?.domainFrom;
  if (!df || !df.cases) return;
  const key = String(val ?? df.default ?? '').toUpperCase().trim();
  const hit = df.cases[key] || Object.entries(df.cases).find(([k]) => k.toUpperCase() === key)?.[1];
  if (hit) {
    if (hit.min !== undefined) w.behavior.min = Number(hit.min);
    if (hit.max !== undefined) w.behavior.max = Number(hit.max);
    if (hit.units !== undefined) w.behavior.unit = String(hit.units);
    draw(w);
  }
}

function listen() {
  const link = state.bus;
  if (!link) return;
  for (const [topic, widgets] of readbackTopics(state.panel.widgets, state.write)) {
    link.subscribe(topic, (_t, text) => {
      // A waveform or spectrum answer is a series: drawn as a trace, not as text (tracePanel.js).
      const series = seriesOf(text);
      for (const w of widgets) {
        if (series) {
          w.type = 'trace';
          w.trace = [{ source: w.label, points: toBytes(series) }];
        } else {
          if (w.behavior?.domainFrom?.komand_listen_topic === _t) {
            applyDomainFrom(w, readingText(text));
          }
          const rb = readbackOf(w, state.write);
          if (rb === _t || (!rb && w.address === _t)) {
            w.value = readingText(text, w.behavior && w.behavior.unit);
          }
        }
        draw(w);
      }
    });
  }
  // A monitoring box's TRACE page: every Trace/<source> of its retained rig.
  for (const w of state.panel.widgets.filter(x => x.type === 'trace' && x.rig)) {
    link.subscribe(w.rig, (_t, text) => {
      const traces = tracesFromRig(text);
      if (traces.length) { w.trace = traces; draw(w); }
    });
  }
  // Instrument IDN readback from KOMAND Nab/Get
  if (state.write) {
    const idnTopic = `${state.write.slice(0, -'/Write'.length)}/Reading/Read_IDN`;
    link.subscribe(idnTopic, (_t, text) => {
      const idn = readingText(text);
      if (idn) {
        const idnEl = $('run-idn');
        if (idnEl) {
          idnEl.hidden = false;
          idnEl.textContent = idn;
          idnEl.title = `Device IDN: ${idn}`;
        }
        for (const w of state.panel.widgets) {
          if (idnBound(w, state.write)) {
            w.value = idn;
            draw(w);
          }
        }
      }
    });
  }
}

/* ---------------------------------------------------------------- touching */

function closePop() { document.querySelector('.pop')?.remove(); }

function popAt(el, html) {
  closePop();
  const pop = document.createElement('div');
  pop.className = 'pop';
  pop.innerHTML = html;
  document.body.append(pop);
  const r = el.getBoundingClientRect();
  const x = Math.min(window.innerWidth - pop.offsetWidth - 10, Math.max(10, r.left));
  const y = r.bottom + pop.offsetHeight + 10 < window.innerHeight ? r.bottom + 6 : Math.max(10, r.top - pop.offsetHeight - 6);
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;
  pop.querySelector('[data-close]')?.addEventListener('click', closePop);
  return pop;
}

function numberPop(el, w) {
  const b = w.behavior || {};
  const h = handlerFor(w, state.write);
  const ranged = Number.isFinite(b.min) && Number.isFinite(b.max) && b.max > b.min;
  const now = String(w.value ?? b.default ?? '').replace(/[^\d.eE+-].*$/, '');
  const pop = popAt(el, `
    <h4>${esc(w.label)}</h4>
    <label>Value${b.unit ? ` (${esc(b.unit)})` : ''}${ranged ? ` · ${b.min} … ${b.max}` : ''}</label>
    <input type="number" id="pv" value="${esc(now)}" ${Number.isFinite(b.step) ? `step="${b.step}"` : 'step="any"'}
      ${Number.isFinite(b.min) ? `min="${b.min}"` : ''} ${Number.isFinite(b.max) ? `max="${b.max}"` : ''}>
    ${ranged ? `<input type="range" id="pr" min="${b.min}" max="${b.max}" step="any" value="${esc(now || b.min)}">` : ''}
    <div class="row"><button data-close>Cancel</button><button class="go" id="pgo">SEND</button></div>
    <div class="hint">${esc(h ? h.command : '')}</div>`);
  const v = pop.querySelector('#pv');
  const r = pop.querySelector('#pr');
  if (r) r.addEventListener('input', () => { v.value = r.value; });
  v.focus(); v.select();
  const go = () => {
    const n = clampValue(v.value, b);
    if (n === null) { say('Not a number.'); return; }
    if (fire(w, n)) { w.value = `${n}${b.unit ? ` ${b.unit}` : ''}`; draw(w); closePop(); }
  };
  pop.querySelector('#pgo').addEventListener('click', go);
  v.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); if (e.key === 'Escape') closePop(); });
}

function choosePop(el, w) {
  const b = w.behavior || {};
  const labels = b.labels || b.values;
  const cur = String(w.value !== '—' && w.value != null ? w.value : b.default ?? '').trim().toUpperCase();
  const pop = popAt(el, `<h4>${esc(w.label)}</h4><div class="row">${b.values.map((v, i) => {
    const isSelected = String(v).toUpperCase() === cur || String(labels[i] || '').toUpperCase() === cur;
    return `<button data-v="${esc(v)}" class="${isSelected ? 'go' : ''}">${esc(labels[i] || v)}</button>`;
  }).join('')}</div>
    <div class="row"><button data-close>Cancel</button></div>`);
  pop.querySelectorAll('[data-v]').forEach(btn => btn.addEventListener('click', () => {
    const val = btn.dataset.v;
    if (fire(w, val)) {
      w.value = val;
      draw(w);
      const myTopic = readbackOf(w, state.write) || w.address;
      for (const dep of state.panel.widgets) {
        if (dep.behavior?.domainFrom?.komand_listen_topic === myTopic) {
          applyDomainFrom(dep, val);
        }
      }
      closePop();
    }
  }));
}

function argsPop(el, w) {
  const b = w.behavior || {};
  const pop = popAt(el, `<h4>${esc(w.label)}</h4>${b.args.map(a => {
    const name = typeof a === 'string' ? a : (a.name || a.key || '');
    return `<label>${esc(name)}</label><input type="text" data-arg="${esc(name)}">`;
  }).join('')}<div class="row"><button data-close>Cancel</button><button class="go" id="pgo">SEND</button></div>`);
  pop.querySelector('#pgo').addEventListener('click', () => {
    const args = {};
    pop.querySelectorAll('[data-arg]').forEach(i => { args[i.dataset.arg] = i.value.trim(); });
    if (fire(w, true, args)) closePop();
  });
}

function textPop(el, w) {
  const pop = popAt(el, `
    <h4>${esc(w.label)}</h4>
    <input type="text" id="pt" value="">
    <div class="row"><button data-close>Cancel</button><button class="go" id="pgo">SEND</button></div>
    <div class="hint">${esc(w.direct ? w.direct.verb : '')}</div>`);
  const t = pop.querySelector('#pt');
  t.focus();
  const go = () => {
    const text = t.value.trim();
    if (!text) { say('Nothing typed.'); return; }
    if (fire(w, text)) closePop();
  };
  pop.querySelector('#pgo').addEventListener('click', go);
  t.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); if (e.key === 'Escape') closePop(); });
}

function attach(el, w) {
  const kind = touchKind(w);
  el.dataset.touch = kind;
  if (kind === 'none') { el.title = 'Shows a reading; not wired to a command'; return; }
  if (kind === 'press') {
    // A momentary press: true down, false up — the truthy edge fires a DO/NAB/GET.
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); fire(w, true); el.classList.add('on'); });
    const up = () => { if (el.classList.contains('on')) { el.classList.remove('on'); publishRelease(w); } };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return;
  }
  if (kind === 'toggle') {
    el.addEventListener('click', () => {
      const on = !state.on.has(w.id);
      if (fire(w, on)) { if (on) state.on.add(w.id); else state.on.delete(w.id); el.classList.toggle('on', on); }
    });
    return;
  }
  if (w.type === 'selector') {
    const b = w.behavior || {};
    const values = b.values && b.values.length ? b.values : (Array.isArray(b.positions) ? b.positions : []);
    const n = Math.max(2, Math.min(12, values.length || parseInt(b.positions, 10) || 6));
    const effectiveValues = values.length ? values : Array.from({ length: n }, (_, i) => String(i + 1));
    const totalPos = effectiveValues.length;

    const selectIndex = (idx) => {
      const val = effectiveValues[idx] !== undefined ? effectiveValues[idx] : idx;
      if (fire(w, val)) {
        w.value = val;
        draw(w);
        const myTopic = readbackOf(w, state.write) || w.address;
        for (const dep of state.panel.widgets) {
          if (dep.behavior?.domainFrom?.komand_listen_topic === myTopic) {
            applyDomainFrom(dep, val);
          }
        }
      }
    };

    el.addEventListener('click', (e) => {
      const posEl = e.target.closest('.sel-pos');
      if (posEl && posEl.dataset.v !== undefined) {
        const val = posEl.dataset.v;
        const idx = effectiveValues.findIndex(v => String(v) === String(val));
        selectIndex(idx !== -1 ? idx : parseInt(posEl.dataset.pos, 10) || 0);
        return;
      }

      // If clicked on knob body / dial background, find closest radial angle
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + (rect.height * 105 / 220);
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      if (Math.hypot(dx, dy) > 15) {
        let angle = Math.atan2(-dy, dx) * (180 / Math.PI);
        if (angle < 0) angle += 360;
        const sweepAngle = 270;
        const angleStep = n > 1 ? sweepAngle / (n - 1) : 0;
        let closestIdx = 0;
        let minDiff = Infinity;
        for (let i = 0; i < n; i++) {
          let targetAng = 225 - i * angleStep;
          while (targetAng < 0) targetAng += 360;
          while (targetAng >= 360) targetAng -= 360;
          let diff = Math.abs(angle - targetAng);
          if (diff > 180) diff = 360 - diff;
          if (diff < minDiff) { minDiff = diff; closestIdx = i; }
        }
        selectIndex(closestIdx);
      }
    });

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const cur = String(w.value !== '—' && w.value != null ? w.value : b.default ?? '').trim().toUpperCase();
      let curIdx = effectiveValues.findIndex(v => String(v).toUpperCase() === cur);
      if (curIdx === -1) curIdx = 0;
      const dir = e.deltaY < 0 ? 1 : -1;
      const nextIdx = Math.max(0, Math.min(totalPos - 1, curIdx + dir));
      if (nextIdx !== curIdx) selectIndex(nextIdx);
    }, { passive: false });
    return;
  }
  el.addEventListener('click', () => (kind === 'text' ? textPop : kind === 'choose' ? choosePop : kind === 'args' ? argsPop : numberPop)(el, w));
}

/* The release edge, without the config again: KOMAND drops a falsy DO/NAB. */
function publishRelease(w) {
  if (state.template) return;
  if (w.direct && !handlerFor(w)) return;   // the plugin acts on the press; a release is nothing to it
  const h = handlerFor(w, state.write);
  if (!h || !h.target || !state.bus) return;
  const topic = controlTopic(window.APKContracts.Topics.gui.topic, state.key, w.id);
  publish([{ topic, payload: JSON.stringify({ value: false }) }]);
}

/* ---------------------------------------------------------------- drawing */

function draw(w) {
  const el = state.els.get(w.id);
  const def = CONTROL_DEFINITIONS[w.type] || CONTROL_DEFINITIONS.readout;
  if (!el || !def) return;
  // A live panel never shows the builder's placeholder value: nothing read yet is "—".
  // The panel's OWN words (Device, Make · Model, Address: bound to nothing, no
  // command, its value_default) are not a reading and are shown as written.
  const ownWords = !w.address && !w.direct && !handlerFor(w) && w.behavior && w.behavior.default;
  const shown = w.value !== undefined && w.value !== null && w.value !== '' ? w.value : ownWords ? w.behavior.default : '—';
  const behavior = { ...(w.behavior || {}), default: '' };
  el.innerHTML = def.render({ ...w, behavior, label: esc(w.label), subtitle: esc(w.subtitle), value: esc(shown), style: w.style || {} });
}

function render() {
  const p = state.panel;
  for (const w of p.widgets) {
    if (w.behavior?.domainFrom?.default) {
      applyDomainFrom(w, w.behavior.domainFrom.default);
    }
  }
  const tabs = $('run-tabs');
  tabs.innerHTML = '';
  // Inside an OS window whose own strip already holds the GUI file's pages
  // (?tabs=0, the frame found), this strip carries only what that strip cannot
  // reach: the open frame's continuation pages (SYSTEM ADMIN 2, 3 — one frame
  // too tall for one glass) and the pages added after the GUI file's (RIG, NAB,
  // TRACE), so nothing in the deck is out of reach.
  const src = (pg) => (pg && pg.source && String(pg.source.path || '')) || '';
  const here = src(p.pages.find(pg => pg.id === state.page));
  const run = here ? p.pages.filter(pg => src(pg) === here) : [];
  const listed = state.hostFramed
    ? p.pages.filter(pg => !pg.source || (run.length > 1 && src(pg) === here)) : p.pages;
  tabs.hidden = !listed.length;
  for (const pg of listed) {
    const b = document.createElement('button');
    b.role = 'tab';
    b.textContent = pg.name;
    b.setAttribute('aria-selected', String(pg.id === state.page));
    b.addEventListener('click', () => { state.page = pg.id; closePop(); render(); tellHost(); });
    tabs.append(b);
  }
  const glass = $('run-glass');
  glass.style.width = `${W}px`;
  glass.style.height = `${H}px`;
  if (state.view) { state.view.stop(); state.view = null; }
  glass.innerHTML = '';
  state.els.clear();
  if (state.every && (state.page === EVERY_IN || state.page === EVERY_TIME)) {
    const who = { ...state.who, key: state.key };
    state.view = state.page === EVERY_IN ? mountEverythingIn(glass, state.every, who)
      : mountEverythingOverTime(glass, state.every, who, { onWindow: (w) => seedBack(w.from) });
    fit();
    return;
  }
  const first = p.pages[0] && p.pages[0].id;
  for (const w of p.widgets.filter(x => (x.page || first) === state.page)) {
    const el = document.createElement('div');
    el.className = `tw${(handlerFor(w) || w.direct) && !state.template ? '' : ' unbound'}${state.on.has(w.id) ? ' on' : ''}`;
    Object.assign(el.style, { left: `${w.x}px`, top: `${w.y}px`, width: `${w.w}px`, height: `${w.h}px` });
    Object.entries(widgetStyleVars({ style: w.style || {} })).forEach(([k, v]) => el.style.setProperty(k, v));
    state.els.set(w.id, el);
    glass.append(el);
    draw(w);
    attach(el, w);
  }
  fit();
}

/* ---------------------------------------------------------------- everything in

   EVERYTHING IN / EVERYTHING OVER TIME (owner 2026-11-12, js/everything.js): two
   pages after the GUI file's, on every device that has a box to answer. They hear
   the unit's own /Reply (the proof), its status record (not connected = offline:
   a gap), and are seeded from the capture recorder for the window on screen. */
const EVERY_IN = 'everything-in';
const EVERY_TIME = 'everything-over-time';

async function sdkOf(want) {
  for (const base of ['/api/instrument/api', '/api/os/instrument/api']) {
    try {
      const r = await fetch(`${base}?model=${encodeURIComponent(want.model)}&family=${encodeURIComponent(want.family || '')}`, { cache: 'no-store' });
      if (r.ok) return await r.json();
    } catch (_) { /* not served under this spelling */ }
  }
  return null;
}

/* The recorder's name for the box: <proto>/<family>/<model>/<dev>, from its Write topic. */
function recorderDevice(write) {
  const m = /\/Protocols\/([^/]+)\/Device\/([^/]+)\/([^/]+)\/([^/]+)\/Write$/.exec(String(write || ''));
  return m ? `${m[1]}/${m[2]}/${m[3]}/${m[4]}` : '';
}

/* History only for the window asked, and only what is not already held. */
async function seedBack(fromMs) {
  const e = state.every;
  if (!e || !state.recorderDevice || !(fromMs < state.seededFrom)) return;
  const until = state.seededFrom;
  state.seededFrom = fromMs;
  try {
    const r = await fetch(`/api/os/captures/reads?device=${encodeURIComponent(state.recorderDevice)}&since=${(fromMs / 1000).toFixed(3)}&limit=8000`, { cache: 'no-store' });
    if (!r.ok) return;
    const reads = ((await r.json()).reads || []).filter(x => x.ts * 1000 < until);
    e.seed(reads);
    if (state.view) state.view.all();
  } catch (_) { /* no recorder here: history starts when the panel opened */ }
}

async function startEverything(want) {
  if (!state.write) return;
  const api = await sdkOf(want);
  state.every = new Everything({ model: want.model, sdk: sdkIndex(api || {}) });
  state.who = { model: want.model, serial: want.serial, resource: want.resource };
  state.recorderDevice = recorderDevice(state.write);
  state.seededFrom = Date.now();
  state.panel.pages.push({ id: EVERY_IN, name: 'EVERYTHING IN' }, { id: EVERY_TIME, name: 'EVERYTHING OVER TIME' });
  // ?page=EVERYTHING IN links straight to it.
  const asked = want.page && state.panel.pages.find(pg => pg.name.toUpperCase() === want.page.toUpperCase());
  if (asked) state.page = asked.id;
  render();
  const base = state.write.slice(0, -'/Write'.length);
  const link = state.bus;
  if (link) {
    link.subscribe(`${base}/Reply`, (_t, text) => {
      let env = null;
      try { env = JSON.parse(text); } catch (_) { return; }
      const touched = state.every.hear(env, Date.now());
      if (touched.length && state.view) state.view.update(touched);
    });
    // KOMAND's named readings: each says which question it answers (retained:
    // the last of each arrives at once, with its own time).
    link.subscribe(`${base}/Reading/#`, (t, text) => {
      const touched = state.every.takeReading(t.slice(base.length + 1), text, Date.now());
      if (touched.length && state.view) state.view.update(touched);
    });
    // The box's status record: not connected is offline, a gap in every line.
    link.subscribe(base, (_t, text) => {
      let rec = null;
      try { rec = JSON.parse(text); } catch (_) { return; }
      if (rec && String(rec.connected) === '0') { state.every.gap(Date.now()); if (state.view) state.view.all(); }
    });
  }
  seedBack(Date.now() - 10 * 60 * 1000);
}

/* ---------------------------------------------------------------- inside a host

   THE ONE RENDERER OF A DEVICE PANEL (owner 2026-11-12, "homogenize this"):
   the OS draws a box's touch panel with THIS page in its frames panes and its
   device windows (OS Apps/Frames split-panes, device-window). There it is
   ?embed=1 (the host window has the name, the bus and the ✏️ Edit), and the
   host's own tab strip picks the page: ?frame=<the frame's path in its
   placement> opens the page drawn from that frame, ?tabs=0 hides this page's
   tabs when that frame was found, and {type:'apk:run-frame', frame} from the
   host turns the page without a reload. Each page turn is told back as
   {type:'apk:run-page', frame} so the host's open-panel asks follow it. */
const host = new URLSearchParams(location.search);
const EMBED = host.get('embed') === '1';
const HOST_TABS = host.get('tabs') === '0';

function pageForFrame(framePath) {
  const p = state.panel;
  if (!p || !framePath) return null;
  const want = String(framePath).replace(/^\/+/, '');
  return p.pages.find(pg => pg.source && String(pg.source.path || '').replace(/^\/+/, '') === want) || null;
}

function tellHost(kind = 'apk:run-page') {
  if (window.parent === window) return;
  const pg = state.panel && state.panel.pages.find(x => x.id === state.page);
  try { window.parent.postMessage({ type: kind, frame: (pg && pg.source && pg.source.path) || '', page: pg ? pg.name : '' }, '*'); }
  catch (_) { /* host gone */ }
}

function showFrame(framePath) {
  const pg = pageForFrame(framePath);
  state.hostFramed = HOST_TABS && !!pg;
  if (pg) state.page = pg.id;
  closePop();
  render();
  tellHost();
}

window.addEventListener('message', (e) => {
  if (e.source !== window.parent || !e.data || e.data.type !== 'apk:run-frame' || !state.panel) return;
  showFrame(e.data.frame);
});

function fit() {
  const stage = $('run-stage');
  stage.style.top = `${$('run-tabs').getBoundingClientRect().bottom}px`;
  const k = Math.min((stage.clientWidth - 20) / (W + 24), (stage.clientHeight - 20) / (H + 24), 1.5);
  const bezel = $('run-bezel');
  bezel.style.transform = `scale(${Math.max(0.2, k)})`;
}

/* ---------------------------------------------------------------- start */

async function start() {
  if (EMBED) document.querySelector('.run-head').hidden = true;
  const want = linkQuery(location.search);
  if (!want.model && !want.bim) { $('run-name').textContent = 'NO DEVICE NAMED (?model=…)'; return; }
  $('run-name').textContent = `${want.model || want.bim} — LOADING…`;
  $('run-edit').href = `./index.html${linkSearch(want, '')}`;
  if (want.bim) { startTemplate(want); return; }
  const [generated, box, bus, families] = await Promise.all([loadPanel(want), findBox(want), connectBus(), familyRoles()]);
  // The panel saved for this box runs first (ROAD-3503), unless a placement was asked for.
  const topic = bus && !want.placement
    ? savedTopic(window.APKContracts.Topics.gui.topic, savedIdentity(generated, want)) : '';
  const saved = topic ? await readSaved(bus, topic, 1500) : null;
  const panel = saved
    ? { ...saved, device: (generated && generated.device) || { model: want.model, type: want.family },
        deviceId: saved.deviceId || (generated && generated.deviceId) || '', placement: 'saved panel' }
    : generated;
  if (!panel) { $('run-name').textContent = `${want.model}: NO PANEL PRESENTED AND NO API.JSON`; return; }
  state.key = panel.deviceId || want.serial || want.model;
  state.write = (box && box.write_topic) || (panel.device && panel.device.write_topic) || '';
  // What the family IS (its thing.json roles, ROAD-3516): a monitoring box gets its trace.
  const roles = rolesFor(families, want.family || (panel.device && panel.device.type));
  state.panel = deckOrder(isMonitoring(roles) ? withTracePage(panel, roles, rigTopicOf(state.write), { width: W, height: H }) : panel);
  state.bus = bus;
  const asked = want.page && state.panel.pages.find(pg => pg.name.toUpperCase() === want.page.toUpperCase());
  state.page = asked ? asked.id : (state.panel.pages[0] && state.panel.pages[0].id);
  $('run-name').textContent = panel.name.replace(/ TOUCH PANEL$/, '');
  document.title = `${$('run-name').textContent} · Touch Panel`;
  $('run-from').textContent = `from ${panel.placement}`;
  const f = (box && box.fields) || {};
  const rawIdn = f.raw_idn;
  if (rawIdn) {
    const idnEl = $('run-idn');
    if (idnEl) {
      idnEl.hidden = false;
      idnEl.textContent = rawIdn;
      idnEl.title = `Device IDN: ${rawIdn}`;
    }
    for (const w of state.panel.widgets) {
      if (idnBound(w, state.write)) {
        w.value = rawIdn;
      }
    }
  }
  const unreachable = String(f.reachable) === '0' || f.status === 'stale';
  if (box && box.found && unreachable) pill('box-pill', `UNREACHABLE · last seen ${box.verified_age_s ?? '?'} s ago${f.error ? ' · ' + f.error : ''}`, 'dead');
  else if (box && box.found) pill('box-pill', `ON THE BUS · ${box.verified_age_s ?? '?'} s`, 'good');
  else if (state.write) pill('box-pill', 'PRESENTED, NOT VERIFIED', 'kinda');
  else pill('box-pill', 'BOX NOT FOUND — CANNOT SEND', 'dead');
  const busState = () => {
    pill('bus-pill', bus && bus.connected ? 'BUS' : 'NO BUS', bus && bus.connected ? 'good' : 'dead');
    $('bus-pill').title = bus ? `broker ${bus.url || '(the shell\'s)'}` : 'no bus client on this page';
  };
  busState();
  setInterval(busState, 2000);
  render();
  listen();
  startEverything(want);
  if (host.get('frame')) showFrame(host.get('frame'));
  tellHost('apk:run-ready');
}

/* The template, drawn: no box, no bus, no saved panel — a picture of what a box of
   this part would present, every control saying it cannot send. */
async function startTemplate(want) {
  const panel = await partPanel(want.bim);
  if (!panel) { $('run-name').textContent = `${want.bim}: THIS PART CARRIES NO PANEL TEMPLATE`; return; }
  state.template = true;
  state.panel = panel;
  state.key = panel.deviceId;
  state.write = '';
  const asked = want.page && panel.pages.find(pg => pg.name.toUpperCase() === want.page.toUpperCase());
  state.page = asked ? asked.id : (panel.pages[0] && panel.pages[0].id);
  $('run-name').textContent = panel.name.replace(/ TOUCH PANEL$/, '');
  document.title = `${$('run-name').textContent} · Touch Panel`;
  $('run-from').textContent = 'from its BIM part';
  pill('box-pill', 'TEMPLATE · NO UNIT — NOTHING IS SENT', 'kinda');
  pill('bus-pill', 'NO BUS', 'dead');
  $('bus-pill').title = 'a template is drawn without the bus';
  render();
}

window.addEventListener('resize', fit);
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.pop') && !e.target.closest('.tw')) closePop();
});
start();
