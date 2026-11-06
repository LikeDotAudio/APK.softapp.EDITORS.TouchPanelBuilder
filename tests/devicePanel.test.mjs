// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  panelFromPresented, panelFromVariables, isPanelFor, placementsOf, resourceKey, directOf, fieldLabel,
  controlFor, behaviorOf, linkQuery, linkSearch, wantFor, arrivals,
} from '../js/devicePanel.js';

const W = 'APK.audio/System/Protocols/visa/Device/Generator/G1/DevX/Write';
const R = 'APK.audio/System/Protocols/visa/Device/Generator/G1/DevX/Reading/settings/';
const frame = (name, fields) => ({
  [name]: { type: 'OcaBin', blocks: { Main: { type: 'OcaBlock', fields } } },
});
const doc = {
  key: 'G1_SER1',
  device: { type: 'Generator', model: 'G1', serial: 'SER1', resource: 'TCPIP::10.0.0.9::INSTR', write_topic: W },
  placements: [
    { at: 'Device_Consoles', frames: [{ path: '0_deep/0_deep.json', content: frame('deep', {
      Extra: { type: '_GuiKnob', label: { En: 'Extra' } } }) }] },
    { at: 'Instruments/3_Generator', frames: [{ path: '0_output/0_output.json', content: frame('output', {
      Output: { type: '_TrapezoidButton', latching: true, label: { text: { En: 'Output' } },
        komand_handler: { enable: true, komand_type: 'set', sub_path: 'Generator', command: 'Set_Output_State', target: W, model: 'G1' },
        komand_listen_topic: `${R}output` },
      Frequency: { type: '_Horizontal_with_dial_Value', label: { En: 'Frequency' }, units: 'kHz',
        domain: { min: 0.001, max: 10000, units: 'kHz' }, value: { default_value: '1' },
        komand_handler: { enable: true, komand_type: 'set', command: 'Set_Frequency', target: W, model: 'G1' },
        komand_listen_topic: `${R}frequency` },
      Wave: { type: 'SelectorSwitch', positions: ['SIN', 'SQU'], position_labels: ['SINE', 'SQUARE'], label: { En: 'Waveform' } },
      Shown: { type: '_Value', label: { En: 'Shown' }, komand_listen_topic: `${R}shown` },
    }) }] },
  ],
};

test('the Instruments placement is the starting panel; the deeper ones follow', () => {
  assert.deepEqual(placementsOf(doc).map(p => p.at), ['Instruments/3_Generator', 'Device_Consoles']);
  assert.deepEqual(placementsOf(doc, 'Device_Consoles').map(p => p.at), ['Device_Consoles', 'Instruments/3_Generator']);
});

test('a presented panel becomes a touch panel that keeps its commands', () => {
  const p = panelFromPresented(doc);
  assert.equal(p.placement, 'Instruments/3_Generator');
  assert.deepEqual(p.pages, [{ id: 'p1', name: 'OUTPUT' }]);
  assert.equal(p.deviceId, 'SER1');
  const [out, freq, wave, shown] = p.widgets;
  assert.equal(out.type, 'button');
  assert.equal(out.label, 'OUTPUT');
  assert.equal(out.behavior.mode, 'toggle');
  assert.equal(out.address, `${R}output`);
  assert.deepEqual(out.bindings[0], {
    id: 'Generator/G1/set/Set_Output_State', family: 'Generator', model: 'G1', verb: 'set',
    command: 'Set_Output_State', scpi: '', topic: W, device: 'G1_SER1',
  });
  assert.equal(freq.type, 'knob');
  assert.equal(freq.behavior.min, 0.001);
  assert.equal(freq.behavior.max, 10000);
  assert.equal(freq.behavior.unit, 'kHz');
  assert.equal(wave.type, 'selector');
  assert.equal(wave.behavior.positions, 2);
  assert.equal(wave.subtitle, 'SINE · SQUARE');
  assert.equal(shown.type, 'readout');
  assert.equal(shown.behavior.mode, 'display only');
  assert.deepEqual(shown.bindings, []);
  for (const w of p.widgets) assert.equal(w.page, 'p1');
});

