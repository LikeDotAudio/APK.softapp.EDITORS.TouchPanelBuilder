// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// ROAD-3583: the touch panel's .ifc twin (js/touchPanelIfc.js): the panel a device in its room, its layout
// APK-native (instruments-7 / instruments-2), saved beside the .json by the vendored APKSoftapp.saveModel.
// IFC_OUT=<dir> npm test also writes the file there, for IfcOpenShell validate + the BIM oracle
// (DATABASE.server.BIM editors_census.py).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { panelBlock, panelMeta } from '../js/touchPanelHost.js';
import { touchPanelToIfc, touchPanelFromIfc, layoutHash } from '../js/touchPanelIfc.js';
import { getPsets, ifcGuid, parseStep, schemaOf } from '../vendor/apk-contracts/apk-ifc.js';
import { buildBundle, BUNDLE } from '../scripts/vendor-ifc.mjs';

const require = createRequire(import.meta.url);
const { world } = require('./host-world.cjs');

function out(name, text) {
  if (!process.env.IFC_OUT) return;
  mkdirSync(process.env.IFC_OUT, { recursive: true });
  writeFileSync(join(process.env.IFC_OUT, name), text);
}

// the builder's SCREEN_PRESETS row (js/touchPanelApp.js imports the DOM, so the test names the one it uses)
const PRESETS = [{ id: '10in', name: '10.1″ Touch Panel (1280 × 800)', w: 1280, h: 800, part: 'generic/touch-panel-10in' }];
const panel = () => ({
  id: 'tp_01', name: 'TP-STAGE-01', room: 'MAIN AUDITORIUM', screenPreset: '10in', width: 1280, height: 800,
  theme: { preset: 'Deep Horizon', style: {} }, savedLooks: [], deviceId: '00:10:7f:00:00:01',
  pages: [{ id: 'p1', name: 'Main' }, { id: 'p2', name: 'Lights' }],
  widgets: [
    { id: 'w1', type: 'fader', label: 'VOL', x: 0, y: 0, w: 70, h: 220, page: 'p1', bindings: [{ id: 'v1', verb: 'set', topic: 'Instruments/x/volume', device: 'x' }] },
    { id: 'w2', type: 'button', label: 'GO', x: 100, y: 0, w: 100, h: 60, page: 'p2', bindings: [] },
  ],
});
const file = (p = panel()) => touchPanelToIfc(panelBlock(p), { name: panelMeta(p).filename, presets: PRESETS });
const of = (f, type) => f.entities.filter((e) => e.type === type);

test('the vendored STEP codec is what contracts/src/ifc builds to today', async () => {
  const now = await buildBundle();
  if (now == null) return;
  assert.equal(readFileSync(BUNDLE, 'utf8'), now, 'run node scripts/vendor-ifc.mjs');
});

