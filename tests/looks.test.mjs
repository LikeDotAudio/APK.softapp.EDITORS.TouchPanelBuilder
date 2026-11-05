// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import test from 'node:test';
import assert from 'node:assert/strict';

import { VINTAGE_LOOKS, harvestLooks, groupLooks, widgetTypeFor } from '../js/lookLibrary.js';
import { CONTROL_DEFINITIONS, widgetStyleVars } from '../js/controls.js';

test('vintage looks cover every era shelf the theme picker promises', () => {
  const groups = [...groupLooks(VINTAGE_LOOKS).keys()];
  for (const g of ['Vintage Analog Consoles', 'Vintage Digital Consoles', 'Vintage Broadcast & Radio Consoles',
    'Vintage Synths', 'Vintage Tape Recorders']) {
    assert.ok(groups.includes(g), g);
  }
  for (const l of VINTAGE_LOOKS) {
    assert.match(l.style.bg, /^#[0-9a-f]{6}$/i, l.name);
    assert.ok(Object.keys(widgetStyleVars({ style: l.style })).length >= 5, l.name);
  }
});

test('library elements map onto the panel\'s control types', () => {
  assert.equal(widgetTypeFor('_SmartKnob'), 'knob');
  assert.equal(widgetTypeFor('_CustomLTP'), 'ltp');
  assert.equal(widgetTypeFor('_MDP'), 'mdp');
  assert.equal(widgetTypeFor('_CMDP'), 'cmdp');
  assert.equal(widgetTypeFor('_NeedleVUMeter'), 'vu');
  assert.equal(widgetTypeFor('_WinkButton'), 'button');
  assert.equal(widgetTypeFor('_SmartFader'), 'fader');
  for (const t of ['ltp', 'mdp', 'cmdp', 'vu', 'selector']) assert.ok(CONTROL_DEFINITIONS[t], t);
});

test('harvest reads colours and cap shape out of a frame tree', () => {
  const tree = { name: 'Gui_Frames', type: 'directory', children: [{
    type: 'file', path: '/5_Samples/2_Knobs/0_knobs/12_1176/1176_knobs.json',
    content: { Zoo: { type: 'OcaBin', blocks: { Normal: { type: 'OcaBlock', fields: {
      con_01: { type: '_SmartKnob', label: { En: 'Black Flange' },
        cosmetics: { visualization: '1176', colors: { primary: '#1c1c1c', cap: '#cfd2d6', tick: '#aaaaaa' } } },
      con_02: { type: '_SmartKnob', label: { En: 'Same Again' },
        cosmetics: { visualization: '1176', colors: { primary: '#1c1c1c', cap: '#cfd2d6', tick: '#aaaaaa' } } },
    } } } } },
  }, {
    type: 'file', path: '/0_discovered/x.json', content: { a: { type: '_SmartKnob', cosmetics: { colors: { primary: '#ffffff' } } } },
  }] };
  const looks = harvestLooks(tree);
  assert.equal(looks.length, 1, 'identical looks fold together; discovered devices are not looks');
  const [l] = looks;
  assert.equal(l.group, 'Library · Knobs');
  assert.equal(l.family, '1176');
  assert.equal(l.widget, 'knob');
  assert.deepEqual(l.style, { bg: '#1c1c1c', cap: '#cfd2d6', accent: '#aaaaaa', capShape: '1176' });
  assert.match(CONTROL_DEFINITIONS.knob.render({ label: 'X', style: l.style }), /0 0 0 4px/, '1176 draws a flange');
});
