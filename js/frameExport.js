// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* frameExport.js — A TOUCH PANEL IS A FRAME THE OS CAN RUN (ROAD-3499 step 4).

   panelToFrame(panel) turns a designed panel into a Gui_Frames document:
       { "<Panel_Name>": { type: "OcaBin", blocks: { "<Page>": { type: "OcaBlock",
           layout_columns, fields: { "<Field>": { type, label, geometry, layout,
           cosmetics, topic, komand_handler, touch_panel } } } } } }
   one OcaBlock per page, one field per control. frameToPanel(frame) is the way
   back: an exported frame restores the panel exactly (its own data rides on
   every field and on the bin under `touch_panel`), and a plain library frame
   becomes a panel with its fields laid out in a grid.

   WHAT THE ENGINE READS (frameLayout/, WEB.Frontend-Assets):
   - the bus path of a leaf is `node.topic`, else `<path_prefix>/<field key>`
     (FieldComponent.jsx OaFieldBody). So the field carries `topic`.
   - sizes are `geometry.width/height` and `layout.width/height`;
   - placement: an OcaBlock with `layout.mode: "absolute"` is a fixed canvas
     (canvas_width × canvas_height) and a field with `layout.position:
     "absolute"` sits at `layout.left / top` (OcaBlock.jsx, WidgetFactory.jsx,
     since ROAD-3499). Both are written, so the glass lands pixel for pixel; the
     grid place (`layout.column / row`, GRID px) is written too, for an engine
     older than that, and the exact panel stays in `touch_panel`.
   - `x` / `y` at a field's top level are NOT free: the MDP reads config.x /
     config.y as its puck centre in its own canvas. The panel's x/y live only
     in touch_panel; an MDP field gets x/y = the centre of its own box.
   - `style` at a field's top level is the button's active/inactive schema and
     the fader's orientation, so the panel's own style lives in touch_panel too.

   The type table is the inverse of devicePanel.js controlFor() wherever that
   has an entry, so a panel exported and read back by panelFromPresented() is
   the same control. Pure: no DOM, no bus. */

import { STYLE_PRESETS, CONTROL_DEFINITIONS } from './controls.js';

/** Grid unit (glass px) the frame's grid is cut into. */
export const GRID = 20;

/** The namespaced key the panel's own data rides under. */
export const TP_KEY = 'touch_panel';

/* Panel control -> Gui_Frames field type. Wire constants of the frame format.
   devicePanel's FRAME_TO_CONTROL maps each of these back to the same control
   (rig / nab come back through its section rule); readout is anything it does
   not know. */
// The panel's stand-in cap shapes -> the engine's cap families. Library names
// (1176, moog, api, british, chicken, marconi, pedal, wbs-elma, crafty, fender)
// pass through as they are.
export const CAP_FAMILY = {
  skirt: 'british', flange: '1176', knurled: 'wbs-elma', concentric: 'api', bakelite: 'marconi', circle: 'standard',
};

export const CONTROL_TO_FRAME = {
  knob: '_GuiKnob',
  fader: '_GuiFader',
  button: '_GuiButtonToggle',
  meter: '_GuiMeter',
  vu: '_NeedleVUMeter', // the engine draws a needle only for a *Needle* type (FieldComponent.jsx)
  selector: 'SelectorSwitch',
  readout: '_SmartValue',
  ltp: '_CustomLTP',
  mdp: '_MDP',
  cmdp: '_CMDP',
  tile: '_HighVisButton',
  rig: '_SmartValue',
  nab: '_SmartValue',
  trace: '_DynamicGraph',   // the engine's graph kind (frameLayout/widgetDispatch.js) — a monitoring box's trace
};
const FADER_H = '_GuiFaderHorizontal';
const BUTTON_MOMENTARY = '_GuiButton';

/* Frame field type -> panel control, for frames that carry no touch_panel data.
   Exact names first (the same answers as devicePanel controlFor), then the
   keyword families of the engine's dispatch table. */