test('the deeper placement is one query parameter away', () => {
  const p = panelFromPresented(doc, { placement: 'Device_Consoles' });
  assert.equal(p.pages[0].name, 'DEEP');
  assert.equal(p.widgets[0].type, 'knob');
});

test('a full page runs on over a second one instead of piling up', () => {
  const many = {};
  for (let i = 0; i < 150; i++) many[`B${i}`] = { type: '_GuiButton', label: { En: `B${i}` } };
  const p = panelFromPresented({ key: 'k', device: { model: 'M' },
    placements: [{ at: 'Instruments/x', frames: [{ path: '0_many/0.json', content: frame('many', many) }] }] });
  assert.ok(p.pages.length >= 2);
  assert.equal(p.pages[1].name, 'MANY 2');
  for (const w of p.widgets) assert.ok(w.y + w.h <= 800, `${w.label} is off the glass`);
});

test('the link finds its box by serial, else by model and resource — never just the IP', () => {
  assert.ok(isPanelFor(doc, { model: 'G1', serial: 'SER1' }));
  assert.ok(!isPanelFor(doc, { model: 'G1', serial: 'OTHER' }));
  assert.ok(!isPanelFor(doc, { model: 'G2', serial: 'SER1' }));
  const twin = (res) => ({ device: { model: '6060B', serial: '0', resource: res } });
  assert.ok(isPanelFor(twin('TCPIP::h::gpib7,22::INSTR'), { model: '6060B', serial: '0', resource: 'TCPIP0::h::gpib7,22::INSTR' }));
  assert.ok(!isPanelFor(twin('TCPIP::h::gpib7,23::INSTR'), { model: '6060B', serial: '0', resource: 'TCPIP0::h::gpib7,22::INSTR' }));
  assert.equal(resourceKey('TCPIP0::10.0.0.9::5025::SOCKET'), resourceKey('TCPIP::10.0.0.9::INSTR'));
});

test('a model that presents nothing starts from its api.json variables', () => {
  const vars = [
    { id: 'DMM/M/get/Get_Volt', family: 'DMM', model: 'M', verb: 'get', command: 'Get_Volt', group: 'Measure', kind: 'none' },
    { id: 'DMM/M/set/Set_Range', family: 'DMM', model: 'M', verb: 'set', command: 'Set_Range', group: 'Measure', kind: 'numeric', unit: 'V' },
    { id: 'DMM/M/do/Do_Reset', family: 'DMM', model: 'M', verb: 'do', command: 'Do_Reset', group: 'System', kind: 'none' },
  ];
  const p = panelFromVariables(vars, { model: 'M', family: 'DMM' });
  assert.deepEqual(p.pages.map(x => x.name), ['MEASURE', 'SYSTEM']);
  assert.deepEqual(p.widgets.map(w => [w.type, w.label, w.page]),
    [['fader', 'RANGE', 'p1'], ['readout', 'VOLT', 'p1'], ['button', 'RESET', 'p2']]);
  assert.equal(p.widgets[0].bindings[0].command, 'Set_Range');
  assert.equal(panelFromVariables([], {}), null);
});

test('unknown frame widgets show as readouts; the link query is read whole', () => {
  assert.equal(controlFor({ type: '_SomethingNew' }), 'readout');
  assert.deepEqual(behaviorOf({ type: '_GuiActuator' }, 'button'), { mode: 'momentary' });
  assert.deepEqual(linkQuery('?model=33210A&family=Generator&serial=MY1&resource=TCPIP0%3A%3Ah%3A%3AINSTR'), {
    model: '33210A', family: 'Generator', resource: 'TCPIP0::h::INSTR', serial: 'MY1', protocol: '', placement: '', page: '',
  });
});

