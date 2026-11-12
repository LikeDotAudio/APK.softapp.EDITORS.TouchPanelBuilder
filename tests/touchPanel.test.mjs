// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import test from 'node:test';
import assert from 'node:assert/strict';

import { CONTROL_DEFINITIONS } from '../js/controls.js';
import { SCREEN_PRESETS, FIT_SCREEN, RESIZE_EDGES, resizeBox, fitPageSize } from '../js/touchPanelApp.js';

test('Touch Panel Screen Presets', () => {
  assert.ok(SCREEN_PRESETS.length >= 3);
  const p10 = SCREEN_PRESETS.find(p => p.id === '10in');
  assert.ok(p10);
  assert.equal(p10.w, 1280);
  assert.equal(p10.h, 800);
});

test('Touch Panel Control Definitions', () => {
  assert.ok(CONTROL_DEFINITIONS.fader);
  assert.ok(CONTROL_DEFINITIONS.knob);
  assert.ok(CONTROL_DEFINITIONS.button);
  assert.ok(CONTROL_DEFINITIONS.meter);

  const faderHtml = CONTROL_DEFINITIONS.fader.render({ label: 'MAIN', value: '-3 dB' });
  assert.ok(faderHtml.includes('MAIN'));
  assert.ok(faderHtml.includes('-3 dB'));
  assert.ok(CONTROL_DEFINITIONS.tile);
  assert.match(CONTROL_DEFINITIONS.knob.render({ label: 'MONITOR' }), /MONITOR/);
});

test('the page can grow to the screen: a fit-the-window preset, sized to the room and to what is placed', () => {
  const fit = SCREEN_PRESETS.find(p => p.id === FIT_SCREEN);
  assert.ok(fit && fit.fit);
  assert.deepEqual(fitPageSize(1500.6, 640.2, []), { width: 1500, height: 640 });
  // a smaller window scrolls: nothing placed is cut off
  assert.deepEqual(fitPageSize(600, 400, [{ x: 12, y: 312, w: 1256, h: 320 }]), { width: 1280, height: 644 });
});

test('every control resizes from four edges and four corners; the opposite edge stays put', () => {
  assert.deepEqual([...RESIZE_EDGES].sort(), ['e', 'n', 'ne', 'nw', 's', 'se', 'sw', 'w']);
  const box = { wx: 100, wy: 100, ww: 200, wh: 100 };
  assert.deepEqual(resizeBox(box, 'se', 40, 20), { x: 100, y: 100, w: 240, h: 120 });
  assert.deepEqual(resizeBox(box, 'nw', 40, 20), { x: 140, y: 120, w: 160, h: 80 });
  assert.deepEqual(resizeBox(box, 'e', -500, 0), { x: 100, y: 100, w: 16, h: 100 }, 'never under the minimum');
  assert.deepEqual(resizeBox(box, 'w', -500, 0), { x: 0, y: 100, w: 300, h: 100 }, 'never off the glass');
  assert.deepEqual(resizeBox(box, 'n', 0, 500), { x: 100, y: 184, w: 200, h: 16 });
});
