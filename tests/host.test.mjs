// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// The touch-panel block round trip over cad.like.audio/host@1 (ROAD-3491), with
// the app's vendored APKSoftapp client in a stub window.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { connectTouchPanelHost, panelBlock, bindPanelDevice, EDITOR, BLOCK_TYPE } from '../js/touchPanelHost.js';

const require = createRequire(import.meta.url);
const { world, hostContract } = require('./host-world.cjs');

function stubApp() {
  return {
    panel: { id: 'tp_01', name: 'TP-STAGE-01', room: 'HALL', screenPreset: '10in', width: 1280, height: 800, theme: { preset: 'Deep Horizon', style: {} }, widgets: [] },
    loads: [],
    handleBlockLoaded(block, meta) {
      this.loads.push(meta);
      Object.assign(this.panel, { id: block.id, name: block.name, widgets: block.widgets.map((w) => ({ bindings: [], ...w })) });
    },
  };
}

test('load → edit → request: the CAD gets the edited panel back, at our origin, on host@1', async () => {
  const w = world();
  const app = stubApp();
  const host = connectTouchPanelHost(w.S, app, { notice: false });
  assert.ok(host.embedded);
  assert.deepEqual(w.toParent[0], { m: { protocol: 'cad.like.audio/host@1', type: 'editorReady', editor: EDITOR, blockType: BLOCK_TYPE }, o: w.ORIGIN });

  w.fire({ protocol: w.S.PROTOCOL, type: 'load', block: { type: BLOCK_TYPE, id: 'tp_9', name: 'LECTERN', deviceId: 'SN-4', widgets: [{ id: 'w1', type: 'button', label: 'GO', x: 0, y: 0, w: 100, h: 60 }] }, meta: { blockName: 'TP_1' } });
  assert.deepEqual(app.loads, [{ blockName: 'TP_1' }]);
  assert.equal(app.panel.deviceId, 'SN-4');

  app.panel.widgets.push({ id: 'w2', type: 'fader', label: 'VOL', x: 120, y: 0, w: 70, h: 220, bindings: [] });
  bindPanelDevice(app.panel, { mac: '00:10:7f:00:00:01', ips: ['10.0.0.8'] });
  w.fire({ protocol: w.S.PROTOCOL, type: 'request' });
  const save = w.toParent.at(-1);
  assert.equal(save.o, w.ORIGIN, 'never "*"');
  assert.equal(save.m.type, 'blockSave');
  assert.equal(save.m.meta.blockName, 'TP_1');
  assert.equal(save.m.meta.title, 'LECTERN (2 Widgets)');
  assert.deepEqual(save.m.block.widgets.map((x) => x.id), ['w1', 'w2']);
  assert.equal(save.m.block.deviceId, '00:10:7f:00:00:01', 'bound by MAC, not IP');
  assert.equal(bindPanelDevice(app.panel, { ips: ['10.0.0.8'] }), false, 'an IP alone is no identity');

  const c = await hostContract();
  if (c) for (const { m } of w.toParent) assert.deepEqual(c.validateMessage(c.schema, 'toCad', m), [], m.type);
});

test('standalone, save downloads one .json named after the panel', () => {
  const w = world({ framed: false });
  const app = stubApp();
  const host = connectTouchPanelHost(w.S, app, { notice: false });
  assert.equal(host.save(panelBlock(app.panel), { filename: 'touchpanel_tp_stage_01' }), 'download');
  assert.deepEqual(w.downloads.map((d) => d.name), ['touchpanel_tp_stage_01.json']);
});
