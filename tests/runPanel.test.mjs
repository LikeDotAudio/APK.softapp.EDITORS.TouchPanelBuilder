// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  controlTopic, handlerFor, fireMessages, directMessages, touchKind, clampValue, readingText, readbackTopics, readbackOf, brokerFor,
  stateTopic, matrixHandlers, pickNext, litOf,
} from '../js/runPanel.js';
import { CONTROL_DEFINITIONS } from '../js/controls.js';

const gui = (path) => `APK.audio/Gui/${path.join('/')}`;
const WRITE = 'APK.audio/System/Protocols/visa/Device/Generator/G1/DevX/Write';
const FRAME_HANDLER = { enable: true, komand_type: 'set', sub_path: 'Generator', command: 'Set_Frequency',
  input_name: 'freq', converter: 'khz_to_hz', readback: 'generator_settings', target: WRITE, model: 'G1' };

test('a control answers under Gui/TouchPanels/<panel>/<control>, made safe for MQTT', () => {
  assert.equal(controlTopic(gui, 'G1_SER1', 'w_3'), 'APK.audio/Gui/TouchPanels/G1_SER1/w_3');
  assert.equal(controlTopic(gui, '6060B 44.44/gpib7,23', 'w#1'), 'APK.audio/Gui/TouchPanels/6060B_44.44_gpib7_23/w_1');
});

test('the frame handler goes to KOMAND unchanged — converter and readback kept', () => {
  assert.deepEqual(handlerFor({ komand: FRAME_HANDLER }), FRAME_HANDLER);
  const noTarget = handlerFor({ komand: { ...FRAME_HANDLER, target: '' } }, WRITE);
  assert.equal(noTarget.target, WRITE);
});

test('an api.json control gets a console-shaped handler aimed at the box', () => {
  const h = handlerFor({ bindings: [{ verb: 'do', command: 'Do_Reset', model: 'M' }] }, WRITE);
  assert.deepEqual(h, { enable: true, komand_type: 'do', command: 'Do_Reset', model: 'M', input_name: '',
    sub_path: '', converter: '', readback: '', target: WRITE, params: {} });
  assert.equal(handlerFor({ bindings: [] }, WRITE), null);
});

test('config first, arguments next, the value last — none of it retained', () => {
  const t = 'APK.audio/Gui/TouchPanels/K/w_1';
  const msgs = fireMessages(t, FRAME_HANDLER, 1000, { freq: 1000, amp: '', none: null });
  assert.deepEqual(msgs.map(m => m.topic), [`${t}/config`, 'APK.audio/Gui/TouchPanels/K/Input/freq', t]);
  assert.deepEqual(JSON.parse(msgs[0].payload), { komand_handler: FRAME_HANDLER });
  assert.deepEqual(JSON.parse(msgs[2].payload), { value: 1000 });
  assert.equal(fireMessages(t, FRAME_HANDLER, true).length, 2);
});

test('how each control is touched', () => {
  const set = { komand: FRAME_HANDLER };
  assert.equal(touchKind({ type: 'readout' }), 'none');
  // A row of buttons fires each button's own value (a generator's presets sent
  // "FREQuency true/false" as one momentary press, 2026-11-12).
  assert.equal(touchKind({ ...set, type: 'crosspoints' }), 'pick');
  assert.equal(touchKind({ type: 'crosspoints' }), 'none', 'unbound: it only shows');
  assert.equal(touchKind({ ...set, type: 'button', behavior: { mode: 'toggle' } }), 'toggle');
  assert.equal(touchKind({ ...set, type: 'button', behavior: { mode: 'momentary' } }), 'press');
  assert.equal(touchKind({ komand: { ...FRAME_HANDLER, komand_type: 'do' }, type: 'button' }), 'press');
  assert.equal(touchKind({ ...set, type: 'knob' }), 'number');
  assert.equal(touchKind({ ...set, type: 'selector', behavior: { values: ['SIN', 'SQU'] } }), 'choose');
  assert.equal(touchKind({ ...set, type: 'button', behavior: { args: ['freq'] } }), 'args');
  assert.equal(touchKind({ komand: { ...FRAME_HANDLER, komand_type: 'get' }, type: 'readout' }), 'press');
});

