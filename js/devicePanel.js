// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* devicePanel.js — A DEVICE THAT HAS A GUI HAS A TOUCH PANEL (ROAD-3503).

   Every discovered device presents its own panel, retained on the bus at
       APK.audio/System/Gui/Panels/<key>
       { key, folder, device: { type, model, resource, serial, write_topic },
         placements: [ { at: "Instruments/3_Generator", frames: [ {path, content}, … ] },
                       { at: "Device_Consoles",         frames: [ … ] } ] }
   (instruments/present.rs on the thick node; OS/Apps/Frames/bus-panels draws
   the same documents). The Instruments tab's placement is the starting touch
   panel: one page per frame, one control per field, each control keeping the
   command it already drives (`komand_handler`) and the reading it already
   listens to (`komand_listen_topic`). The deeper placements are the same
   device's further panels — `?placement=Device_Consoles` starts from one.

   A NETWORK DEVICE'S PANEL (a Cast speaker, ROAD-3523) speaks no KOMAND: the
   plugin's runner binds its fields straight to the device's own topics —
   `device_control: "<Verb>"` → `…/Control/<Verb>`, `device_state: "<leaf>"` →
   `…/<leaf>` (apk-plugin-runner panels.rs). Such a control is `direct`: the
   running panel publishes `{"value": …}` to that topic, live, and a state leaf
   is the readout's address.

   A model that presents no panel but has an api.json (the plain GUI page is
   drawn from it) still gets one: panelFromVariables() lays its set / do / rig
   commands out a page per command group, and its gets as readouts.

   Pure: no DOM, no bus. The app feeds it documents; the tests feed it fixtures. */

import { variableId, suggestWidgetType, humanLabel, bindingFor } from './library.js';
import { rigHeight } from './controls.js';

/** Which placement a starting panel is drawn from when the link names none. */
export const DEFAULT_PLACEMENT = 'Instruments';

/* A Gui_Frames widget type -> the touch panel control that plays the same part.
   Wire constants of the frame format, not a device list. */
const FRAME_TO_CONTROL = {
  _GuiKnob: 'knob',
  // value + horizontal fader + dial in one field: on glass, the dial.
  _Horizontal_with_dial_Value: 'knob',
  _GuiFader: 'fader',
  _CustomFader: 'fader',
  _GuiFaderVertical: 'fader',
  _GuiFaderHorizontal: 'fader',
  _GuiButtonToggle: 'button',
  _GuiButtonToggler: 'button',
  _GuiButton: 'button',
  _TrapezoidButton: 'button',
  _GuiActuator: 'button',
  SelectorSwitch: 'selector',
  _GuiMeter: 'meter',
  _Meter: 'meter',
  _VuMeter: 'vu',
  _NeedleVUMeter: 'vu',
  _CustomLTP: 'ltp',
  _MDP: 'mdp',
  _CMDP: 'cmdp',
  _HighVisButton: 'tile',
  _GuiTrendChart: 'trace',
  _GuiMatrix: 'matrix',
  _CrossMatrix: 'matrix',
  CrossMatrix: 'matrix',
};
const CONTAINERS = new Set(['OcaBin', 'OcaBlock']);

/* Sizes on a 1280 × 800 glass; a horizontal fader lies down. */
const SIZE = {
  knob: [90, 100], fader: [70, 220], faderH: [240, 60], button: [130, 60],
  selector: [220, 220], meter: [45, 220], vu: [260, 160], readout: [170, 50],
  rig: [230, 0], nab: [230, 0],
  ltp: [70, 220], mdp: [180, 180], cmdp: [220, 220], tile: [140, 90], trace: [320, 180],
};

const MARGIN = 12;
const GAP = 8;
/* How far a sparse page is enlarged to fill the glass. */
const MAX_GROW = 1.6;

/* The size a control takes; a rig / nab grows a row per argument. */
function sizeOf(type, args) {
  if (type === 'rig' || type === 'nab') return [SIZE[type][0], rigHeight((args || []).length)];
  return SIZE[type] || SIZE.readout;
}

/* Rig and nab are their own sections (multi-input commands, multi-value reads). */
const SECTION = { rig: 'RIG', nab: 'NAB' };

/**
 * Lay items out on pages of W×H glass, packed: blocks share a row when they fit
 * (a wider gap marks where one ends; with rowPerBand each block starts its own
 * row and nothing is enlarged — a presented frame, drawn at its own sizes), a
 * full row wraps, a full page runs on
 * over "<name> 2". A page that ends up sparse is enlarged (≤ MAX_GROW) to fill
 * the glass, so a dozen controls are not a strip across the top of a screen.
 * items: [{ widget, w, h, band }] -> pushes pages, sets widget x/y/w/h/page.
 */
