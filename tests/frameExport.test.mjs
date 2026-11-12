// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  panelToFrame, frameToPanel, widgetToField, controlForFrameType,
  CONTROL_TO_FRAME, TP_KEY, GRID, frameKey,
} from '../js/frameExport.js';
import { controlFor, panelFromPresented } from '../js/devicePanel.js';
import { CONTROL_DEFINITIONS } from '../js/controls.js';

const TOPIC = 'APK.audio/System/Protocols/visa/Device/Generator/G1/DevX/Write';

const ALL = Object.keys(CONTROL_DEFINITIONS);

function samplePanel() {
  const widgets = ALL.map((type, i) => ({
    id: `w_${i + 1}`, type, label: `${type.toUpperCase()} ${i + 1}`,
    x: 12 + (i % 6) * 200, y: 12 + Math.floor(i / 6) * 260,
    w: CONTROL_DEFINITIONS[type].w, h: CONTROL_DEFINITIONS[type].h,
    page: i % 2 ? 'p2' : 'p1', address: `APK.audio/Gui/Test/${type}`, channel: 1, bindings: [],
  }));
  widgets[0].bindings.push({ id: 'Generator/G1/set/FREQ', family: 'Generator', model: 'G1', verb: 'set', command: 'FREQ', scpi: 'FREQ {}', topic: TOPIC, device: 'G1_SER1' });
  widgets[0].style = { accent: '#ff0000', cap: '#00ff00' };
  widgets[0].behavior = { min: 0, max: 10, unit: 'Hz', step: 0.5 };
  widgets[1].lookId = 'era:neve';
  return {
    id: 'tp_test', name: 'Test Panel', room: 'Studio A', width: 1280, height: 800,
    screenPreset: 'Crestron TSW-1070', theme: { preset: 'Crestron Blue', style: { text: '#ffffff' } },
    pages: [{ id: 'p1', name: 'Main' }, { id: 'p2', name: 'Monitor Mix' }],
    deviceId: '', savedLooks: [],
    widgets,
  };
}

const binOf = frame => Object.values(frame)[0];
const fieldsOf = frame => Object.values(binOf(frame).blocks).flatMap(b => Object.values(b.fields));

test('every control type has a frame type', () => {
  for (const t of ALL) assert.ok(CONTROL_TO_FRAME[t], `no frame type for ${t}`);
});

test('the export is an OcaBin, one OcaBlock per page, one field per widget', () => {
  const p = samplePanel();
  const frame = panelToFrame(p);
  const bin = binOf(frame);
  assert.equal(Object.keys(frame)[0], 'Test_Panel');
  assert.equal(bin.type, 'OcaBin');
  assert.deepEqual(Object.keys(bin.blocks), ['Main', 'Monitor_Mix']);
  for (const b of Object.values(bin.blocks)) {
    assert.equal(b.type, 'OcaBlock');
    assert.equal(b.layout_columns, Math.ceil(1280 / GRID));
  }
  assert.equal(fieldsOf(frame).length, p.widgets.length);
  assert.equal(Object.keys(bin.blocks.Main.fields).length, p.widgets.filter(w => w.page === 'p1').length);
});

test('fields carry label, size, grid place and bus path; no top-level x/y', () => {
  const p = samplePanel();
  const f = fieldsOf(panelToFrame(p))[0];
  const w = p.widgets[0];
  assert.equal(f.type, CONTROL_TO_FRAME[w.type]);
  assert.deepEqual(f.label, { En: w.label });
  assert.equal(f.geometry.width, w.w);
  assert.equal(f.layout.height, w.h);
  assert.equal(f.layout.column, Math.floor(w.x / GRID) + 1);
  assert.equal(f.layout.row, Math.floor(w.y / GRID) + 1);
  assert.deepEqual([f.layout.position, f.layout.left, f.layout.top], ['absolute', w.x, w.y], 'true pixels for an absolute block');
  assert.equal(f.topic, w.address, 'the control\'s own address wins: a device panel binds many controls to one write topic');
  const bare = widgetToField({ ...w, address: '' }, {});
  assert.equal(bare.topic, TOPIC, 'with no address, the first binding\'s topic');
  assert.equal(f.komand_handler.command, 'FREQ');
  assert.equal(f.domain.min, 0);
  assert.equal(f.domain.units, 'Hz');
  assert.ok(!('x' in f) && !('y' in f), 'MDP reads top-level x/y as its puck');
  const mdp = widgetToField({ id: 'm', type: 'mdp', label: 'M', x: 500, y: 300, w: 180, h: 180, bindings: [] }, {});
  assert.deepEqual([mdp.x, mdp.y], [90, 90], 'an MDP puck is centred in its own box, not at the panel x/y');
  const unbound = fieldsOf(panelToFrame(p)).find(x => x[TP_KEY].widget.id === 'w_2');
  assert.equal(unbound.topic, p.widgets[1].address, 'no binding -> address');
});

