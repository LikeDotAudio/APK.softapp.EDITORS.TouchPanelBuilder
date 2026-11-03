// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import test from 'node:test';
import assert from 'node:assert/strict';

import { CONTROL_DEFINITIONS } from '../js/controls.js';
import { SCREEN_PRESETS } from '../js/touchPanelApp.js';

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
});
