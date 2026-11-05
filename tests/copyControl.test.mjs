// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import test from 'node:test';
import assert from 'node:assert/strict';

import { cloneControl, isHold, HOLD_MS } from '../js/copyControl.js';

const MUTE = {
  id: 'w3', type: 'button', label: 'SYSTEM MUTE', x: 1260, y: 50, w: 120, h: 60, page: 'p2',
  address: '/dsp/master/mute', channel: 1, style: { buttonShape: 'lit', accent: '#f00' },
  behavior: { mode: 'toggle' }, lookId: 'vintage/x',
  bindings: [{ id: 'DMM/34401A/do/Clear_Status', topic: 'APK.audio/Gui/Komands/DMM/Clear_Status', device: 'p/Dev0' }],
};

test('a held control copies with its ins, outs, look and page; only id and place are new', () => {
  const c = cloneControl(MUTE, { id: 'w9' });
  assert.equal(c.id, 'w9');
  assert.deepEqual([c.x, c.y], [1280, 70]);
  for (const k of ['type', 'label', 'w', 'h', 'page', 'address', 'channel', 'style', 'behavior', 'lookId', 'bindings']) {
    assert.deepEqual(c[k], MUTE[k], k);
  }
  c.bindings[0].topic = 'changed';
  c.style.accent = '#0f0';
  assert.equal(MUTE.bindings[0].topic, 'APK.audio/Gui/Komands/DMM/Clear_Status', 'the copy is deep');
  assert.equal(MUTE.style.accent, '#f00');
});

test('the copy stays on the glass', () => {
  const c = cloneControl(MUTE, { id: 'w9', bounds: { width: 1280, height: 800 } });
  assert.equal(c.x, 1280 - 120);
});

test('a hold is long and still', () => {
  assert.ok(isHold(HOLD_MS, 0, 0));
  assert.ok(isHold(HOLD_MS + 50, 2, 3));
  assert.ok(!isHold(HOLD_MS - 1, 0, 0));
  assert.ok(!isHold(HOLD_MS * 2, 10, 0));
});