test('the panel: an IfcUnitaryControlElement CONTROLPANEL in its room, typed by its screen, layout by hash', () => {
  const text = file();
  out('touch-panel.ifc', text);
  const f = parseStep(text);
  assert.equal(schemaOf(f), 'IFC4X3_ADD2');
  const [tp] = of(f, 'IFCUNITARYCONTROLELEMENT');
  assert.equal(tp.args[8].value, 'CONTROLPANEL');
  assert.equal(tp.args[0], ifcGuid('touchpanel', 'tp_01', 'panel'));
  assert.equal(tp.args[7], 'tp_01');
  const [ty] = of(f, 'IFCUNITARYCONTROLELEMENTTYPE');
  assert.deepEqual([ty.args[2], ty.args[8], ty.args[9].value], ['10.1″ Touch Panel (1280 × 800)', '10in', 'CONTROLPANEL']);
  // the screen's BIM part types it (ROAD-3598 answer 7): GlobalId part/<id>, Tag the part id, APK_Part.PartId
  assert.deepEqual([ty.args[0], ty.args[7]], [ifcGuid('part', 'generic/touch-panel-10in'), 'generic/touch-panel-10in']);
  const [partSet] = ty.args[5].map((r) => f.byId.get(r.id));
  assert.equal(partSet.args[2], 'APK_Part');
  assert.equal(f.byId.get(partSet.args[4][0].id).args[2].value, 'generic/touch-panel-10in');
  const inSpace = of(f, 'IFCRELCONTAINEDINSPATIALSTRUCTURE').find((r) => r.args[4].some((x) => x.id === tp.id));
  assert.equal(f.byId.get(inSpace.args[5].id).type, 'IFCSPACE');
  assert.deepEqual(getPsets(f, tp).APK_TouchPanelLayout, {
    PanelId: 'tp_01', ScreenPreset: '10in', ResolutionWidth: 1280, ResolutionHeight: 800, Pages: 2, Controls: 2,
    Theme: 'Deep Horizon', LayoutHash: layoutHash(panelBlock(panel())), DeviceId: '00:10:7f:00:00:01',
  });
  const [doc] = of(f, 'IFCDOCUMENTREFERENCE');
  assert.equal(doc.args[0], 'touchpanel_tp_stage_01.json');
  assert.equal(of(f, 'IFCRELASSOCIATESDOCUMENT')[0].args[4][0].id, tp.id);
  assert.equal(of(f, 'IFCRELCONNECTSPORTS').length, 0, 'a binding is a bus variable, not a port');
  assert.doesNotMatch(text, /Instruments\/x\/volume/, 'the layout never becomes IFC');
  assert.match(text, /ELECTRICVOLTAGEUNIT.*VOLT/);
  assert.match(text, /FREQUENCYUNIT.*HERTZ/);
  assert.match(text, /ELECTRICRESISTANCEUNIT.*OHM/);
});

test('the layout hash follows the controls, not the name, the room or the key order', () => {
  const h = layoutHash(panelBlock(panel()));
  assert.match(h, /^sha1:[0-9a-f]{40}$/);
  const renamed = { ...panel(), name: 'LECTERN', room: 'FOYER' };
  assert.equal(layoutHash(panelBlock(renamed)), h);
  const reordered = panel();
  reordered.widgets[0] = Object.fromEntries(Object.entries(reordered.widgets[0]).reverse());
  assert.equal(layoutHash(panelBlock(reordered)), h);
  const moved = panel();
  moved.widgets[1].x = 120;
  assert.notEqual(layoutHash(panelBlock(moved)), h);
});

test('the same panel writes the same bytes; no address is in it; no room writes no space', () => {
  assert.equal(file(), file());
  assert.doesNotMatch(file(), /\d{1,3}(\.\d{1,3}){3}/);
  const noRoom = touchPanelToIfc(panelBlock({ ...panel(), room: '' }), { name: 'x' });
  assert.equal(of(parseStep(noRoom), 'IFCSPACE').length, 0);
});

test('read back: the panel shell and the document that holds its layout', () => {
  const r = touchPanelFromIfc(file());
  assert.deepEqual(r.block, {
    type: 'touch_panel', id: 'tp_01', name: 'TP-STAGE-01', room: 'MAIN AUDITORIUM', screenPreset: '10in', width: 1280, height: 800,
    pages: [{ id: 'p1', name: 'Main' }], deviceId: '00:10:7f:00:00:01', widgets: [],
  });
  assert.equal(r.layout, 'touchpanel_tp_stage_01.json');
  assert.equal(r.controls, 2);
  assert.equal(r.layoutHash, layoutHash(panelBlock(panel())));
  assert.throws(() => touchPanelFromIfc(file().replace(/IFCUNITARYCONTROLELEMENT\(/g, 'IFCFURNITURE(')), /no touch panel in this IFC/);
});

test('Save Model writes <name>.ifc then <name>.json; the .ifc is the panel\'s twin', async () => {
  const w = world({ framed: false });
  const p = panel();
  const meta = panelMeta(p);
  const r = await w.S.saveModel(panelBlock(p), { name: meta.filename, toIfc: (b) => touchPanelToIfc(b, { name: meta.filename, presets: PRESETS }) });
  assert.equal(r.ok, true);
  assert.deepEqual(w.downloads.map((d) => d.name), ['touchpanel_tp_stage_01.ifc', 'touchpanel_tp_stage_01.json']);
  assert.equal(JSON.parse(w.downloads.blob.text).id, 'tp_01', 'the last file written is the block .json');
});