function pack(items, name, W, H, pages, rowPerBand = false) {
  if (!items.length) return;
  let more = 1;
  let page = { id: `p${pages.length + 1}`, name, members: [] };
  pages.push(page);
  const all = [page];
  let x = MARGIN; let y = MARGIN; let rowH = 0; let band = null;
  for (const it of items) {
    const newBand = band !== null && it.band !== band && x > MARGIN;
    const sep = newBand ? GAP * 2 : 0;
    // A frame's block starts its own row, as the device window draws it.
    if ((rowPerBand && newBand) || (x + sep + it.w > W - MARGIN && x > MARGIN)) { x = MARGIN; y += rowH + GAP; rowH = 0; }
    else x += sep;
    band = it.band;
    if (y + it.h > H - MARGIN && y > MARGIN) {
      page = { id: `p${pages.length + 1}`, name: `${name} ${++more}`, members: [] };
      pages.push(page); all.push(page);
      x = MARGIN; y = MARGIN; rowH = 0;
    }
    Object.assign(it.widget, { x, y, w: it.w, h: it.h, page: page.id });
    page.members.push(it.widget);
    x += it.w + GAP; rowH = Math.max(rowH, it.h);
  }
  for (const pg of all) {
    const right = Math.max(...pg.members.map(w => w.x + w.w));
    const bottom = Math.max(...pg.members.map(w => w.y + w.h));
    const k = rowPerBand ? 1 : Math.min((W - MARGIN) / right, (H - MARGIN) / bottom, MAX_GROW);
    if (k > 1.05) {
      for (const w of pg.members) {
        w.x = Math.round(w.x * k); w.y = Math.round(w.y * k);
        w.w = Math.round(w.w * k); w.h = Math.round(w.h * k);
      }
    }
    delete pg.members;
  }
}

/** The control type for one frame field. Anything that only shows a value is a readout. */
export function controlFor(field) {
  const t = field && field.type;
  // A toggler that holds options is an ARRAY of buttons, each its own element
  // (the 3235's crosspoints: one button per channel), not one button.
  if (t === '_GuiButtonToggler' && optionsOf(field).length) return 'crosspoints';
  return FRAME_TO_CONTROL[t] || 'readout';
}

/* ------------------------------------------------- connections, per element

   A control bound to an ARRAY of elements is not one connection. A row of
   crosspoint buttons sends Close_Channels with each button's own channel; a
   crosspoint matrix sends Close_Channels / Open_Channels with each cell's
   channel. Every element is its own wire (owner, 2026-11-11: "show all the
   connections... even when they are an array of elements"), so a binding
   carries `elements: [{ value, label }]` — what that element hands the
   command's argument. The editor reads the connection to pick the control
   and to draw it. */

/** A toggler's options, in order: [{ value, label, about }]. */
export function optionsOf(field) {
  const o = field && field.options;
  if (!o || typeof o !== 'object') return [];
  const list = Array.isArray(o) ? o.map((v, i) => [String(i + 1), v]) : Object.entries(o);
  return list
    .filter(([, v]) => v && typeof v === 'object' && v.value != null)
    .sort(([a], [b]) => (Number(a) - Number(b)) || String(a).localeCompare(String(b)))
    .map(([, v]) => ({ value: String(v.value), label: fieldLabel('', v) || String(v.value), about: text(v.description) }));
}

/** A crosspoint matrix's cells: channel = slot*100 + bus*10 + source (CrossMatrix.jsx,
    straight off the module schematic), bus and source counted from 1. */
export function matrixCells(field) {
  const slot = Number(field && field.slot) || 0;
  const buses = Array.isArray(field && field.buses) ? field.buses : [];
  const sources = Array.isArray(field && field.sources) ? field.sources : [];
  const out = [];
  buses.forEach((bus, b) => sources.forEach((src, s) => {
    out.push({
      value: String(slot * 100 + (b + 1) * 10 + (s + 1)).padStart(3, '0'),
      label: `${fieldLabel('', bus)} ← ${fieldLabel('', src)}`,
      bus: b, source: s,
    });
  }));
  return out;
}

function text(v) {
  if (v == null) return '';
  if (typeof v === 'string' || typeof v === 'number') return String(v);
  if (typeof v === 'object') return text(v.En ?? v.text ?? '');
  return '';
}