const FRAME_TO_CONTROL = {
  _GuiKnob: 'knob', _Horizontal_with_dial_Value: 'knob',
  _GuiFader: 'fader', _GuiFaderVertical: 'fader', _GuiFaderHorizontal: 'fader',
  _GuiButtonToggle: 'button', _GuiButtonToggler: 'button', _GuiButton: 'button',
  _TrapezoidButton: 'button', _GuiActuator: 'button',
  SelectorSwitch: 'selector', _SelectorSwitch: 'selector',
  _GuiMeter: 'meter', _Meter: 'meter', _VuMeter: 'vu',
  _HighVisButton: 'tile',
  _DynamicGraph: 'trace', DynamicGraph: 'trace',
};
const KEYWORDS = [
  ['ltp', 'ltp'], ['cmdp', 'cmdp'], ['mdp', 'mdp'], ['needle', 'vu'], ['vu', 'vu'],
  ['meter', 'meter'], ['bargraph', 'meter'], ['fader', 'fader'], ['knob', 'knob'],
  ['selector', 'selector'], ['button', 'button'], ['toggle', 'button'],
  ['actuator', 'button'], ['checkbox', 'button'],
];
const CONTAINERS = new Set(['OcaBin', 'OcaBlock', 'OcaArray', 'OcaCollapsibleBlock']);

/** The panel control that plays a frame field's part. */
export function controlForFrameType(type) {
  const t = String(type || '');
  if (FRAME_TO_CONTROL[t]) return FRAME_TO_CONTROL[t];
  const lower = t.toLowerCase();
  for (const [k, c] of KEYWORDS) if (lower.includes(k)) return c;
  return 'readout';
}

const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const num = v => (v === '' || v == null || Number.isNaN(Number(v)) ? undefined : Number(v));
const set = (o, k, v) => { if (v !== undefined && v !== null && v !== '') o[k] = v; };

/** A key that is safe as a frame key and as an MQTT topic level. */
export function frameKey(name, fallback = 'Item') {
  const k = String(name || '').trim().replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return k || fallback;
}

function unique(key, used) {
  let k = key; let n = 2;
  while (used.has(k)) k = `${key}_${n++}`;
  used.add(k);
  return k;
}

function defaultStyleOf(panel) {
  const theme = panel.theme || {};
  const base = theme.base || STYLE_PRESETS[theme.preset] || {};
  return w => ({ ...base, ...(theme.style || {}), ...(w.style || {}) });
}

const px = v => (typeof v === 'number' ? v : num(String(v || '').replace(/px$/, '')));

/* The colours a widget type actually reads, from the effective panel style. */
function cosmeticsFor(type, s) {
  const colors = {};
  const out = {};
  switch (type) {
    case 'knob':
    case 'selector':
      set(colors, 'primary', s.accent);
      set(colors, 'active', s.accent);
      set(colors, 'secondary', s.border);
      set(colors, 'text', s.text);
      set(colors, 'tick', s.text);
      set(colors, 'cap', s.cap);
      if (s.bg) out.styling = { fill_color: s.bg };
      // The engine's own caps (libControl/Knobs/Knob resolveCap): a cap family
      // by name, gear / octagon as a shape over the standard cap.
      if (s.capShape) {
        const shape = String(s.capShape).toLowerCase();
        if (shape === 'gear' || shape === 'octagon') out.style_overrides = { shape };
        else out.visualization = CAP_FAMILY[shape] || shape;
      }
      if (s.pointer) out.pointer = { style: String(s.pointer).toLowerCase() };
      break;
    case 'fader':
      set(colors, 'cap', s.cap);
      set(colors, 'highlight', s.accent);
      set(colors, 'primary', s.bg);
      set(colors, 'tick_color', s.text);
      break;
    case 'meter':
      set(colors, 'lower', s.accent);
      set(colors, 'tick', s.text);
      set(colors, 'scale', s.text);
      break;
    case 'vu':
      set(colors, 'pointer', s.pointer || s.accent);
      set(colors, 'faceplate', s.bg);
      set(colors, 'bezel', s.border);
      set(colors, 'tick', s.text);
      set(colors, 'lower', s.accent);
      break;
    default:
      set(colors, 'primary', s.accent);
      set(colors, 'text', s.text);
      set(colors, 'secondary', s.border);
  }
  if (Object.keys(colors).length) out.colors = colors;
  return out;
}

/* The button's own active / inactive schema (ButtonToggle.jsx reads config.style). */
function buttonStyle(s) {
  const bw = px(s.borderWidth);
  const fs = px(s.fontSize);
  const active = {}; const inactive = {};
  set(active, 'bg_color', s.accent); set(active, 'border_color', s.accent);
  set(active, 'text_color', s.bg); set(active, 'border_thickness', bw); set(active, 'font_size', fs);
  set(inactive, 'bg_color', s.bg); set(inactive, 'border_color', s.border);
  set(inactive, 'text_color', s.text); set(inactive, 'border_thickness', bw); set(inactive, 'font_size', fs);
  if (s.fontWeight === 'bold' || Number(s.fontWeight) >= 600) active.font_style = inactive.font_style = 'bold';
  return { active, inactive };
}