test('colours land in the keys each widget reads', () => {
  const style = { accent: '#a00', bg: '#111', border: '#222', text: '#eee', cap: '#ccc', faderCap: 'tall', capShape: 'knurled', pointer: 'Dot', radius: 4, borderWidth: 2 };
  const base = { id: 'w', label: 'X', x: 0, y: 0, w: 100, h: 100, bindings: [] };
  const knob = widgetToField({ ...base, type: 'knob' }, style);
  assert.equal(knob.cosmetics.colors.primary, '#a00');
  assert.equal(knob.cosmetics.colors.cap, '#ccc');
  assert.equal(knob.cosmetics.styling.fill_color, '#111');
  assert.equal(knob.cosmetics.visualization, 'wbs-elma', 'a stand-in cap shape becomes the engine\'s cap family');
  assert.equal(knob.cosmetics.pointer.style, 'dot');
  assert.equal(widgetToField({ ...base, type: 'knob' }, { capShape: 'moog' }).cosmetics.visualization, 'moog', 'library names pass through');
  assert.deepEqual(widgetToField({ ...base, type: 'knob' }, { capShape: 'gear' }).cosmetics.style_overrides, { shape: 'gear' });
  const fader = widgetToField({ ...base, type: 'fader', w: 70, h: 220 }, style);
  assert.equal(fader.cosmetics.colors.cap, '#ccc', 'faderCap is a shape name, never a colour');
  assert.equal(fader.cosmetics.colors.highlight, '#a00');
  assert.equal(fader.style.orientation, 'vertical');
  const button = widgetToField({ ...base, type: 'button' }, style);
  assert.equal(button.style.active.bg_color, '#a00');
  assert.equal(button.style.inactive.border_color, '#222');
  assert.equal(button.style.inactive.border_thickness, 2);
  assert.equal(button.layout.corner_radius, 4);
  const ltp = widgetToField({ ...base, type: 'ltp' }, style);
  assert.equal(ltp.knob_config.cap_outline_color, '#a00');
  assert.equal(ltp.fader_config.cosmetics.colors.highlight, '#a00');
});

test('a widget from the library exports its own field, overlaid with label, size and path', () => {
  const field = { type: '_SmartKnob', label: { En: 'Old' }, cosmetics: { visualization: 'fender', colors: { primary: '#f0f0f0' } }, geometry: { width: 130, height: 130 } };
  const f = widgetToField({ id: 'w', type: 'knob', label: 'GAIN', x: 40, y: 40, w: 90, h: 100, address: 'A/B', bindings: [], field }, { accent: '#123' });
  assert.equal(f.type, '_SmartKnob');
  assert.equal(f.cosmetics.visualization, 'fender');
  assert.equal(f.cosmetics.colors.primary, '#f0f0f0', 'library cosmetics win over the theme');
  assert.deepEqual(f.label, { En: 'GAIN' });
  assert.equal(f.geometry.width, 90);
  assert.equal(f.topic, 'A/B');
  assert.equal(field.label.En, 'Old', 'input not mutated');
});

test('export then import restores the panel exactly', () => {
  const p = samplePanel();
  p.widgets[2].field = { type: '_WinkButton', color: '#f00' };
  const frame = JSON.parse(JSON.stringify(panelToFrame(p)));
  assert.deepEqual(frameToPanel(frame), p);
});

test('the bare OcaBin (no wrapping key) imports too', () => {
  const p = samplePanel();
  assert.deepEqual(frameToPanel(binOf(panelToFrame(p))), p);
});

test('panelToFrame is pure', () => {
  const p = samplePanel();
  const before = JSON.stringify(p);
  panelToFrame(p);
  assert.equal(JSON.stringify(p), before);
});

test('duplicate labels and page names get unique keys', () => {
  const p = samplePanel();
  p.pages.push({ id: 'p3', name: 'Main' });
  p.widgets.forEach(w => { w.label = 'SAME'; });
  const bin = binOf(panelToFrame(p));
  assert.deepEqual(Object.keys(bin.blocks), ['Main', 'Monitor_Mix', 'Main_2']);
  assert.ok(Object.keys(bin.blocks.Main.fields).includes('SAME_2'));
  assert.deepEqual(frameToPanel(panelToFrame(p)), p);
});