const MOMENTARY = new Set(['_GuiActuator', '_GuiButton']);

/** The Behavior a field already states: range, unit, default, how it touches, where it reads back. */
export function behaviorOf(field, type) {
  const b = {};
  const dom = field.domain || {};
  const num = v => (v === '' || v == null || Number.isNaN(Number(v)) ? undefined : Number(v));
  if (num(dom.min) !== undefined) b.min = num(dom.min);
  if (num(dom.max) !== undefined) b.max = num(dom.max);
  const step = num(field.step ?? dom.step_fine);
  if (step !== undefined) b.step = step;
  const unit = field.units || dom.units;
  if (unit) b.unit = String(unit);
  const dflt = field.value && field.value.default_value;
  if (dflt !== undefined && dflt !== null && dflt !== '') b.default = String(dflt);
  if (type === 'button') b.mode = MOMENTARY.has(field.type) && !field.latching ? 'momentary' : 'toggle';
  if (type === 'readout') b.mode = 'display only';
  if (field.komand_listen_topic) b.feedback = field.komand_listen_topic;
  if (field.komand_domain_from) b.domainFrom = field.komand_domain_from;
  if (type === 'fader' && /Horizontal/.test(field.type)) b.orientation = 'horizontal';
  if (type === 'selector' && Array.isArray(field.positions)) {
    b.positions = field.positions.length;
    b.values = field.positions.map(String);
    b.labels = (field.position_labels || field.positions).map(String);
    b.subtitle = b.labels.join(' · ');
  }
  return b;
}

/** The label a field shows in its frame: label.text.En, label.En, else its key. */
export function fieldLabel(key, field) {
  const l = field && field.label;
  // A two-state label ({inactive: {text}, active: {text}}) names itself at rest.
  const face = l && typeof l === 'object' && !('text' in l) ? (l.inactive || l.active) : null;
  const said = face && typeof face === 'object' ? text(face.text) : '';
  return (said || text(l && typeof l === 'object' && 'text' in l ? l.text : l) || String(key || '')).trim();
}

/** "TCPIP0::44.44.44.222::gpib7,22::INSTR" and "TCPIP::44.44.44.222::gpib7,22::INSTR" are one box. */
export function resourceKey(res) {
  return String(res || '').split('::')
    .filter(s => s && !/^TCPIP\d*$/i.test(s) && !/^(INSTR|SOCKET)$/i.test(s) && !/^(5025|inst0)$/i.test(s))
    .join('::').toLowerCase();
}

/** A serial that names one box: not empty, not "0" (the 6060B answers 0 for every unit). */
function realSerial(s) {
  const v = String(s ?? '').trim();
  return v && !/^0+$/.test(v) ? v : '';
}

/** Is this presented document the box the link was for? Serial first, then model + resource. */
export function isPanelFor(doc, want) {
  const d = (doc && doc.device) || {};
  if (!want || !want.model || d.model !== want.model) return false;
  const s = realSerial(want.serial);
  if (s && realSerial(d.serial)) return realSerial(d.serial) === s;
  if (want.resource && d.resource) return resourceKey(d.resource) === resourceKey(want.resource);
  return true;
}

/** The placements a document carries, the starting one first. */
export function placementsOf(doc, prefer = DEFAULT_PLACEMENT) {
  const all = ((doc && doc.placements) || []).filter(p => p && Array.isArray(p.frames) && p.frames.length);
  const first = all.find(p => String(p.at || '') === prefer || String(p.at || '').startsWith(`${prefer}/`));
  return first ? [first, ...all.filter(p => p !== first)] : all;
}

/* "0_output/0_output.json" -> "OUTPUT" */
function pageName(path, content) {
  const dir = String(path || '').split('/')[0].replace(/\.json$/i, '') || Object.keys(content || {})[0] || 'Page';
  return dir.replace(/^\d+_/, '').replace(/_/g, ' ').trim().toUpperCase() || 'PAGE';
}

/* Frame types a person types into: their control sends the text. */
const TEXT_FIELDS = new Set(['_TextInput', '_GuiTextInput', '_SmartInput']);