/* domain / value / interaction from the widget's behaviour (the inverse of devicePanel behaviorOf). */
function behaviorKeys(field, b) {
  if (!isObj(b)) return;
  const domain = {};
  set(domain, 'min', num(b.min)); set(domain, 'max', num(b.max)); set(domain, 'units', b.unit);
  if (Object.keys(domain).length) field.domain = { ...(field.domain || {}), ...domain };
  set(field, 'step', num(b.step));
  if (b.default !== undefined && b.default !== '') field.value = { ...(field.value || {}), default_value: b.default };
  if (b.feedback) field.komand_listen_topic = b.feedback;
  if (b.mode === 'display only') field.interaction = { ...(field.interaction || {}), is_read_only: true };
}

/* The KOMAND handler a bound control carries (the inverse of devicePanel bindingOf). */
function handlerOf(w, b) {
  if (isObj(w.komand)) return clone(w.komand);
  if (!b || !b.command) return null;
  const h = { enable: true, command: b.command, komand_type: b.verb || 'set' };
  set(h, 'model', b.model); set(h, 'sub_path', b.family); set(h, 'target', b.topic);
  if ((w.type === 'rig' || w.type === 'nab') && Array.isArray(w.behavior?.args)) h.args = clone(w.behavior.args);
  return h;
}

function gridPlace(w) {
  return {
    column: Math.max(0, Math.floor((num(w.x) || 0) / GRID)) + 1,
    row: Math.max(0, Math.floor((num(w.y) || 0) / GRID)) + 1,
    col_span: Math.max(1, Math.round((num(w.w) || GRID) / GRID)),
    row_span: Math.max(1, Math.round((num(w.h) || GRID) / GRID)),
  };
}

/** One panel widget -> one frame field. */
export function widgetToField(w, style = {}, index = 0) {
  const type = w.type;
  const wpx = Math.round(num(w.w) || CONTROL_DEFINITIONS[type]?.w || 100);
  const hpx = Math.round(num(w.h) || CONTROL_DEFINITIONS[type]?.h || 100);
  const lib = isObj(w.field) ? clone(w.field) : null;
  let ftype = CONTROL_TO_FRAME[type] || CONTROL_TO_FRAME.readout;
  if (type === 'fader' && (w.behavior?.orientation === 'horizontal' || wpx > hpx * 1.5)) ftype = FADER_H;
  if (type === 'button' && w.behavior?.mode === 'momentary') ftype = BUTTON_MOMENTARY;

  const field = lib || { type: ftype };
  delete field[TP_KEY];
  if (!lib) {
    const cos = cosmeticsFor(type, style);
    if (Object.keys(cos).length) field.cosmetics = cos;
    behaviorKeys(field, w.behavior);
    if (type === 'button' || type === 'tile') {
      field.style = buttonStyle(style);
      field.latching = w.behavior?.mode !== 'momentary';
    }
    if (type === 'fader') field.style = { orientation: ftype === FADER_H ? 'horizontal' : 'vertical' };
    if (type === 'ltp') {
      field.fader_config = { cosmetics: { colors: {} } };
      set(field.fader_config.cosmetics.colors, 'highlight', style.accent);
      field.knob_config = {};
      set(field.knob_config, 'cap_color', style.cap || style.faderCap);
      set(field.knob_config, 'cap_outline_color', style.accent);
    }
    if (type === 'mdp') {
      // The MDP's own x / y are its puck centre inside its canvas (not the
      // panel position): centre it in the control's box.
      field.ltp = {}; set(field.ltp, 'cap_color', style.accent);
      field.x = Math.round(wpx / 2); field.y = Math.round(hpx / 2);
      field.trackLen = Math.round(Math.min(wpx, hpx) * 0.7);
    }
    if (type === 'cmdp') { field.channels = []; field.group_configs = []; }
    if (type === 'selector') {
      const b = w.behavior || {};
      const n = Math.max(2, Math.min(12, parseInt(b.positions, 10) || (b.values || []).length || 6));
      field.positions = Array.isArray(b.values) && b.values.length ? b.values.map(String)
        : Array.from({ length: n }, (_, i) => String(i + 1));
      if (Array.isArray(b.labels)) field.position_labels = b.labels.map(String);
      set(field, 'indicator_color', style.accent);
    }
    if (type === 'readout' || type === 'rig' || type === 'nab') {
      field.geometry = { colour: style.accent };
      if (type !== 'readout') field.interaction = { is_read_only: true };
    }
    if (num(style.opacity) !== undefined && num(style.opacity) < 1) {
      field.cosmetics = { ...(field.cosmetics || {}), bg_opacity: num(style.opacity) };
    }
  }

  // What the panel owns overlays the library element: label, size, place, path.
  field.label = { En: String(w.label ?? '') };
  field.geometry = { ...(isObj(field.geometry) ? field.geometry : {}), width: wpx, height: hpx };
  if (type === 'meter' && !lib) field.geometry.orientation = wpx > hpx ? 'horiz' : 'vert';
  field.layout = {
    ...(isObj(field.layout) ? field.layout : {}), width: wpx, height: hpx, ...gridPlace(w),
    position: 'absolute', left: Math.max(0, Math.round(num(w.x) || 0)), top: Math.max(0, Math.round(num(w.y) || 0)),
  };
  if (type === 'button' || type === 'tile') field.layout.corner_radius = px(style.radius) ?? 6;

  const b = (w.bindings || [])[0];
  // The control's own address first: a device panel binds many controls to one
  // write topic, and the engine keys a field's state on its topic.
  const topic = w.address || (b && b.topic) || '';
  if (topic) field.topic = topic; else delete field.topic;
  const h = handlerOf(w, b);
  if (h) field.komand_handler = h;

  field[TP_KEY] = { index, widget: clone(w) };
  return field;
}