test('rig and nab go to their own RIG and NAB pages, one input row per argument', () => {
  const vars = [
    { id: 'G/M/set/Set_Freq', family: 'G', model: 'M', verb: 'set', command: 'Set_Freq', group: 'Output', kind: 'numeric' },
    { id: 'G/M/rig/Apply_Sine', family: 'G', model: 'M', verb: 'rig', command: 'Apply_Sine', group: 'APPLy',
      args: [{ name: 'freq' }, { name: 'amp' }, { name: 'offset' }] },
    { id: 'G/M/rig/Setup_Burst', family: 'G', model: 'M', verb: 'rig', command: 'Setup_Burst', group: 'Burst',
      args: [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }] },
    { id: 'G/M/nab/Nab_All', family: 'G', model: 'M', verb: 'nab', command: 'Nab_All', group: 'System',
      args: [{ name: 'x' }, { name: 'y' }] },
  ];
  const p = panelFromVariables(vars, { model: 'M', family: 'G' });
  assert.deepEqual(p.pages.map(x => x.name), ['OUTPUT', 'RIG', 'NAB']);
  const rig = p.widgets.filter(w => w.type === 'rig');
  assert.equal(rig.length, 2);
  assert.ok(rig.every(w => w.page === 'p2'));
  assert.deepEqual(rig[1].behavior.args.map(a => a.name), ['a', 'b', 'c', 'd']);
  assert.ok(rig[1].h > rig[0].h, 'four inputs stand taller than three');
  assert.equal(p.widgets.find(w => w.type === 'nab').page, 'p3');
});

test('a presented rig field leaves its frame for the RIG page', () => {
  const W2 = 'APK.audio/x/Write';
  const p = panelFromPresented({ key: 'k', device: { model: 'M' }, placements: [{ at: 'Instruments/x', frames: [
    { path: '0_out/0.json', content: frame('out', {
      A: { type: '_GuiKnob', label: { En: 'A' } },
      S: { type: '_GuiButton', label: { En: 'Apply Sine' },
        komand_handler: { enable: true, komand_type: 'rig', command: 'Apply_Sine', target: W2, model: 'M', args: ['freq', 'amp', 'offset'] } },
    }) }] }] });
  assert.deepEqual(p.pages.map(x => x.name), ['OUT', 'RIG']);
  const s = p.widgets.find(w => w.type === 'rig');
  assert.equal(s.page, 'p2');
  assert.deepEqual(s.behavior.args, ['freq', 'amp', 'offset']);
  assert.equal(s.bindings[0].verb, 'rig');
});

test('blocks share a row and a sparse page is enlarged to fill the glass', () => {
  const fields = {};
  for (let i = 0; i < 6; i++) fields[`K${i}`] = { type: '_GuiKnob', label: { En: `K${i}` } };
  const two = { A: { type: 'OcaBlock', fields: { K0: fields.K0, K1: fields.K1 } },
    B: { type: 'OcaBlock', fields: { K2: fields.K2, K3: fields.K3 } } };
  const p = panelFromPresented({ key: 'k', device: { model: 'M' }, placements: [{ at: 'Instruments/x', frames: [
    { path: '0_two/0.json', content: { two: { type: 'OcaBin', blocks: two } } }] }] });
  const ys = new Set(p.widgets.map(w => w.y));
  assert.equal(ys.size, 1, 'two small blocks sit on one row');
  assert.ok(p.widgets[0].w > 90, 'a sparse page grows its controls');
  for (const w of p.widgets) assert.ok(w.x + w.w <= 1280 && w.y + w.h <= 800);
});

test('the address bar round-trips: a panel link reopens the same box on the same page', () => {
  const want = { model: '33220A', family: 'Generator', serial: 'MY1', placement: 'Device_Consoles', page: 'MODULATION' };
  const search = linkSearch(want, '?solo=x&page=OLD');
  assert.match(search, /solo=x/);
  const back = linkQuery(search);
  for (const k of Object.keys(want)) assert.equal(back[k], want[k]);
  assert.equal(linkQuery(linkSearch({ model: 'M' }, '?serial=S')).serial, '', 'a box the panel is not for is dropped');
});

test('a device that comes online gets a tab once; its link names the box', () => {
  const bench = [
    { key: 'MY123', model: '33220A', family: 'Generator', liveness: 'online' },
    { key: 'APK.audio/x/Dev0', model: '34401A', family: 'DMM', address: 'GPIB0::22::INSTR', liveness: 'online' },
    { key: 'OLD', model: '6060B', liveness: 'offline' },
    { key: 'NOMODEL', model: '', liveness: 'online' },
  ];
  const tabs = new Map([['MY123', {}]]);
  assert.deepEqual(arrivals(bench, tabs).map(d => d.key), ['APK.audio/x/Dev0']);
  assert.equal(wantFor(bench[0]).serial, 'MY123');
  const w = wantFor(bench[1]);
  assert.equal(w.serial, '');
  assert.equal(w.resource, 'GPIB0::22::INSTR');
});