/* `…/Control/<Verb>` — the leaf a plugin's control agent reads (topics::DEVICE_CONTROL_LEAF). */
const CONTROL_TOPIC = /\/Control\/([^/#+]+)$/;

/** A field bound straight to a control topic (no KOMAND), or null: one the
    runner bound by `device_control`, or one whose `topic` the template named
    outright on a `…/Control/<Verb>` — the Cast panel's All-devices fader and
    MUTE ALL write `chromecast/Group/All/Control/Volume|Mute` (ROAD-3546). */
export function directOf(field) {
  if (!field || typeof field.topic !== 'string' || !field.topic) return null;
  if (field.komand_handler && field.komand_handler.command) return null;
  if (field.read_only === true || typeof field.device_state === 'string') return null;
  let verb = typeof field.device_control === 'string' ? field.device_control : '';
  if (!verb) {
    const m = CONTROL_TOPIC.exec(field.topic);
    if (!m) return null;
    verb = m[1];
  }
  const d = { topic: field.topic, verb };
  if (TEXT_FIELDS.has(field.type)) d.text = true;
  return d;
}

/** The binding a frame field already carries, in the builder's binding shape. */
export function bindingOf(field, device = {}, deviceKey = '') {
  const h = field && field.komand_handler;
  if (!h || h.enable === false || !h.command) return null;
  const family = device.type || h.sub_path || '';
  const model = h.model || device.model || '';
  const verb = h.komand_type || 'set';
  return {
    id: variableId(family, model, verb, h.command),
    family, model, verb,
    command: h.command,
    scpi: '',
    topic: h.target || device.write_topic || '',
    device: deviceKey,
  };
}

/** How many connections a control has: one per plain binding, one per element
    of an array binding (8 crosspoint buttons on Close_Channels = 8). */
export function connectionCount(widget) {
  return ((widget && widget.bindings) || [])
    .reduce((n, b) => n + (Array.isArray(b && b.elements) && b.elements.length ? b.elements.length : 1), 0);
}

/** Every element wired to one variable, across the panel's controls:
    [{ widget, value, label }] in control order. */
export function elementConnections(widgets, variableId) {
  const out = [];
  for (const w of widgets || []) {
    for (const b of (w && w.bindings) || []) {
      if (!b || b.id !== variableId || !Array.isArray(b.elements)) continue;
      for (const e of b.elements) out.push({ widget: w, value: String(e.value), label: String(e.label || e.value) });
    }
  }
  return out;
}

/* Frame keys a field names its siblings by (CrossMatrix: `opens` / `closes`). */
const SIBLING_REFS = ['opens', 'closes'];

/* A field whose value is its own text: no topic, no reading, no command. Its
   value_default is the panel's words (the Device header), not a measurement. */
function isStatic(field) {
  return !field.topic && !field.komand_listen_topic && !field.komand_readout
    && !field.device_state && !(field.komand_handler && field.komand_handler.command);
}

/* WHERE A FIELD'S VALUE ARRIVES (owner, 2026-11-12: "this touch panel... and
   the devices interface should be the same"). The frame says it, in order:
     komand_listen_topic                 its own readback topic;
     topic, on a device_state field OR a komand_readout one
                                         a readout that names its topic listens
                                         THERE — the 4263A's "Status, primary,
                                         secondary" is {komand_readout, topic:
                                         <box>/Read}, the box's raw answer, and
                                         the OS window shows it from there;
     komand_handler.target               a control's box;
   and only a readout that names no topic at all falls back to the box's
   identity reply (Reading/Read_IDN, beside its Write). It used to take that
   fallback for every komand_readout, so the run panel showed *IDN? where the
   device window showed the measurement. */
export function addressOf(key, field) {
  const f = field || {};
  if (f.komand_listen_topic) return f.komand_listen_topic;
  if (f.topic && (f.device_state || f.komand_readout)) return f.topic;
  if (f.komand_handler && f.komand_handler.target) return f.komand_handler.target;
  return f.komand_readout || /identity/i.test(String(key || '')) ? 'Reading/Read_IDN' : '';
}

/* "40%" of a row, or null. */
function pctOf(v) {
  const m = /^\s*(\d+(?:\.\d+)?)\s*%\s*$/.exec(String(v ?? ''));
  return m ? Math.max(1, Math.min(100, Number(m[1]))) / 100 : null;
}

/* Every block of a frame in order: [{ block, fields: [[key, field]…] }], nested
   blocks flattened under their top-level block's name. */
function blocksOf(node, band, out) {
  for (const [key, f] of Object.entries(node || {})) {
    if (!f || typeof f !== 'object') continue;
    if (CONTAINERS.has(f.type)) {
      const here = { block: band ? `${band}/${key}` : key, fields: [] };
      out.push(here);
      for (const [k, v] of Object.entries(f.fields || {})) {
        if (v && typeof v === 'object' && CONTAINERS.has(v.type)) blocksOf({ [k]: v }, here.block, out);
        else if (v && typeof v === 'object' && typeof v.type === 'string') here.fields.push([k, v]);
      }
      blocksOf(f.blocks || {}, here.block, out);
    } else if (typeof f.type === 'string') {
      out.push({ block: band || 'Main', fields: [[key, f]] });
    }
  }
  return out;
}

/* Glass size of a field drawn as the frame draws it. */
function frameSize(type, field, rowW) {
  const lay = field.layout || {};
  const pct = pctOf(lay.width) ?? (typeof field.geometry?.width === 'number' && field.geometry.width <= 100 && pctOf(`${field.geometry.width}%`));
  if (type === 'crosspoints') {
    // The engine's toggler: max_cols columns (4 when unset), pady gaps (5 when
    // unset or 0), 10px padding and a 1px border round layout.height buttons.
    const n = optionsOf(field).length;
    const cols = Math.max(1, parseInt(lay.max_cols || 4, 10));
    const rows = Math.max(1, Math.ceil(n / cols));
    const bh = typeof lay.height === 'number' ? lay.height : 50;
    const gy = parseInt(lay.pady || 5, 10);
    return [Math.round(rowW * (pct || 1)), rows * bh + (rows - 1) * gy + 22];
  }
  if (type === 'matrix') {
    const cell = field.cell || {};
    const cw = Number(cell.width) || 150; const ch = Number(cell.height) || 34; const nw = Number(cell.name_width) || 190;
    // CrossMatrix.jsx: 6px side padding, 6px gaps, a ~34px title row, 3px under each bus row.
    const w = 12 + nw + (cw + 6) * ((field.sources || []).length || 1);
    const h = 8 + 34 + (ch + 3) * ((field.buses || []).length || 1);
    return [Math.min(rowW, w), h];
  }
  // Any other field is as big as the frame says (layout first, then geometry,
  // as the engine reads them), so its control's box is the box the engine
  // draws — a trend chart is not a 170 × 50 readout with a 320 px chart
  // spilling out of it.
  const dw = pct ? Math.round(rowW * pct) - (type === 'readout' ? GAP : 0)
    : pxOf(lay.width) ?? pxOf(field.geometry?.width);
  const dh = pxOf(lay.height) ?? pxOf(field.geometry?.height);
  if (dw == null && dh == null) return null;
  const [bw, bh] = SIZE[type] || SIZE.readout;
  return [Math.min(rowW, dw ?? bw), dh ?? bh];
}

/* 320 or "320px" -> 320; anything else (a %, "auto", unset) -> null. */
function pxOf(v) {
  if (typeof v === 'number') return v > 0 ? v : null;
  const m = /^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/.exec(String(v ?? ''));
  return m && Number(m[1]) > 0 ? Number(m[1]) : null;
}

/**
 * The starting touch panel for one presented device: the panel the device
 * window shows, page for page and control for control. Each frame is a page
 * (named after its card when it declares one), each block starts a row, each
 * field is one control that keeps its whole frame config (`field`) so it is
 * exported back unchanged (frameExport widgetToField), and its connections —
 * every element of an array included — are its bindings.
 * opts: { placement (name to prefer), width, height }
 * -> { name, deviceId, device, placement, placements: [at…], pages, widgets } or null.
 */
export function panelFromPresented(doc, opts = {}) {
  const ordered = placementsOf(doc, opts.placement || DEFAULT_PLACEMENT);
  if (!ordered.length) return null;
  const pl = ordered[0];
  const device = doc.device || {};
  const W = opts.width || 1280;
  const H = opts.height || 800;
  const rowW = W - 2 * MARGIN;
  const pages = [];
  const widgets = [];
  const sections = { rig: [], nab: [] };
  let n = 0;

  /* One page per frame — and per top-level bin of a frame that holds several
     (a plugin presents its family as ONE file, playback / cast / session /
     device bins in it, where a bench instrument presents a file per bin). */
  const sheets = [];
  pl.frames.forEach((frame) => {
    const bins = Object.entries(frame.content || {}).filter(([, b]) => b && b.type === 'OcaBin');
    if (bins.length > 1) bins.forEach(([k, b]) => sheets.push({ path: `${k}/${k}.json`, content: { [k]: b } }));
    else sheets.push(frame);
  });
  const dirs = new Map();
  sheets.forEach(f => { const d = pageName(f.path, f.content); dirs.set(d, (dirs.get(d) || 0) + 1); });
  const nameOf = (frame) => {
    const card = Object.values(frame.content || {}).map(v => v && v.card).find(c => c && c.name);
    if (card) return String(card.name).toUpperCase();
    const dir = pageName(frame.path, frame.content);
    if (dirs.get(dir) < 2) return dir;
    const file = String(frame.path || '').split('/').pop().replace(/\.json$/i, '').replace(/^\d+_/, '').replace(/_/g, ' ').trim().toUpperCase();
    return file ? `${dir} · ${file}` : dir;
  };

  const handlerBinding = (field, elements) => {
    const binding = bindingOf(field, device, doc.key || '');
    if (binding && elements && elements.length) binding.elements = elements.map(e => ({ value: e.value, label: e.label }));
    return binding;
  };

  sheets.forEach((frame) => {
    const items = [];
    for (const { block, fields } of blocksOf(frame.content, null, [])) {
      const keys = new Set(fields.map(([k]) => k));
      // Hidden fields carry a connection for a visible sibling (a matrix's
      // Open_Cmd / Close_Cmd): they ride on the control that names them, else
      // on the block's first visible control, and are exported with it.
      const named = new Map();
      for (const [k, f] of fields) for (const ref of SIBLING_REFS) if (typeof f[ref] === 'string' && keys.has(f[ref])) named.set(f[ref], k);
      const visible = fields.filter(([, f]) => f.hidden !== true);
      const carriers = new Map();
      for (const [k, f] of fields) {
        if (f.hidden !== true) continue;
        const owner = named.get(k) || (visible[0] && visible[0][0]);
        if (!owner) continue;
        if (!carriers.has(owner)) carriers.set(owner, {});
        carriers.get(owner)[k] = f;
      }
      for (const [key, field] of visible) {
        const h0 = field.komand_handler || {};
        const verb = h0.enable === false ? '' : h0.komand_type;
        const sec = SECTION[verb] ? verb : '';
        const type = sec || controlFor(field);
        const horiz = type === 'fader' && /Horizontal/.test(field.type);
        const args = sec ? (h0.args || field.args || []) : null;
        const [w, h] = (!sec && frameSize(type, field, rowW)) || (horiz ? SIZE.faderH : sizeOf(type, args));
        const label = fieldLabel(key, field).replace(/_/g, ' ').trim();
        const widget = {
          id: `w_${++n}`,
          type,
          label: label.toUpperCase(),
          x: 0, y: 0, w, h,
          page: '',
          address: addressOf(key, field),
          channel: 1,
          bindings: [],
        };
        const direct = directOf(field);
        if (direct) widget.direct = direct;
        const behavior = sec ? { args } : behaviorOf(field, type);
        // The panel's own words are its value; a reading is never invented.
        if (!sec && isStatic(field) && field.value_default != null && field.value_default !== '') behavior.default = String(field.value_default);
        if (Object.keys(behavior).length) widget.behavior = behavior;
        if (behavior.subtitle) widget.subtitle = behavior.subtitle;
        const carried = carriers.get(key) || null;
        const elements = type === 'crosspoints' ? optionsOf(field) : type === 'matrix' ? matrixCells(field) : null;
        const own = handlerBinding(field, elements);
        if (own) widget.bindings.push(own);
        for (const f of Object.values(carried || {})) {
          const b = handlerBinding(f, elements);
          if (b && !widget.bindings.some(x => x.id === b.id)) widget.bindings.push(b);
        }
        // The handler exactly as the frame carries it (converter, readback, input
        // name): what the runner hands KOMAND when this control is touched.
        if (own) widget.komand = { ...field.komand_handler };
        // The frame field itself, whole: exported back as it came.
        widget.field = JSON.parse(JSON.stringify(field));
        widget.frame = { key, block, path: frame.path, label: widget.label };
        if (carried) widget.frame.carried = JSON.parse(JSON.stringify(carried));
        widgets.push(widget);
        (sec ? sections[sec] : items).push({ widget, w, h, band: block });
      }
    }
    const first = pages.length;
    pack(items, nameOf(frame), W, H, pages, true);
    // Where each page came from: the frame it is written back to on Save, and
    // the card it declares (its Touch Points tile).
    const card = Object.values(frame.content || {}).map(v => v && v.card).find(c => c && c.id);
    const root = Object.keys(frame.content || {}).find(k => frame.content[k] && typeof frame.content[k] === 'object') || '';
    for (const pg of pages.slice(first)) pg.source = { path: frame.path, root, ...(card ? { card } : {}) };
  });
  pack(sections.rig, SECTION.rig, W, H, pages);
  pack(sections.nab, SECTION.nab, W, H, pages);

  const who = [device.model, realSerial(device.serial)].filter(Boolean).join(' ');
  return {
    name: `${who || doc.key || 'DEVICE'} TOUCH PANEL`.toUpperCase(),
    deviceId: realSerial(device.serial) || doc.key || '',
    device,
    placement: pl.at,
    placements: ordered.map(p => p.at),
    pages,
    widgets,
  };
}

/** What the link asked for: ?model=&family=&resource=&serial=&placement=&page=
    and ?bim=<maker>/<model> — a BIM part's own panel template, no unit (ROAD-3687). */
export function linkQuery(search) {
  const q = new URLSearchParams(search || '');
  const get = k => (q.get(k) || '').trim();
  const out = {
    model: get('model'), family: get('family'), resource: get('resource'),
    serial: get('serial'), protocol: get('protocol'), placement: get('placement'),
    page: get('page'),
  };
  if (get('bim')) out.bim = get('bim');
  return out;
}

const LINK_KEYS = ['model', 'family', 'serial', 'resource', 'protocol', 'placement', 'page', 'bim'];

/* ------------------------------------------------- a BIM part's panel template */

/** Where a part's whole record is read: BIM's /api/bim on this page's own origin
    (the gateway, :8080's proxy and the library's :8160 all answer it). */
export function partUrl(id) {
  return `/api/bim/parts/${String(id || '').split('/').map(encodeURIComponent).join('/')}`;
}

const TOKEN = /\$\{([A-Za-z_]+)\}/g;
const fill = (s, tokens) => s.replace(TOKEN, (_, k) => (k in tokens ? tokens[k] : ''));
function stamp(v, tokens) {
  if (typeof v === 'string') return fill(v, tokens);
  if (Array.isArray(v)) return v.map(x => stamp(x, tokens));
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) out[fill(k, tokens)] = stamp(x, tokens);
    return out;
  }
  return v;
}
const markedN = (v) => (typeof v === 'string' ? v.includes('${n}')
  : Array.isArray(v) ? v.some(markedN)
    : v && typeof v === 'object' ? Object.entries(v).some(([k, x]) => k.includes('${n}') || markedN(x)) : false);

