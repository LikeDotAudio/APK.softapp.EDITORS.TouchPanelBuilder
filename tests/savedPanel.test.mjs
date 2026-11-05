// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import test from 'node:test';
import assert from 'node:assert/strict';

import { savedIdentity, savedTopic, savedDoc, blockOf, readSaved, writeSaved, benchBus } from '../js/savedPanel.js';

const gui = (path) => `APK.audio/Gui/${path.join('/')}`;
const panel = { id: 'tp_1', name: 'G1 PANEL', width: 1280, height: 800, deviceId: 'G1_SER1',
  pages: [{ id: 'p1', name: 'MAIN' }], widgets: [{ id: 'w_1', type: 'button', label: 'OUT' }] };

test('a saved panel is filed by serial, else the presented key — never by IP', () => {
  assert.equal(savedIdentity(panel, { serial: 'SER1' }), 'SER1');
  assert.equal(savedIdentity(panel, { serial: '0' }), 'G1_SER1');       // a 6060B answers 0 for every unit
  assert.equal(savedTopic(gui, 'SER1'), 'APK.audio/Gui/TouchPanels/SER1/Saved');
  assert.equal(savedTopic(gui, '6060B 44/gpib7,23'), 'APK.audio/Gui/TouchPanels/6060B_44_gpib7_23/Saved');
  assert.equal(savedTopic(gui, ''), '');
});

test('the retained document carries the block and the link that reopens its box', () => {
  const doc = savedDoc(panel, { model: 'G1', serial: 'SER1' }, new Date('2026-11-05T02:00:00Z'));
  assert.equal(doc.kind, 'touch_panel');
  assert.equal(doc.link.serial, 'SER1');
  const back = blockOf(JSON.stringify(doc));
  assert.deepEqual(back.widgets, panel.widgets);
  assert.equal(back.saved_at, '2026-11-05T02:00:00.000Z');
  assert.equal(blockOf('{"kind":"other"}'), null);
  assert.equal(blockOf('not json'), null);
});

function fakeBus(retained = {}) {
  const published = [];
  return {
    connected: true, published,
    subscribe(topic, cb) { setTimeout(() => { if (retained[topic]) cb(topic, retained[topic]); }, 5); return () => {}; },
    publish(topic, payload, opts) { published.push({ topic, payload, opts }); },
  };
}

test('read: the saved panel when one is retained, null when none arrives', async () => {
  const t = 'APK.audio/Gui/TouchPanels/SER1/Saved';
  const bus = fakeBus({ [t]: JSON.stringify(savedDoc(panel, {})) });
  assert.equal((await readSaved(bus, t, 200)).name, 'G1 PANEL');
  assert.equal(await readSaved(fakeBus(), t, 30), null);
  assert.equal(await readSaved(null, t), null);
});

test('write: retained, and nothing without a connected bus', () => {
  const bus = fakeBus();
  assert.equal(writeSaved(bus, 'APK.audio/Gui/TouchPanels/SER1/Saved', { kind: 'touch_panel' }), true);
  assert.deepEqual(bus.published[0].opts, { qos: 1, retain: true });
  assert.equal(writeSaved({ ...bus, connected: false }, 't', {}), false);
});

test('the bus: the shell\'s inside the OS, else the configured broker with this host', async () => {
  const asked = [];
  const S = { bus: (o) => { asked.push(o); return Promise.resolve('link'); } };
  const page = { location: { hostname: 'bench.local' } };
  page.parent = page;
  await benchBus(S, { broker_urls: ['ws://{host}:9001'] }, page);
  assert.deepEqual(asked.pop(), { brokerUrl: 'ws://bench.local:9001' });
  const framed = { location: { hostname: 'x' }, parent: { OS: { brokerUrl() {} } } };
  await benchBus(S, { broker_urls: ['ws://{host}:9001'] }, framed);
  assert.equal(asked.pop(), undefined);
});