test('a widget on an unknown page lands on the first page', () => {
  const p = samplePanel();
  p.widgets[1].page = 'gone';
  const bin = binOf(panelToFrame(p));
  assert.equal(Object.keys(bin.blocks.Main.fields).length, p.widgets.filter(w => w.page === 'p1').length + 1);
});

test('a plain library frame imports as a grid, one page per block, keeping each field', () => {
  const frame = {
    Library: {
      type: 'OcaBin',
      blocks: {
        Knobs: { type: 'OcaBlock', layout_columns: 3, fields: {
          K1: { type: '_SmartKnob', label: { En: 'Gain' }, geometry: { width: 130, height: 130 } },
          K2: { type: '_SmartKnob', label: { active: { text: { En: 'Pan' } } } },
          F1: { type: '_SmartFader', geometry: { height: 300 } },
        } },
        Meters: { type: 'OcaBlock', fields: {
          V1: { type: '_NeedleVUMeter', geometry: { width: 280, height: 200 }, topic: 'APK.audio/Gui/VU' },
          S1: { type: 'SelectorSwitch', positions: ['A', 'B'] },
          C1: { type: '_CMDP' }, L1: { type: '_CustomLTP' }, M1: { type: '_MDP' },
          B1: { type: '_WinkButton', komand_handler: { command: 'OUTP', komand_type: 'set', target: TOPIC } },
          R1: { type: '_SmartValue' },
        } },
      },
    },
  };
  const p = frameToPanel(frame);
  assert.deepEqual(p.pages.map(pg => pg.name), ['Knobs', 'Meters']);
  assert.equal(p.widgets.length, 10);
  assert.deepEqual(p.widgets.map(w => w.type),
    ['knob', 'knob', 'fader', 'vu', 'selector', 'cmdp', 'ltp', 'mdp', 'button', 'readout']);
  assert.equal(p.widgets[0].label, 'Gain');
  assert.equal(p.widgets[1].label, 'Pan');
  assert.equal(p.widgets[2].label, 'F1');
  assert.equal(p.widgets[0].w, 130);
  assert.equal(p.widgets[2].h, 300);
  assert.equal(p.widgets[3].address, 'APK.audio/Gui/VU');
  assert.equal(p.widgets[0].field.type, '_SmartKnob');
  assert.equal(p.widgets[8].bindings[0].command, 'OUTP');
  assert.equal(p.widgets[8].bindings[0].topic, TOPIC);
  assert.ok(new Set(p.widgets.map(w => w.id)).size === 10);
  // laid out, not stacked: on one page no two widgets share a corner
  const first = p.widgets.filter(w => w.page === p.pages[0].id);
  assert.ok(first[1].x > first[0].x);
  for (const w of p.widgets) assert.ok(w.x + w.w <= p.width && w.x >= 0);
  // and it goes out again carrying the library fields
  const again = fieldsOf(panelToFrame(p));
  assert.equal(again[0].type, '_SmartKnob');
});

test('frameToPanel refuses what is not a frame', () => {
  assert.equal(frameToPanel(null), null);
  assert.equal(frameToPanel({ a: 1 }), null);
});

test('field types invert devicePanel controlFor where it has an answer', () => {
  const invertible = ['knob', 'fader', 'button', 'meter', 'vu', 'selector', 'readout'];
  for (const t of invertible) assert.equal(controlFor({ type: CONTROL_TO_FRAME[t] }), t, t);
  assert.equal(controlFor({ type: '_GuiFaderHorizontal' }), 'fader');
  assert.equal(controlFor({ type: '_GuiButton' }), 'button');
  // A toggler is crosspoints only when it holds options (an array of buttons).
  const opts = { options: { 1: { value: '901' } } };
  for (const t of ALL) assert.equal(controlForFrameType(CONTROL_TO_FRAME[t], t === 'crosspoints' ? opts : null),
    ['rig', 'nab'].includes(t) ? 'readout' : t, t);
  assert.equal(controlForFrameType('_GuiButtonToggler'), 'button');
  assert.equal(controlFor({ type: '_GuiButtonToggler', ...opts }), 'crosspoints');
  assert.equal(controlFor({ type: '_GuiMatrix' }), 'matrix');
});