/** One template frame as the node would stamp it for a box of this model, with no
    box: a block (or array entry) named with ${n} repeated once per channel the
    model declares (none declared: dropped, never shown as "${n}"), each copy's
    handler told its channel, then the model's words filled in. What only a box
    knows — its resource, its topics, its slot — is left empty: a template names
    no unit (the node's panel_template/channels, in miniature). */
function stampFrame(content, tokens, channels) {
  const repeat = (v) => {
    if (Array.isArray(v)) {
      const out = [];
      for (const x of v) {
        if (!markedN(x)) { out.push(repeat(x)); continue; }
        for (let i = 1; i <= channels; i += 1) out.push(stamp(repeat(x), { n: String(i), chan: String(i) }));
      }
      return out;
    }
    if (!v || typeof v !== 'object') return v;
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      if (!k.includes('${n}')) { out[k] = repeat(x); continue; }
      for (let i = 1; i <= channels; i += 1) {
        const copy = stamp(repeat(x), { n: String(i), chan: String(i) });
        (function tell(node) {
          if (Array.isArray(node)) { node.forEach(tell); return; }
          if (!node || typeof node !== 'object') return;
          if (node.komand_handler && typeof node.komand_handler === 'object') {
            node.komand_handler.params = { ...(node.komand_handler.params || {}), chan: String(i), n: String(i) };
          }
          Object.values(node).forEach(tell);
        }(copy));
        out[fill(k, { n: String(i) })] = copy;
      }
    }
    return out;
  };
  return stamp(repeat(content), tokens);
}