test('a typed value stays inside the control range', () => {
  assert.equal(clampValue('20000', { min: 0.001, max: 10000 }), 10000);
  assert.equal(clampValue('-1', { min: 0 }), 0);
  assert.equal(clampValue('5', {}), 5);
  assert.equal(clampValue('abc', {}), null);
});

test('readings are shown short and unwrapped', () => {
  assert.equal(readingText('{"value": 1.5}', 'kHz'), '1.5 kHz');
  assert.equal(readingText('{"value": "+1.707263"}', 'V'), '+1.707263 V');
  assert.equal(readingText('+42', 'V'), '+42 V');
  assert.equal(readingText('ON'), 'ON');
  assert.equal(readingText('42', 'V'), '42 V');
  assert.equal(readingText(''), '');
  assert.ok(readingText(JSON.stringify({ a: 'x'.repeat(50) })).endsWith('…'));
});

test('readbacks are listened to; Write topics and wildcards never', () => {
  const m = readbackTopics([
    { id: 'a', address: 'APK.audio/System/Protocols/visa/Device/G/G1/D/Reading/x' },
    { id: 'b', address: 'APK.audio/System/Protocols/visa/Device/G/G1/D/Reading/x' },
    { id: 'c', address: WRITE },
    { id: 'd', address: '/dsp/master/level' },
    { id: 'e', address: 'APK.audio/#' },
  ]);
  assert.deepEqual([...m.keys()], ['APK.audio/System/Protocols/visa/Device/G/G1/D/Reading/x']);
  assert.deepEqual(m.get('APK.audio/System/Protocols/visa/Device/G/G1/D/Reading/x').map(w => w.id), ['a', 'b']);
});

test('the broker comes from config, with this page as {host}', () => {
  assert.deepEqual(brokerFor({ broker_urls: ['ws://{host}:9001'] }, 'bench.local'), ['ws://bench.local:9001']);
  assert.deepEqual(brokerFor({}, 'x'), []);
  assert.deepEqual(brokerFor({ broker_urls: ['{ws_origin}/mqtt'] }, { protocol: 'http:', hostname: 'localhost', host: 'localhost:8080' }), ['ws://localhost:8080/mqtt']);
  assert.deepEqual(brokerFor({ broker_urls: ['{ws_origin}/mqtt'] }, { protocol: 'https:', hostname: 'apk.local', host: 'apk.local' }), ['wss://apk.local/mqtt']);
});

test('a read with no readback of its own listens where KOMAND answers: <box>/Reading/<command>', () => {
  const nab = { address: WRITE, komand: { ...FRAME_HANDLER, komand_type: 'nab', command: 'Read_IDN' } };
  assert.equal(readbackOf(nab), 'APK.audio/System/Protocols/visa/Device/Generator/G1/DevX/Reading/Read_IDN');
  assert.equal(readbackOf({ address: WRITE, komand: FRAME_HANDLER }), '');   // a set has no answer to show
  const own = 'APK.audio/System/Protocols/visa/Device/Generator/G1/DevX/Reading/settings/output';
  assert.equal(readbackOf({ address: own, komand: FRAME_HANDLER }), own);
  assert.deepEqual([...readbackTopics([nab]).keys()], ['APK.audio/System/Protocols/visa/Device/Generator/G1/DevX/Reading/Read_IDN']);
});

