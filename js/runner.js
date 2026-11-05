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
   no /mqtt of its own, so the broker comes from config/discovered.json
   `broker_urls` — a tunable, never a port written here. No bus: the panel is
   drawn, every control says it cannot send, and nothing is pretended. */

import { CONTROL_DEFINITIONS, widgetStyleVars } from './controls.js';
import { linkQuery, linkSearch, isPanelFor, panelFromPresented, panelFromVariables } from './devicePanel.js';
import { ControlLibrary, modelKey } from './library.js';
// The app's discovery tunables, through the shared client (ROAD-3502).
const loadDiscoveredConfig = () => (window.APKSoftapp?.discoveredConfig
  ? window.APKSoftapp.discoveredConfig(new URL('../config/discovered.json', import.meta.url).href) : Promise.resolve({}));
import {
  controlTopic, handlerFor, fireMessages, touchKind, clampValue, readingText, readbackTopics, brokerFor,
} from './runPanel.js';
import { savedIdentity, savedTopic, readSaved } from './savedPanel.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const W = 1280;
const H = 800;

const state = { panel: null, page: '', link: null, write: '', key: '', bus: null, on: new Set(), els: new Map() };

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
  if (!want.resource) return null;
  const q = new URLSearchParams({ protocol: want.protocol || 'visa', resource: want.resource, model: want.model });
  try {
    const r = await fetch(`/api/instrument/status?${q}`, { cache: 'no-store' });
    return r.ok ? await r.json() : null;
  } catch (_) { return null; }
}

async function loadPanel(want) {
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
  const urls = brokerFor(cfg, location.hostname);
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

function listen() {
  const link = state.bus;
  if (!link) return;
  for (const [topic, widgets] of readbackTopics(state.panel.widgets, state.write)) {
    link.subscribe(topic, (_t, text) => {
      for (const w of widgets) {
        w.value = readingText(text, w.behavior && w.behavior.unit);
        draw(w);
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
  const pop = popAt(el, `<h4>${esc(w.label)}</h4><div class="row">${b.values.map((v, i) =>
    `<button data-v="${esc(v)}">${esc(labels[i] || v)}</button>`).join('')}</div>
    <div class="row"><button data-close>Cancel</button></div>`);
  pop.querySelectorAll('[data-v]').forEach(btn => btn.addEventListener('click', () => {
    if (fire(w, btn.dataset.v)) { w.value = btn.textContent; draw(w); closePop(); }
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
  el.addEventListener('click', () => (kind === 'choose' ? choosePop : kind === 'args' ? argsPop : numberPop)(el, w));
}

/* The release edge, without the config again: KOMAND drops a falsy DO/NAB. */
function publishRelease(w) {
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
  const shown = w.value !== undefined && w.value !== null && w.value !== '' ? w.value : '—';
  const behavior = { ...(w.behavior || {}), default: '' };
  el.innerHTML = def.render({ ...w, behavior, label: esc(w.label), subtitle: esc(w.subtitle), value: esc(shown), style: w.style || {} });
}

function render() {
  const p = state.panel;
  const tabs = $('run-tabs');
  tabs.innerHTML = '';
  for (const pg of p.pages) {
    const b = document.createElement('button');
    b.role = 'tab';
    b.textContent = pg.name;
    b.setAttribute('aria-selected', String(pg.id === state.page));
    b.addEventListener('click', () => { state.page = pg.id; closePop(); render(); });
    tabs.append(b);
  }
  const glass = $('run-glass');
  glass.style.width = `${W}px`;
  glass.style.height = `${H}px`;
  glass.innerHTML = '';
  state.els.clear();
  const first = p.pages[0] && p.pages[0].id;
  for (const w of p.widgets.filter(x => (x.page || first) === state.page)) {
    const el = document.createElement('div');
    el.className = `tw${handlerFor(w) ? '' : ' unbound'}${state.on.has(w.id) ? ' on' : ''}`;
    Object.assign(el.style, { left: `${w.x}px`, top: `${w.y}px`, width: `${w.w}px`, height: `${w.h}px` });
    Object.entries(widgetStyleVars({ style: w.style || {} })).forEach(([k, v]) => el.style.setProperty(k, v));
    state.els.set(w.id, el);
    glass.append(el);
    draw(w);
    attach(el, w);
  }
  fit();
}

function fit() {
  const stage = $('run-stage');
  stage.style.top = `${$('run-tabs').getBoundingClientRect().bottom}px`;
  const k = Math.min((stage.clientWidth - 20) / (W + 24), (stage.clientHeight - 20) / (H + 24), 1.5);
  const bezel = $('run-bezel');
  bezel.style.transform = `scale(${Math.max(0.2, k)})`;
}

/* ---------------------------------------------------------------- start */

async function start() {
  const want = linkQuery(location.search);
  if (!want.model) { $('run-name').textContent = 'NO DEVICE NAMED (?model=…)'; return; }
  $('run-name').textContent = `${want.model} — LOADING…`;
  $('run-edit').href = `./index.html${linkSearch(want, '')}`;
  const [generated, box, bus] = await Promise.all([loadPanel(want), findBox(want), connectBus()]);
  // The panel saved for this box runs first (ROAD-3503), unless a placement was asked for.
  const topic = bus && !want.placement
    ? savedTopic(window.APKContracts.Topics.gui.topic, savedIdentity(generated, want)) : '';
  const saved = topic ? await readSaved(bus, topic, 1500) : null;
  const panel = saved
    ? { ...saved, device: (generated && generated.device) || { model: want.model, type: want.family },
        deviceId: saved.deviceId || (generated && generated.deviceId) || '', placement: 'saved panel' }
    : generated;
  if (!panel) { $('run-name').textContent = `${want.model}: NO PANEL PRESENTED AND NO API.JSON`; return; }
  state.panel = panel;
  state.key = panel.deviceId || want.serial || want.model;
  state.write = (box && box.write_topic) || (panel.device && panel.device.write_topic) || '';
  state.bus = bus;
  const asked = want.page && panel.pages.find(pg => pg.name.toUpperCase() === want.page.toUpperCase());
  state.page = asked ? asked.id : (panel.pages[0] && panel.pages[0].id);
  $('run-name').textContent = panel.name.replace(/ TOUCH PANEL$/, '');
  document.title = `${$('run-name').textContent} · Touch Panel`;
  $('run-from').textContent = `from ${panel.placement}`;
  if (box && box.found) pill('box-pill', `ON THE BUS · ${box.verified_age_s ?? '?'} s`, 'good');
  else if (state.write) pill('box-pill', 'PRESENTED, NOT VERIFIED', 'kinda');
  else pill('box-pill', 'BOX NOT FOUND — CANNOT SEND', 'dead');
  const busState = () => pill('bus-pill', bus && bus.connected ? 'BUS' : 'NO BUS', bus && bus.connected ? 'good' : 'dead');
  busState();
  setInterval(busState, 2000);
  render();
  listen();
}

window.addEventListener('resize', fit);
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('.pop') && !e.target.closest('.tw')) closePop();
});
start();