/**
 * A BIM part's panel template (part.panel: {template, frames: {"<F>.json": …,
 * "<F>_N.json": …}, descriptor}) as a presented document panelFromPresented reads:
 * one TEMPLATE placement, the part's own frames (the group frame <F>_N.json, the
 * bank of N boxes, only when the family has nothing else), and a device that is
 * the part — model and part id, no resource, no serial, no write topic, so nothing
 * it draws can reach a box (ROAD-3687). → null when the part carries no panel.
 */
export function presentedFromPart(part) {
  const panel = part && part.panel;
  const frames = panel && panel.frames;
  if (!frames || typeof frames !== 'object') return null;
  const d = (panel.descriptor && typeof panel.descriptor === 'object') ? panel.descriptor : {};
  const channels = Math.max(0, Math.floor(Number(d.channels) || 0));
  const model = String(part.model || d.model || '');
  const family = String(panel.template || d.type || part.class || '');
  const tokens = {
    model, family, name: String(part.name || model), manufacturer: String(part.manufacturer || d.manufacturer || ''),
    channels: channels ? String(channels) : '', all_traces: channels === 2 ? 'BOTH TRACES' : `ALL ${channels} TRACES`,
  };
  const all = Object.entries(frames).filter(([, c]) => c && typeof c === 'object');
  const own = all.filter(([path]) => !/_N\.json$/i.test(path));
  const use = own.length ? own : all;
  if (!use.length) return null;
  return {
    key: String(part.id || model),
    template: true,
    device: { model, type: family, part: String(part.id || ''), serial: '', resource: '' },
    placements: [{ at: 'Template', frames: use.map(([path, content]) => ({ path, content: stampFrame(content, tokens, channels) })) }],
  };
}

