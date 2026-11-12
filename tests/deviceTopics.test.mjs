// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* A device frame field keeps the address its window gives it (ROAD-3697).

   Since ROAD-3725 every window keys a device frame's state by the BOX: the
   3235's 1_EDAC_1_12/0_EDAC_1_12.json is drawn with topicPath
   Devices/3235_44-44-44-222-gpib7-10/1_EDAC_1_12/0_EDAC_1_12.json (its key; it
   presents no serial), so a crosspoint row's state is retained at
   Gui/Devices/44-44-44-222-gpib7-10/EDAC_1_12/<block>/<key> (the engine strips
   the leading "3235_" as an ordering prefix) in Device
   Consoles, Instruments and every Touch Point alike (ROAD-3730). The builder's pages rename the
   blocks; the export must still put every device field — and the hidden
   carriers a matrix sends through — at that address, or the glass mirrors
   nothing and a saved panel shows nothing lit. The prefix is the contracts'
   own (Topics.gui.fromPanelPath), the engine's OaTopicMaker twin. */

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

import { panelFromPresented } from '../js/devicePanel.js';
import { panelToFrame, deviceWindowPath, deviceFieldTopic } from '../js/frameExport.js';
import { framesOf } from '../js/savedPanel.js';

const ctx = { console };
ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../vendor/apk-contracts/apk-contracts.global.js', import.meta.url), 'utf8'), ctx);
const prefixOf = (path) => ctx.APKContracts.Topics.gui.fromPanelPath(path);

const toggler = (value) => ({
  type: '_GuiButtonToggler', selection_mode: 'radio', layout: { height: 30, max_cols: 6, width: '100%' },
  options: { 1: { value, label: { En: `Ch ${value}` } } },
  komand_handler: { enable: true, komand_type: 'set', sub_path: 'Routing', command: 'Close_Channels', input_name: 'channel_list' },
});
const doc = {
  key: '3235_44-44-44-222-gpib7-10', folder: '3235_44-44-44-222-gpib7-10',
  device: { type: 'Router', model: '3235', resource: 'TCPIP::44.44.44.222::gpib7,10::INSTR' },
  placements: [{ at: 'Device_Consoles', frames: [
    { path: '1_EDAC_1_12/0_EDAC_1_12.json', content: { EDAC_1_12: { type: 'OcaBin', card: { id: 'edac-1', name: 'EDAC 1' },
      blocks: { Card_4_Snake_Interface: { type: 'OcaBlock', fields: { Bus_AB0_Left_Out: toggler('401') } } } } } },
    { path: '0_Coax/0_left.json', content: { left: { type: 'OcaBin', card: { id: 'coax-left', name: 'Coax Left' },
      blocks: { Card_000_Coax_Matrix: { type: 'OcaBlock', fields: {
        Matrix: { type: '_GuiMatrix', slot: 0, buses: [{ label: { En: 'A' } }], sources: [{ label: { En: 'X' } }], opens: 'Open_Cmd', closes: 'Close_Cmd' },
        Open_Cmd: { type: '_GuiValue', hidden: true, komand_handler: { enable: true, komand_type: 'set', command: 'Open_Channels' } },
        Close_Cmd: { type: '_GuiValue', hidden: true, komand_handler: { enable: true, komand_type: 'set', command: 'Close_Channels' } },
      } } } } } },
  ] }],
};
const panelOf = () => {
  const p = panelFromPresented(doc, { placement: 'Device_Consoles' });
  return { ...p, id: 'tp', theme: {}, sourcePlacement: p.placement, sourceFolder: doc.folder };
};
const fieldsIn = (frameDoc) => Object.values(Object.values(frameDoc)[0].blocks).flatMap(b => Object.entries(b.fields));

test('a page is drawn where the device window draws its frame', () => {
  const p = panelOf();
  assert.equal(deviceWindowPath(p, p.pages[0]), 'Devices/3235_44-44-44-222-gpib7-10/1_EDAC_1_12/0_EDAC_1_12.json');
  assert.equal(deviceWindowPath({ ...p, deviceId: '' }, p.pages[0]), '', 'no box, no device address');
  assert.equal(deviceWindowPath({ ...p, deviceId: 'MY44044028', sourcePlacement: 'Instruments/3_Scope' }, p.pages[0]),
    'Devices/MY44044028/1_EDAC_1_12/0_EDAC_1_12.json', 'the serial keys it, whichever window it came from');
  assert.equal(deviceWindowPath({ ...p, sourcePlacement: 'saved' }, p.pages[0]), '');
  assert.equal(deviceFieldTopic('P', 'A/B', 'k'), 'P/A/B/k');
  assert.equal(deviceFieldTopic('P', 'Main', 'k'), 'P/k', 'a loose field sits under the frame itself');
  assert.equal(deviceFieldTopic('P', 'left/Card', 'k', 'left'), 'P/Card/k', 'the file\'s one root bin is not a level');
});

test('a crosspoint row keeps the topic its window retains its state at', () => {
  const p = panelOf();
  const edac = { ...p, pages: [p.pages[0]], widgets: p.widgets.filter(w => w.page === p.pages[0].id) };
  const fields = Object.fromEntries(fieldsIn(panelToFrame(edac, undefined, { prefixOf })));
  assert.equal(fields.Bus_AB0_Left_Out.topic,
    'APK.audio/Gui/Devices/44-44-44-222-gpib7-10/EDAC_1_12/Card_4_Snake_Interface/Bus_AB0_Left_Out');
  const plain = Object.fromEntries(fieldsIn(panelToFrame(edac)));
  assert.equal(plain.Bus_AB0_Left_Out.topic, undefined, 'no prefixOf: exported as before');
});

test('the matrix and the hidden carriers it sends through keep their window addresses', () => {
  const p = panelOf();
  const coax = framesOf(p, { prefixOf }).find(f => f.path === '0_Coax/0_left.json');
  const fields = Object.fromEntries(fieldsIn(coax.content));
  const base = 'APK.audio/Gui/Devices/44-44-44-222-gpib7-10/Coax/Card_000_Coax_Matrix';
  assert.equal(fields.Matrix.topic, `${base}/Matrix`);
  assert.equal(fields.Open_Cmd.topic, `${base}/Open_Cmd`, 'the matrix opens through its sibling, so the sibling is where it was');
  assert.equal(fields.Close_Cmd.topic, `${base}/Close_Cmd`);
});