/**
 * The panel as a Gui_Frames OcaBin document.
 * effectiveStyleFn(widget) -> the widget's effective style (theme base + theme
 * style + widget style); defaults to the same rule touchPanelApp uses.
 */
export function panelToFrame(panel, effectiveStyleFn) {
  const p = panel || {};
  const styleOf = typeof effectiveStyleFn === 'function' ? effectiveStyleFn : defaultStyleOf(p);
  const W = num(p.width) || 1280;
  const H = num(p.height) || 800;
  const pages = Array.isArray(p.pages) && p.pages.length ? p.pages : [{ id: '', name: 'Main' }];
  const widgets = Array.isArray(p.widgets) ? p.widgets : [];
  const known = new Set(pages.map(pg => pg.id));
  const firstId = pages[0].id;

  const blockKeys = new Set();
  const blocks = {};
  const byPage = new Map();
  for (const pg of pages) {
    const key = unique(frameKey(pg.name, 'Page'), blockKeys);
    const block = {
      type: 'OcaBlock',
      description: { En: String(pg.name || key) },
      layout_columns: Math.max(1, Math.ceil(W / GRID)),
      layout: { mode: 'absolute', canvas_width: W, canvas_height: H },
      fields: {},
    };
    blocks[key] = block;
    byPage.set(pg.id, { block, used: new Set() });
  }
  widgets.forEach((w, i) => {
    const pid = known.has(w.page) ? w.page : firstId;
    const slot = byPage.get(pid);
    const key = unique(frameKey(w.label || w.type, frameKey(w.id, 'Field')), slot.used);
    slot.block.fields[key] = widgetToField(w, styleOf(w) || {}, i);
  });

  const meta = clone({ ...p });
  delete meta.widgets;
  const bin = {
    type: 'OcaBin',
    description: { En: String(p.name || 'Touch Panel') },
    geometry: { width: W, height: num(p.height) || 800, anchor: 'NSEW' },
    behavior: { overflow_ns: 'auto', overflow_ew: 'auto' },
    blocks,
    [TP_KEY]: { version: 1, panel: meta },
  };
  return { [frameKey(p.name, 'Touch_Panel')]: bin };
}

/* ------------------------------------------------------------------ import */

function labelText(l, key) {
  if (l == null) return String(key || '');
  if (typeof l === 'string' || typeof l === 'number') return String(l);
  if (isObj(l)) {
    if ('active' in l) return labelText(l.active, key);
    if ('text' in l) return labelText(l.text, key);
    return labelText(l.En ?? Object.values(l).find(v => typeof v === 'string'), key);
  }
  return String(key || '');
}

/* The bin of a frame document: a bare node, or the first node of a map. */
function binOf(frame) {
  if (!isObj(frame)) return null;
  if (typeof frame.type === 'string') return { name: frame.description?.En || frame.id || 'Panel', bin: frame };
  for (const [k, v] of Object.entries(frame)) if (isObj(v) && typeof v.type === 'string') return { name: k, bin: v };
  return null;
}

/* Every leaf below a node, with the top-level block it sits in. */
function leaves(node, out, block) {
  for (const src of [node.blocks, node.fields]) {
    if (!isObj(src)) continue;
    for (const [k, v] of Object.entries(src)) {
      if (!isObj(v)) continue;
      if (CONTAINERS.has(v.type) || (!v.type && (isObj(v.fields) || isObj(v.blocks)))) leaves(v, out, block ?? k);
      else if (typeof v.type === 'string') out.push({ key: k, field: v, block: block ?? 'Main' });
    }
  }
  return out;
}