test('a direct control (a Cast verb) is one live {value} at the device\'s own topic, no KOMAND', () => {
  const T = 'APK.audio/System/Protocols/chromecast/Device/Speaker/G/Control';
  const play = { type: 'button', behavior: { mode: 'momentary' }, direct: { topic: `${T}/Play`, verb: 'Play' }, bindings: [] };
  assert.equal(handlerFor(play), null, 'nothing taught to KOMAND');
  assert.equal(touchKind(play), 'press');
  assert.equal(touchKind({ ...play, behavior: { mode: 'toggle' } }), 'toggle');
  assert.equal(touchKind({ type: 'fader', direct: { topic: `${T}/Volume`, verb: 'Volume' } }), 'number');
  assert.equal(touchKind({ type: 'readout', direct: { topic: `${T}/Cast`, verb: 'Cast', text: true } }), 'text');
  assert.deepEqual(directMessages(play, true), [{ topic: `${T}/Play`, payload: '{"value":true}' }]);
  assert.deepEqual(directMessages({}, true), []);
  assert.equal(readbackOf({ address: 'APK.audio/System/Protocols/chromecast/Device/Speaker/G/player_state' }),
    'APK.audio/System/Protocols/chromecast/Device/Speaker/G/player_state');
});

test('rotary selector and needle VU meter rotate to match current value and domain', () => {
  const sel = {
    type: 'selector',
    label: 'MEASUREMENT',
    behavior: {
      positions: 5,
      values: ['VOLT', 'VOLT:AC', 'RES', 'FREQ', 'CONT'],
      labels: ['DC VOLTS', 'AC VOLTS', 'RESISTANCE', 'FREQUENCY', 'CONTINUITY'],
      default: 'VOLT',
    },
  };
  // Default/first position: 0 -> -135deg
  const r0 = CONTROL_DEFINITIONS.selector.render({ ...sel, value: 'VOLT' });
  assert.match(r0, /rotate\(-135deg\)/);

  // Third position (RES): index 2 -> 0deg
  const r2 = CONTROL_DEFINITIONS.selector.render({ ...sel, value: 'RES' });
  assert.match(r2, /rotate\(0deg\)/);

  // Fourth position (FREQ): index 3 -> +67.5deg
  const r3 = CONTROL_DEFINITIONS.selector.render({ ...sel, value: 'FREQUENCY' });
  assert.match(r3, /rotate\(67.5deg\)/);

  // Needle VU meter: min=0, max=10, value=0 -> -38.0deg
  const vu0 = CONTROL_DEFINITIONS.vu.render({ type: 'vu', label: 'READING', value: '0', behavior: { min: 0, max: 10 } });
  assert.match(vu0, /rotate\(-38\.0deg\)/);

  // Needle VU meter: min=0, max=10, value=5 -> 0.0deg
  const vu5 = CONTROL_DEFINITIONS.vu.render({ type: 'vu', label: 'READING', value: '5', behavior: { min: 0, max: 10 } });
  assert.match(vu5, /rotate\(0\.0deg\)/);

  // Needle VU meter: min=0, max=10, value=1.707263 -> ~ -25.0deg
  const vu17 = CONTROL_DEFINITIONS.vu.render({ type: 'vu', label: 'READING', value: '+1.707263', behavior: { min: 0, max: 10 } });
  assert.match(vu17, /rotate\(-25\.0deg\)/);

  // Radial labels engraved around selector knob
  assert.match(r0, /DC VOLTS/);
  assert.match(r0, /AC VOLTS/);
  assert.match(r0, /RESISTANCE/);
  assert.match(r0, /FREQUENCY/);
  assert.match(r0, /CONTINUITY/);
  assert.match(r0, /class="sel-pos" data-pos="0" data-v="VOLT"/);
  assert.match(r0, /class="sel-pos" data-pos="3" data-v="FREQ"/);

  // Needle VU meter: 10X scale, engineering notation mantissa and multiplier
  const vuEng = CONTROL_DEFINITIONS.vu.render({ type: 'vu', label: 'READING', value: '+1.70726380E+02', behavior: { unit: 'Hz' } });
  assert.match(vuEng, />×100<\/text>[\s\S]*>Hz<\/text>/);
  assert.match(vuEng, />0<\/text>/);
  assert.match(vuEng, />10<\/text>/);

  // Identity / IDN readback mapping
  assert.equal(readbackOf({ address: 'Reading/Read_IDN' }, 'APK.audio/System/Protocols/visa/DevttyUSB1/Write'),
    'APK.audio/System/Protocols/visa/DevttyUSB1/Reading/Read_IDN');
});