test('a network device panel (Cast, ROAD-3523): one page per bin, every control direct to its own topic', () => {
  const D = 'APK.audio/System/Protocols/chromecast/Device/Speaker/Garage_speaker';
  const bin = (blocks) => ({ type: 'OcaBin', blocks });
  const blk = (fields) => ({ type: 'OcaBlock', fields });
  const cast = { key: 'chromecast-0bb4', device: { type: 'chromecast', model: 'Google Nest Mini', serial: '0bb4', write_topic: `${D}/Control` },
    placements: [{ at: 'Instruments/Cast', frames: [{ path: 'chromecast.json', content: {
      playback: bin({ T: blk({
        play: { type: '_GuiActuator', device_control: 'Play', topic: `${D}/Control/Play`, label: { inactive: { text: { En: 'PLAY' } } } },
        mute: { type: '_GuiButtonToggle', device_control: 'Mute', topic: `${D}/Control/Mute`, latching: true },
        volume: { type: '_CustomFader', device_control: 'Volume', topic: `${D}/Control/Volume`, domain: { min: 0, max: 100 } },
        state: { type: '_Value', device_state: 'player_state', topic: `${D}/player_state`, read_only: true } }) }),
      cast: bin({ C: blk({ cast: { type: '_TextInput', device_control: 'Cast', topic: `${D}/Control/Cast`, momentary: true } }) }),
    } }] }] };
  const p = panelFromPresented(cast);
  assert.deepEqual(p.pages.map(pg => pg.name), ['PLAYBACK', 'CAST']);
  const by = (label) => p.widgets.find(w => w.label === label);
  assert.deepEqual(by('PLAY').direct, { topic: `${D}/Control/Play`, verb: 'Play' });
  assert.equal(by('PLAY').behavior.mode, 'momentary');
  assert.equal(by('MUTE').behavior.mode, 'toggle');
  assert.equal(by('VOLUME').type, 'fader');
  assert.equal(by('VOLUME').behavior.max, 100);
  assert.equal(by('STATE').address, `${D}/player_state`, 'a state leaf is the readout');
  assert.equal(by('STATE').direct, undefined);
  assert.deepEqual(by('CAST').direct, { topic: `${D}/Control/Cast`, verb: 'Cast', text: true });
});

test('a field the template bound outright to a Control/<Verb> topic is direct too (ROAD-3546); a readout or a state topic is not', () => {
  const G = 'APK.audio/System/Protocols/chromecast/Group/All/Control';
  assert.deepEqual(directOf({ type: '_CustomFader', topic: `${G}/Volume` }), { topic: `${G}/Volume`, verb: 'Volume' });
  assert.deepEqual(directOf({ type: '_GuiButtonToggle', topic: `${G}/Mute` }), { topic: `${G}/Mute`, verb: 'Mute' });
  assert.equal(directOf({ type: '_Value', topic: `${G}/Volume`, read_only: true }), null);
  assert.equal(directOf({ type: '_Value', device_state: 'model', topic: 'APK.audio/x/model' }), null);
  assert.equal(directOf({ type: '_GuiFader', topic: 'APK.audio/System/Protocols/x/Device/a/level' }), null);
  assert.equal(directOf({ type: '_GuiFader', topic: `${G}/#` }), null);
  assert.equal(directOf({ type: '_GuiFader', topic: `${G}/Volume`, komand_handler: { command: 'Set' } }), null);
});

test('a two-state label names the control by its resting face', () => {
  assert.equal(fieldLabel('group_mute', { label: { active: { text: { En: 'MUTED ALL' } }, inactive: { text: { En: 'MUTE ALL' } } } }), 'MUTE ALL');
  assert.equal(fieldLabel('k', { label: { En: 'Volume' } }), 'Volume');
  assert.equal(fieldLabel('k', {}), 'k');
});
