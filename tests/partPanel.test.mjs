// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* A BIM part's panel template, drawn with no unit (ROAD-3687): ?bim=<part>. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { presentedFromPart, panelFromPresented, partUrl, linkQuery, linkSearch } from '../js/devicePanel.js';

const field = (extra = {}) => ({ type: '_GuiButtonToggle', label: { En: 'Ch ${n} on' },
  komand_handler: { enable: true, komand_type: 'set', command: 'Set_Out', input_name: 'value' }, ...extra });

const part = {
  id: 'acme/psu3', model: 'PSU3', name: 'Acme PSU3', manufacturer: 'Acme',
  panel: {
    template: 'PSU',
    descriptor: { model: 'PSU3', channels: 3 },
    frames: {
      'PSU.json': { PSU_Instrument: { type: 'OcaBin', blocks: {
        Head: { type: 'OcaBlock', description: { En: '${model} @ ${resource}' }, fields: { Name: { type: '_GuiLabel', value_default: '${name}' } } },
        'Out_${n}': { type: 'OcaBlock', fields: { On: field() } },
      } } },
      'PSU_N.json': { 'PSU_Unit_${n}': { type: 'OcaBin', blocks: {} } },
    },
  },
};

test('a part with no panel template presents nothing', () => {
  assert.equal(presentedFromPart({ id: 'x/y', model: 'Y' }), null);
  assert.equal(presentedFromPart(null), null);
});

test("a part's template is one TEMPLATE placement of its own frames, the group frame left out, bound to no box", () => {
  const doc = presentedFromPart(part);
  assert.equal(doc.placements.length, 1);
  assert.equal(doc.placements[0].at, 'Template');
  assert.deepEqual(doc.placements[0].frames.map(f => f.path), ['PSU.json']);
  assert.deepEqual(doc.device, { model: 'PSU3', type: 'PSU', part: 'acme/psu3', serial: '', resource: '' });
  assert.ok(!('write_topic' in doc.device));
});

test('${n} blocks repeat once per declared channel, each handler told its channel; no token is left on screen', () => {
  const doc = presentedFromPart(part);
  const blocks = doc.placements[0].frames[0].content.PSU_Instrument.blocks;
  assert.deepEqual(Object.keys(blocks), ['Head', 'Out_1', 'Out_2', 'Out_3']);
  assert.equal(blocks.Out_2.fields.On.label.En, 'Ch 2 on');
  assert.deepEqual(blocks.Out_3.fields.On.komand_handler.params, { chan: '3', n: '3' });
  assert.equal(blocks.Head.description.En, 'PSU3 @ ');
  assert.equal(blocks.Head.fields.Name.value_default, 'Acme PSU3');
  assert.ok(!JSON.stringify(doc).includes('${'));
});

test('a model that declares no channel count loses its per-channel blocks', () => {
  const doc = presentedFromPart({ ...part, panel: { ...part.panel, descriptor: { model: 'PSU3' } } });
  assert.deepEqual(Object.keys(doc.placements[0].frames[0].content.PSU_Instrument.blocks), ['Head']);
});

test('the builder draws the template: a page per frame, a control per field', () => {
  const p = panelFromPresented(presentedFromPart(part));
  assert.equal(p.placement, 'Template');
  assert.equal(p.deviceId, 'acme/psu3');
  assert.equal(p.widgets.filter(w => w.label === 'CH 2 ON').length, 1);
});

test('?bim= is read and written back with the link; partUrl keeps the maker/model path', () => {
  assert.equal(linkQuery('?bim=keysight%2F34401a').bim, 'keysight/34401a');
  assert.ok(!('bim' in linkQuery('?model=X')));
  assert.equal(linkSearch({ bim: 'keysight/34401a' }), '?bim=keysight%2F34401a');
  assert.equal(partUrl('keysight/34401a'), '/api/bim/parts/keysight/34401a');
});
