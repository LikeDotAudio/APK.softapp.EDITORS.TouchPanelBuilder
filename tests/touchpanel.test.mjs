import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTROL_DEFINITIONS } from '../js/controls.js';

test('TouchPanel controls definitions exist and render HTML', () => {
  assert.ok(CONTROL_DEFINITIONS.fader, 'fader definition exists');
  assert.ok(CONTROL_DEFINITIONS.knob, 'knob definition exists');
  assert.ok(CONTROL_DEFINITIONS.button, 'button definition exists');
  assert.ok(CONTROL_DEFINITIONS.meter, 'meter definition exists');
  assert.ok(CONTROL_DEFINITIONS.tile, 'tile definition exists');

  const faderHtml = CONTROL_DEFINITIONS.fader.render({ label: 'MASTER' });
  assert.match(faderHtml, /MASTER/);

  const knobHtml = CONTROL_DEFINITIONS.knob.render({ label: 'MONITOR' });
  assert.match(knobHtml, /MONITOR/);
});