test('an exported frame read back by panelFromPresented keeps types and bindings', () => {
  const p = samplePanel();
  p.widgets = p.widgets.filter(w => ['knob', 'fader', 'button', 'meter', 'vu', 'selector', 'readout', 'rig'].includes(w.type));
  for (const w of p.widgets) {
    w.bindings = [{ id: `Generator/G1/${w.type === 'rig' ? 'rig' : 'set'}/C_${w.id}`, family: 'Generator', model: 'G1', verb: w.type === 'rig' ? 'rig' : 'set', command: `C_${w.id}`, scpi: '', topic: TOPIC, device: 'G1_SER1' }];
    if (w.type === 'rig') w.behavior = { args: ['freq', 'amp'] };
  }
  const frame = panelToFrame(p);
  const doc = { key: 'G1_SER1', device: { type: 'Generator', model: 'G1', write_topic: TOPIC },
    placements: [{ at: 'Instruments/x', frames: [{ path: '0_main/x.json', content: frame }] }] };
  const back = panelFromPresented(doc);
  const types = back.widgets.map(w => w.type).sort();
  assert.deepEqual(types, p.widgets.map(w => w.type).sort());
  for (const w of back.widgets) {
    const orig = p.widgets.find(o => o.bindings[0].command === w.bindings[0].command);
    assert.deepEqual(w.bindings[0], orig.bindings[0]);
  }
});

test('frameKey makes portable keys', () => {
  assert.equal(frameKey('Monitor Mix: A|B'), 'Monitor_Mix_A_B');
  assert.equal(frameKey('***', 'Page'), 'Page');
});

test('the touch_panel key is namespaced on bin and fields', () => {
  const frame = panelToFrame(samplePanel());
  assert.ok(binOf(frame)[TP_KEY].panel);
  for (const f of fieldsOf(frame)) assert.ok(f[TP_KEY].widget);
});

test('each page is an absolute canvas the size of the glass (engine layout.mode absolute)', () => {
  const p = samplePanel();
  const bin = Object.values(panelToFrame(p)).find(v => v && v.type === 'OcaBin');
  for (const block of Object.values(bin.blocks)) {
    assert.deepEqual(block.layout, { mode: 'absolute', canvas_width: p.width || 1280, canvas_height: p.height || 800 });
  }
});

test('a device frame field goes back as it came: its key, options, button height, handler and hidden carriers; no write topic promoted', () => {
  const RW = 'APK.audio/System/Protocols/visa/Device/Router/3235/Dev710/Write';
  const h = (command) => ({ enable: true, komand_type: 'set', sub_path: 'Routing', command, input_name: 'channel_list', target: RW, model: '3235' });
  const doc = { key: 'r', device: { type: 'Router', model: '3235', write_topic: RW }, placements: [{ at: 'Instruments/1_Router', frames: [
    { path: '0_Coax/0_left.json', content: { left: { type: 'OcaBin', blocks: { M: { type: 'OcaBlock', fields: {
      Matrix: { type: '_GuiMatrix', slot: 0, buses: [{ label: { En: 'B1' } }], sources: [{ label: { En: 'S1' } }], opens: 'Open_Cmd', closes: 'Close_Cmd' },
      Open_Cmd: { type: '_GuiValue', hidden: true, komand_handler: h('Open_Channels') },
      Close_Cmd: { type: '_GuiValue', hidden: true, komand_handler: h('Close_Channels') },
      Row: { type: '_GuiButtonToggler', layout: { height: 30, max_cols: 8, width: '100%' }, komand_handler: h('Close_Channels'),
        options: { 1: { value: '001', label: { En: 'One' } } } } } } } } } }] }] };
  const p = panelFromPresented(doc);
  const out = panelToFrame(p);
  const fields = Object.values(Object.values(out)[0].blocks)[0].fields;
  assert.deepEqual(Object.keys(fields).sort(), ['Close_Cmd', 'Matrix', 'Open_Cmd', 'Row']);
  assert.equal(fields.Row.type, '_GuiButtonToggler');
  assert.equal(fields.Row.options['1'].value, '001');
  assert.equal(fields.Row.layout.height, 30, 'each button keeps its own height');
  assert.equal(fields.Row.layout.max_cols, 8);
  assert.equal(fields.Row.komand_handler.command, 'Close_Channels');
  assert.equal(fields.Row.topic, undefined, 'the write topic is not the field\'s address');
  assert.equal(fields.Row.label, undefined, 'a row with no label of its own gets none');
  assert.equal(fields.Matrix.type, '_GuiMatrix');
  assert.equal(fields.Open_Cmd.hidden, true);
  assert.equal(fields.Close_Cmd.komand_handler.command, 'Close_Channels');
});
