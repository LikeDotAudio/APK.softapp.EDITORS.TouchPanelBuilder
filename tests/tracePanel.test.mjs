// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import test from 'node:test';
import assert from 'node:assert/strict';

import { rolesFor, isMonitoring, deviceKeyOf, seriesOf, toBytes, tracesFromRig, withTracePage } from '../js/tracePanel.js';
import { CONTROL_DEFINITIONS } from '../js/controls.js';

const FAMILIES = { families: { Oscilloscope: { roles: ['inputs', 'metering', 'monitoring'] }, DMM: { roles: ['inputs', 'metering'] } } };
const WRITE = 'APK.audio/System/Protocols/visa/Device/Oscilloscope/54641D/Dev716/Write';
const RIG = 'APK.audio/System/Captures/Rig/visa-Oscilloscope-54641D-Dev716';

test('a family is monitoring when its thing.json says so — the DMM is not', () => {
  assert.ok(isMonitoring(rolesFor(FAMILIES, 'Oscilloscope')));
  assert.ok(!isMonitoring(rolesFor(FAMILIES, 'DMM')));
  assert.deepEqual(rolesFor(FAMILIES, 'Nope'), []);
  assert.deepEqual(rolesFor(null, 'DMM'), []);
});

test('the box Write topic names the capture recorder device', () => {
  assert.equal(deviceKeyOf(WRITE), 'visa/Oscilloscope/54641D/Dev716');
  assert.equal(deviceKeyOf('APK.audio/Gui/x'), '');
});

test('a readback is a series when it carries many numbers; one value stays a readout', () => {
  const many = Array.from({ length: 20 }, (_, i) => i - 10);
  assert.deepEqual(seriesOf(JSON.stringify({ value: many })), many);
  assert.deepEqual(seriesOf(many.join(',')), many);
  assert.equal(seriesOf('{"value":"+1.204E+01"}'), null);
  assert.equal(seriesOf('1,2,3'), null);
  assert.equal(seriesOf('a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p'), null);
  assert.deepEqual(toBytes([-1, 0, 1]), [0, 128, 255]);
  assert.deepEqual(toBytes([5, 5]), [128, 128]);
});

test('a rig message gives each Trace/<source> leaf as a lane; empty leaves are not drawn', () => {
  const rig = { device: 'visa/Oscilloscope/54641D/Dev716', rig: {
    'Reading/Read_IDN': '{"value":"x"}',
    'Trace/CHAN2': JSON.stringify({ source: 'CHAN2', points: [10, 300] }),
    'Trace/CHAN1': JSON.stringify({ source: 'CHAN1', points: [1, 2, 3] }),
    'Trace/CHAN3': JSON.stringify({ source: 'CHAN3', points: [] }) } };
  assert.deepEqual(tracesFromRig(JSON.stringify(rig)), [{ source: 'CHAN1', points: [1, 2, 3] }, { source: 'CHAN2', points: [10, 255] }]);
  assert.deepEqual(tracesFromRig('nope'), []);
});

test('a monitoring panel gains one TRACE page on its rig; a meter panel does not', () => {
  const panel = { name: 'P', pages: [{ id: 'p1', name: 'MAIN' }], widgets: [{ id: 'w1', type: 'readout', page: 'p1' }] };
  const scope = withTracePage(panel, ['monitoring'], RIG);
  assert.deepEqual(scope.pages.map(p => p.name), ['MAIN', 'TRACE']);
  const t = scope.widgets.find(w => w.type === 'trace');
  assert.equal(t.rig, RIG);
  assert.equal(withTracePage(scope, ['monitoring'], RIG), scope);           // once
  assert.equal(withTracePage(panel, ['inputs', 'metering'], RIG), panel);   // a DMM: nothing to watch
  assert.equal(withTracePage(panel, ['monitoring'], ''), panel);            // no box found: no rig
  assert.equal(panel.pages.length, 1);                                       // pure
});

test('the trace control draws lanes, and says when nothing has arrived', () => {
  const svg = CONTROL_DEFINITIONS.trace.render({ label: 'TRACE', trace: [{ source: 'CHAN1', points: [0, 255] }] });
  assert.match(svg, /<polyline points="0\.0,256\.0 1000\.0,0\.0"/);
  assert.match(CONTROL_DEFINITIONS.trace.render({ label: 'TRACE' }), /no trace yet/);
});
