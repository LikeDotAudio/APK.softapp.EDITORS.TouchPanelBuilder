// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  controlTopic, handlerFor, fireMessages, touchKind, clampValue, readingText, readbackTopics, readbackOf, brokerFor,
} from '../js/runPanel.js';

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
});

test('a read with no readback of its own listens where KOMAND answers: <box>/Reading/<command>', () => {
  const nab = { address: WRITE, komand: { ...FRAME_HANDLER, komand_type: 'nab', command: 'Read_IDN' } };
  assert.equal(readbackOf(nab), 'APK.audio/System/Protocols/visa/Device/Generator/G1/DevX/Reading/Read_IDN');
  assert.equal(readbackOf({ address: WRITE, komand: FRAME_HANDLER }), '');   // a set has no answer to show
  const own = 'APK.audio/System/Protocols/visa/Device/Generator/G1/DevX/Reading/settings/output';
  assert.equal(readbackOf({ address: own, komand: FRAME_HANDLER }), own);
  assert.deepEqual([...readbackTopics([nab]).keys()], ['APK.audio/System/Protocols/visa/Device/Generator/G1/DevX/Reading/Read_IDN']);
});