/** The query a panel is reopened by — the inverse of linkQuery. Other
    parameters already on the page (?solo=, the shell's own) are kept. */
export function linkSearch(want, keep = '') {
  const q = new URLSearchParams(keep || '');
  for (const k of LINK_KEYS) {
    const v = want && want[k] != null ? String(want[k]).trim() : '';
    if (v) q.set(k, v); else q.delete(k);
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

/**
 * The touch panel for a model that presents none: its api.json variables
 * (library.variablesFromApi), one page per command group, the settable ones
 * first. device: the bench box it binds to, if any.
 */
export function panelFromVariables(vars, { model = '', family = '', device = null, width = 1280, height = 800 } = {}) {
  const usable = (vars || []).filter(v => v && v.command);
  if (!usable.length) return null;
  const groups = new Map();
  const sections = { rig: [], nab: [] };
  const order = { set: 0, do: 1, get: 2 };
  const pages = [];
  const widgets = [];
  let n = 0;
  const make = (v) => {
    const type = suggestWidgetType(v);
    const [w, h] = sizeOf(type, v.args);
    const widget = {
      id: `w_${++n}`, type, label: humanLabel(v.command), x: 0, y: 0, w, h, page: '',
      address: v.readingTopic || v.topic || '', channel: 1,
      bindings: [bindingFor(v, device)],
    };
    const behavior = {};
    if (SECTION[v.verb]) behavior.args = v.args || [];
    if (v.unit) behavior.unit = v.unit;
    if (v.verb === 'get') behavior.mode = 'display only';
    if (v.values && v.values.length) { behavior.subtitle = v.values.slice(0, 6).join(' · '); widget.subtitle = behavior.subtitle; }
    if (Object.keys(behavior).length) widget.behavior = behavior;
    widgets.push(widget);
    return { widget, w, h };
  };
  for (const v of usable) {
    if (SECTION[v.verb]) { sections[v.verb].push(v); continue; }
    const g = v.group || v.subsystem || 'General';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(v);
  }
  for (const [g, list] of groups) {
    list.sort((a, b) => (order[a.verb] ?? 9) - (order[b.verb] ?? 9));
    pack(list.map(v => ({ ...make(v), band: v.verb })), String(g).replace(/_/g, ' ').toUpperCase(), width, height, pages);
  }
  for (const verb of ['rig', 'nab']) {
    pack(sections[verb].map(v => ({ ...make(v), band: v.group || '' })), SECTION[verb], width, height, pages);
  }
  return {
    name: `${model || 'DEVICE'} TOUCH PANEL`.toUpperCase(),
    deviceId: '', device: { type: family, model }, placement: 'api.json', placements: [],
    pages, widgets,
  };
}

/* ------------------------------------------------------------ device tabs */

/** What a bench row's link asks for. A BIM key is the box's serial / MAC; a
    discovery prefix (has a "/") is not, so the resource names the box then. */
export function wantFor(d) {
  const key = String((d && d.key) || '');
  return {
    model: (d && d.model) || '', family: (d && d.family) || '',
    serial: key && !key.includes('/') ? key : '',
    resource: (d && d.address) || '', protocol: '', placement: '', page: '',
  };
}

/** The bench rows that earn a device tab: online, with a model to open. */
export function tabbable(bench) {
  return (bench || []).filter(d => d && d.liveness === 'online' && d.model);
}

/** Rows online now that have no tab yet, in bench order. */
export function arrivals(bench, tabs) {
  return tabbable(bench).filter(d => !tabs.has(d.key));
}