test('the IDN lands only on a control bound to it, never on a "Make · Model" by its label', async () => {
  const { idnBound } = await import('../js/runPanel.js');
  const LW = 'APK.audio/System/Protocols/visa/Device/LCR/4263A/Dev711/Write';
  assert.equal(idnBound({ label: 'MAKE · MODEL', address: '' }, LW), false);
  assert.equal(idnBound({ label: 'IDENTITY', address: 'APK.audio/System/Protocols/visa/Device/LCR/4263A/Dev711/Read' }, LW), false);
  assert.equal(idnBound({ label: 'STATUS', address: 'Reading/Read_IDN' }, LW), true);
  assert.equal(idnBound({ label: 'READ IDN', komand: { komand_type: 'nab', command: 'Read_IDN', target: LW } }, LW), true);
});

// ------------------------------------------------------------- the application's state of an array of buttons

test('a crosspoint row lights what was last commanded: radio by default, multi toggles', () => {
  assert.deepEqual(pickNext('crosspoints', [], '801'), { lit: ['801'], open: [], close: ['801'] });
  assert.deepEqual(pickNext('crosspoints', ['801'], '802'), { lit: ['802'], open: [], close: ['802'] });
  assert.deepEqual(pickNext('crosspoints', ['801'], '802', { multi: true }).lit, ['801', '802']);
  assert.deepEqual(pickNext('crosspoints', ['801', '802'], '801', { multi: true }), { lit: ['802'], open: [], close: [] });
});

test('a matrix is break-before-make per bus: another source on the bus opens first; the lit one opens', () => {
  assert.deepEqual(pickNext('matrix', [], '011'), { lit: ['011'], open: [], close: ['011'] });
  assert.deepEqual(pickNext('matrix', ['011', '022'], '013'), { lit: ['013', '022'], open: ['011'], close: ['013'] }, 'bus 1 only');
  assert.deepEqual(pickNext('matrix', ['013', '022'], '013'), { lit: ['022'], open: ['013'], close: [] });
  assert.deepEqual(pickNext('matrix', ['111'], '112'), { lit: ['112'], open: ['111'], close: ['112'] }, 'slot 1 counts its own buses');
});

test('the state is kept beside the control, and read back from either shape', () => {
  assert.equal(stateTopic(gui, '3235_x', 'w_9'), 'APK.audio/Gui/TouchPanels/3235_x/w_9/State');
  assert.deepEqual(litOf('{"value":["802","801"]}'), ['801', '802']);
  assert.deepEqual(litOf('011,022'), ['011', '022']);
  assert.deepEqual(litOf(''), []);
});

test('a matrix fires its own carried Open_Cmd / Close_Cmd, at the box', () => {
  const w = { type: 'matrix', field: { opens: 'Open_Cmd', closes: 'Close_Cmd' }, frame: { carried: {
    Open_Cmd: { komand_handler: { enable: true, komand_type: 'set', command: 'Open_Channels' } },
    Close_Cmd: { komand_handler: { enable: true, komand_type: 'set', command: 'Close_Channels' } } } } };
  const h = matrixHandlers(w, WRITE);
  assert.equal(h.open.command, 'Open_Channels');
  assert.equal(h.close.command, 'Close_Channels');
  assert.equal(h.close.target, WRITE);
  assert.equal(touchKind({ ...w, komand: { command: 'Open_Channels', komand_type: 'set' } }), 'pick');
});
