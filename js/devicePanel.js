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
};
const CONTAINERS = new Set(['OcaBin', 'OcaBlock']);

/* Sizes on a 1280 × 800 glass; a horizontal fader lies down. */
const SIZE = {
  knob: [90, 100], fader: [70, 220], faderH: [240, 60], button: [130, 60],
  selector: [130, 130], meter: [45, 220], vu: [160, 110], readout: [170, 50],
  rig: [230, 0], nab: [230, 0],
  ltp: [70, 220], mdp: [180, 180], cmdp: [220, 220], tile: [140, 90],
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
 * (a wider gap marks where one ends), a full row wraps, a full page runs on
 * over "<name> 2". A page that ends up sparse is enlarged (≤ MAX_GROW) to fill
 * the glass, so a dozen controls are not a strip across the top of a screen.
 * items: [{ widget, w, h, band }] -> pushes pages, sets widget x/y/w/h/page.
 */
function pack(items, name, W, H, pages) {
  if (!items.length) return;
  let more = 1;
  let page = { id: `p${pages.length + 1}`, name, members: [] };
  pages.push(page);
  const all = [page];
  let x = MARGIN; let y = MARGIN; let rowH = 0; let band = null;
  for (const it of items) {
    const sep = band !== null && it.band !== band && x > MARGIN ? GAP * 2 : 0;
    if (x + sep + it.w > W - MARGIN && x > MARGIN) { x = MARGIN; y += rowH + GAP; rowH = 0; }
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
    const k = Math.min((W - MARGIN) / right, (H - MARGIN) / bottom, MAX_GROW);
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
  return FRAME_TO_CONTROL[t] || 'readout';
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
  return (text(l && typeof l === 'object' && 'text' in l ? l.text : l) || String(key || '')).trim();
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

/* Every leaf of a frame, depth first, with the top-level block it sits in. */
function leaves(node, band, out) {
  for (const [key, f] of Object.entries(node || {})) {
    if (!f || typeof f !== 'object') continue;
    if (CONTAINERS.has(f.type)) {
      leaves(f.blocks || {}, band ?? key, out);
      leaves(f.fields || {}, band ?? key, out);
    } else if (typeof f.type === 'string') {
      out.push({ key, field: f, band: band ?? key });
    }
  }
  return out;
}

/* Frame types a person types into: their control sends the text. */
const TEXT_FIELDS = new Set(['_TextInput', '_GuiTextInput', '_SmartInput']);

/** A field bound straight to its device's control topic (no KOMAND), or null. */
export function directOf(field) {
  if (!field || typeof field.device_control !== 'string' || typeof field.topic !== 'string' || !field.topic) return null;
  if (field.komand_handler && field.komand_handler.command) return null;
  const d = { topic: field.topic, verb: field.device_control };
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

/**
 * The starting touch panel for one presented device.
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
  sheets.forEach((frame) => {
    const items = [];
    for (const { key, field, band } of leaves(frame.content, null, [])) {
      const h0 = field.komand_handler || {};
      const verb = h0.enable === false ? '' : h0.komand_type;
      const sec = SECTION[verb] ? verb : '';
      const type = sec || controlFor(field);
      const horiz = type === 'fader' && /Horizontal/.test(field.type);
      const args = sec ? (h0.args || field.args || []) : null;
      const [w, h] = horiz ? SIZE.faderH : sizeOf(type, args);
      const widget = {
        id: `w_${++n}`,
        type,
        label: fieldLabel(key, field).toUpperCase(),
        x: 0, y: 0, w, h,
        page: '',
        address: field.komand_listen_topic || (field.device_state && field.topic) || field.komand_handler?.target || '',
        channel: 1,
        bindings: [],
      };
      const direct = directOf(field);
      if (direct) widget.direct = direct;
      const behavior = sec ? { args } : behaviorOf(field, type);
      if (Object.keys(behavior).length) widget.behavior = behavior;
      if (behavior.subtitle) widget.subtitle = behavior.subtitle;
      const binding = bindingOf(field, device, doc.key || '');
      if (binding) widget.bindings.push(binding);
      // The handler exactly as the frame carries it (converter, readback, input
      // name): what the runner hands KOMAND when this control is touched.
      if (binding) widget.komand = { ...field.komand_handler };
      widgets.push(widget);
      (sec ? sections[sec] : items).push({ widget, w, h, band });
    }
    pack(items, pageName(frame.path, frame.content), W, H, pages);
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

/** What the link asked for: ?model=&family=&resource=&serial=&placement=&page= */
export function linkQuery(search) {
  const q = new URLSearchParams(search || '');
  const get = k => (q.get(k) || '').trim();
  return {
    model: get('model'), family: get('family'), resource: get('resource'),
    serial: get('serial'), protocol: get('protocol'), placement: get('placement'),
    page: get('page'),
  };
}

const LINK_KEYS = ['model', 'family', 'serial', 'resource', 'protocol', 'placement', 'page'];

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