const MARGIN = 12;
const GAP = 8;

/* Lay plain fields out left to right, wrapping at the glass width. */
function flow(items, W) {
  let x = MARGIN; let y = MARGIN; let rowH = 0;
  for (const it of items) {
    if (x + it.w > W - MARGIN && x > MARGIN) { x = MARGIN; y += rowH + GAP; rowH = 0; }
    it.widget.x = x; it.widget.y = y;
    x += it.w + GAP; rowH = Math.max(rowH, it.h);
  }
}

function plainWidget(key, field, id, pageId) {
  const type = controlForFrameType(field.type);
  const def = CONTROL_DEFINITIONS[type] || { w: 100, h: 100 };
  const dim = k => px(field.geometry?.[k]) ?? px(field.layout?.[k]) ?? px(field[k]);
  const w = Math.round(dim('width') || def.w);
  const h = Math.round(dim('height') || def.h);
  const widget = {
    id, type, label: labelText(field.label, key), x: 0, y: 0, w, h,
    page: pageId, address: field.topic || field.komand_listen_topic || '', channel: 1, bindings: [],
  };
  const fc = clone(field);
  delete fc[TP_KEY];
  widget.field = fc;
  const kh = field.komand_handler;
  if (isObj(kh) && kh.enable !== false && kh.command) {
    widget.bindings.push({
      id: `${kh.sub_path || ''}/${kh.model || ''}/${kh.komand_type || 'set'}/${kh.command}`,
      family: kh.sub_path || '', model: kh.model || '', verb: kh.komand_type || 'set',
      command: kh.command, scpi: '', topic: kh.target || '', device: '',
    });
    widget.komand = clone(kh);
  }
  return { widget, w, h };
}

/**
 * A frame document -> a touch panel. A frame this module exported restores the
 * panel exactly; any other frame becomes one page per top-level block, its
 * fields laid out in a grid, each keeping its whole config as `field`.
 */
export function frameToPanel(frame) {
  const found = binOf(frame);
  if (!found) return null;
  const { name, bin } = found;
  const tp = isObj(bin[TP_KEY]) ? bin[TP_KEY] : null;
  const meta = tp && isObj(tp.panel) ? clone(tp.panel) : {};
  const W = num(meta.width) || num(bin.geometry?.width) || 1280;
  const H = num(meta.height) || num(bin.geometry?.height) || 800;
  const panel = tp ? { ...meta, widgets: [] } : {
    id: `tp_${frameKey(name, 'panel').toLowerCase()}`,
    name: String(name).replace(/_/g, ' '),
    room: '', width: W, height: H, screenPreset: '',
    theme: { preset: 'Deep Horizon', style: {} },
    pages: [],
    widgets: [],
  };
  if (!Array.isArray(panel.pages)) panel.pages = [];

  const all = leaves(bin, [], null);
  const restored = [];
  const plainByBlock = new Map();
  for (const it of all) {
    const own = it.field[TP_KEY];
    if (isObj(own) && isObj(own.widget)) restored.push({ index: num(own.index) ?? 1e9, widget: clone(own.widget) });
    else {
      if (!plainByBlock.has(it.block)) plainByBlock.set(it.block, []);
      plainByBlock.get(it.block).push(it);
    }
  }
  restored.sort((a, b) => a.index - b.index);
  panel.widgets = restored.map(r => r.widget);

  if (plainByBlock.size) {
    const blockName = k => labelText(bin.blocks?.[k]?.description, k).replace(/_/g, ' ');
    const ids = new Set(panel.widgets.map(w => w.id));
    let n = 0;
    const nextId = () => { let id; do id = `w_${++n}`; while (ids.has(id)); ids.add(id); return id; };
    for (const [block, items] of plainByBlock) {
      const nm = blockName(block);
      let page = panel.pages.find(pg => pg.name === nm);
      if (!page) {
        let id = `p${panel.pages.length + 1}`;
        while (panel.pages.some(pg => pg.id === id)) id = `${id}_`;
        page = { id, name: nm };
        panel.pages.push(page);
      }
      const made = items.map(it => plainWidget(it.key, it.field, nextId(), page.id));
      flow(made, W);
      for (const m of made) panel.widgets.push(m.widget);
    }
  }
  if (!panel.pages.length) panel.pages.push({ id: 'p1', name: 'Main' });
  return panel;
}
