// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* touchPanelIfc.js — THE TOUCH PANEL'S .IFC TWIN (ROAD-3583). A TOUCH PANEL IS A DEVICE IN THE ROOM; WHAT
   IT SHOWS ON ITS GLASS STAYS APK-NATIVE (IFC-CORE-DELTAS instruments-7, as EDITORS.SurfaceDesigner's
   wall station; instruments-2: the panel's frames are carried by hash, never translated into IFC).

   Save Model writes the native touch_panel block (panelBlock) AND this IFC4X3_ADD2 file through
   APKSoftapp.saveModel. Written with the contracts STEP codec (vendor/apk-contracts/apk-ifc.js,
   scripts/vendor-ifc.mjs), no IfcOpenShell in the page. Byte-deterministic.

     IfcProject ─ IfcSite ─ IfcBuilding ─ IfcBuildingStorey ─ IfcSpace (the panel's room, when it has one)
     the hardware  IfcUnitaryControlElementType CONTROLPANEL: the screen preset's BIM PART (ROAD-3598
                   answer 7; SCREEN_PRESETS[i].part, DATABASE.server.BIM generic/touch-panel-10in ...),
                   GlobalId part/<id> as the library's own .ifc twin gives it, Name = the preset's words,
                   Tag = the part id, ElementType = its id ('10in'), APK_Part.PartId; a preset with no
                   part keeps its own type
     the panel     IfcUnitaryControlElement CONTROLPANEL typed by it, Name = the panel's name, Tag = its id,
                   contained in the room's IfcSpace (else the storey)
       APK_TouchPanelLayout  {PanelId, ScreenPreset, ResolutionWidth, ResolutionHeight (px), Pages, Controls,
                   Theme, LayoutHash, DeviceId}: what the glass presents, by count and content hash only
       IfcDocumentReference  to the layout JSON (IfcRelAssociatesDocument): the pages, controls, bindings
                   and looks never become IFC; LayoutHash says which layout the panel presents
   A control's binding names an instrument variable on the bus (a topic / SCPI word), not a port: no
   IfcRelConnectsPorts is written for it. Identity is the MAC / serial in DeviceId, never an IP.
   Opening the .ifc gives the panel back (id, name, room, screen, device) with no controls: the layout is
   the .json twin's, and the reader names the document so the page can say so. */

import { entitiesByType, enumv, getPsets, ifcGuid, parseStep, real, ref, sha1, typed, writeStep } from '../vendor/apk-contracts/apk-ifc.js';
import { BLOCK_TYPE } from './touchPanelHost.js';

export const TOUCH_PANEL_IFC_SCHEMA = 'IFC4X3_ADD2';
const STAMP = '1970-01-01T00:00:00';   // fixed: the file is a function of the panel, never of the clock

const str = (v) => (v == null ? '' : String(v));
const label = (s) => typed('IFCLABEL', String(s));
const ident = (s) => typed('IFCIDENTIFIER', String(s));
const int = (n) => typed('IFCINTEGER', Math.trunc(n));
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** A stable JSON: object keys sorted at every depth, so the hash follows the content, not the key order. */
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/** The content hash of what the glass presents: its pages, its controls (each with its bindings, look and
    behaviour), the theme and the looks it carries. Not the selection, not the panel's name or room. */
export function layoutHash(block) {
  const b = block || {};
  const content = { pages: b.pages || [], widgets: b.widgets || [], theme: b.theme || {}, savedLooks: b.savedLooks || [], width: b.width, height: b.height };
  return 'sha1:' + [...sha1(new TextEncoder().encode(stable(content)))].map((x) => x.toString(16).padStart(2, '0')).join('');
}

class Writer {
  constructor() { this.entities = []; }
  add(type, ...args) {
    const id = this.entities.length + 1;
    this.entities.push({ id, type, args });
    return ref(id);
  }
}

/** The touch_panel block (panelBlock) as IFC4X3_ADD2 STEP text.
    opts: name (the file stem; the layout document is <name>.json), presets ([{id, name, w, h}], the
    builder's SCREEN_PRESETS: the hardware type's words). GlobalIds are uuid5 of touchpanel/<id>/... */
export function touchPanelToIfc(block, { name, presets = [] } = {}) {
  const b = block || {};
  const id = str(b.id) || 'touch_panel';
  const stem = String(name || id).replace(/\.(ifc|json)$/i, '');
  const W = new Writer();
  const P = ifcGuid('touchpanel', id);
  const g = (...roles) => ifcGuid('touchpanel', id, ...roles);
  const preset = presets.find((p) => p && p.id === b.screenPreset) || null;

  // ---- owner, units (mm), context, the spine
  const person = W.add('IFCPERSON', null, 'APK.audio', null, null, null, null, null, null);
  const org = W.add('IFCORGANIZATION', null, 'APK.audio', 'Touch panel builder', null, null);
  const po = W.add('IFCPERSONANDORGANIZATION', person, org, null);
  const app = W.add('IFCAPPLICATION', org, '1', 'APK.audio touch panel builder', 'EDITORS.TouchPanelBuilder');
  const oh = W.add('IFCOWNERHISTORY', po, app, null, null, null, null, null, 0);
  const mm = W.add('IFCSIUNIT', { kind: 'derived' }, enumv('LENGTHUNIT'), enumv('MILLI'), enumv('METRE'));
  const volt = W.add('IFCSIUNIT', { kind: 'derived' }, enumv('ELECTRICVOLTAGEUNIT'), null, enumv('VOLT'));
  const amp = W.add('IFCSIUNIT', { kind: 'derived' }, enumv('ELECTRICCURRENTUNIT'), null, enumv('AMPERE'));
  const hz = W.add('IFCSIUNIT', { kind: 'derived' }, enumv('FREQUENCYUNIT'), null, enumv('HERTZ'));
  const ohm = W.add('IFCSIUNIT', { kind: 'derived' }, enumv('ELECTRICRESISTANCEUNIT'), null, enumv('OHM'));
  const units = W.add('IFCUNITASSIGNMENT', [mm, volt, amp, hz, ohm]);
  const origin = W.add('IFCAXIS2PLACEMENT3D', W.add('IFCCARTESIANPOINT', [real(0), real(0), real(0)]), null, null);
  const ctx = W.add('IFCGEOMETRICREPRESENTATIONCONTEXT', null, 'Model', 3, real(1e-5), origin, null);
  const project = W.add('IFCPROJECT', P, oh, str(b.name) || stem, 'Touch panel builder: one touch panel in its room', null, null, null, [ctx], units);
  const sitePl = W.add('IFCLOCALPLACEMENT', null, origin);
  const buildingPl = W.add('IFCLOCALPLACEMENT', sitePl, origin);
  const storeyPl = W.add('IFCLOCALPLACEMENT', buildingPl, origin);
  const site = W.add('IFCSITE', g('site'), oh, 'Site', null, null, sitePl, null, null, enumv('ELEMENT'), null, null, null, null, null);
  const building = W.add('IFCBUILDING', g('building'), oh, 'Building', null, null, buildingPl, null, null, enumv('ELEMENT'), null, null, null);
  const storey = W.add('IFCBUILDINGSTOREY', g('storey'), oh, 'Level 0', null, null, storeyPl, null, null, enumv('ELEMENT'), real(0));
  W.add('IFCRELAGGREGATES', g('aggregates', 'project'), oh, null, null, project, [site]);
  W.add('IFCRELAGGREGATES', g('aggregates', 'site'), oh, null, null, site, [building]);
  W.add('IFCRELAGGREGATES', g('aggregates', 'building'), oh, null, null, building, [storey]);
  let container = storey;
  let containerPl = storeyPl;
  const room = str(b.room).trim();
  if (room) {
    containerPl = W.add('IFCLOCALPLACEMENT', storeyPl, origin);
    container = W.add('IFCSPACE', g('space'), oh, room, null, null, containerPl, null, null, enumv('ELEMENT'), enumv('SPACE'), null);
    W.add('IFCRELAGGREGATES', g('aggregates', 'storey'), oh, null, null, storey, [container]);
  }

  // ---- the hardware type and the panel
  const presetId = str(b.screenPreset);
  const pid = preset && preset.part ? str(preset.part) : '';
  const partSets = pid ? [W.add('IFCPROPERTYSET', ifcGuid('part', pid, 'pset', 'APK_Part'), oh, 'APK_Part', null,
    [W.add('IFCPROPERTYSINGLEVALUE', 'PartId', null, ident(pid), null)])] : null;
  const type = W.add('IFCUNITARYCONTROLELEMENTTYPE', pid ? ifcGuid('part', pid) : ifcGuid('touchpanel-type', presetId || 'custom'), oh,
    preset ? str(preset.name) : presetId ? `Touch panel ${presetId}` : 'Touch panel', null, null, partSets, null, pid || null,
    presetId || null, enumv('CONTROLPANEL'));
  W.add('IFCRELDECLARES', g('declares'), oh, null, null, project, [type]);
  const panelGid = g('panel');
  const panel = W.add('IFCUNITARYCONTROLELEMENT', panelGid, oh, str(b.name) || stem,
    'Touch panel: what its glass presents is the layout document (APK_TouchPanelLayout.LayoutHash), never IFC',
    null, W.add('IFCLOCALPLACEMENT', containerPl, origin), null, id, enumv('CONTROLPANEL'));
  W.add('IFCRELDEFINESBYTYPE', g('typed'), oh, null, null, [panel], type);

  const prop = (n, v) => (v == null || v === '' ? null : W.add('IFCPROPERTYSINGLEVALUE', n, null, v, null));
  const width = num(b.width);
  const height = num(b.height);
  const props = [
    prop('PanelId', ident(id)),
    presetId ? prop('ScreenPreset', label(presetId)) : null,
    width ? prop('ResolutionWidth', int(width)) : null,
    height ? prop('ResolutionHeight', int(height)) : null,
    prop('Pages', int((b.pages || []).length)),
    prop('Controls', int((b.widgets || []).length)),
    b.theme && b.theme.preset ? prop('Theme', label(b.theme.preset)) : null,
    prop('LayoutHash', ident(layoutHash(b))),
    b.deviceId ? prop('DeviceId', ident(b.deviceId)) : null,
  ].filter(Boolean);
  const ps = W.add('IFCPROPERTYSET', g('pset', 'APK_TouchPanelLayout'), oh, 'APK_TouchPanelLayout', null, props);
  W.add('IFCRELDEFINESBYPROPERTIES', g('props', 'APK_TouchPanelLayout'), oh, null, null, [panel], ps);
  const doc = W.add('IFCDOCUMENTREFERENCE', `${stem}.json`, id, 'Touch panel layout',
    'The Touch Panel Builder layout (APK-native touch_panel block JSON) this panel presents; APK_TouchPanelLayout.LayoutHash names its content', null);
  W.add('IFCRELASSOCIATESDOCUMENT', g('layout'), oh, null, null, [panel], doc);
  W.add('IFCRELCONTAINEDINSPATIALSTRUCTURE', g('contains'), oh, null, null, [panel], container);

  return writeStep({
    header: [
      { type: 'FILE_DESCRIPTION', args: [['ViewDefinition [ReferenceView]'], '2;1'] },
      { type: 'FILE_NAME', args: [`${stem}.ifc`, STAMP, ['APK.audio'], ['APK.audio'], 'APK.audio touch panel builder', 'EDITORS.TouchPanelBuilder', ''] },
      { type: 'FILE_SCHEMA', args: [[TOUCH_PANEL_IFC_SCHEMA]] },
    ],
    entities: W.entities,
  });
}

/** An IFC model → { block, layout, layoutHash }: the panel shell (id, name, room, screen, size, device; no
    pages beyond one empty page, no controls) and the layout document it names. Throws a sentence when the
    file holds no control panel. */
export function touchPanelFromIfc(text) {
  const file = parseStep(String(text));
  const panels = entitiesByType(file, 'IFCUNITARYCONTROLELEMENT');
  const panel = panels.find((e) => getPsets(file, e).APK_TouchPanelLayout) || panels[0];
  if (!panel) throw new TypeError('no touch panel in this IFC: it has no IfcUnitaryControlElement');
  const lay = getPsets(file, panel).APK_TouchPanelLayout || {};
  let room = '';
  for (const r of entitiesByType(file, 'IFCRELCONTAINEDINSPATIALSTRUCTURE')) {
    if ((r.args[4] || []).some((x) => x && x.id === panel.id)) {
      const s = file.byId.get(r.args[5]?.id);
      if (s && s.type === 'IFCSPACE') room = str(s.args[2]);
    }
  }
  let layout = '';
  for (const r of entitiesByType(file, 'IFCRELASSOCIATESDOCUMENT')) {
    if ((r.args[4] || []).some((x) => x && x.id === panel.id)) layout = str(file.byId.get(r.args[5]?.id)?.args[0]);
  }
  const block = {
    type: BLOCK_TYPE,
    id: str(lay.PanelId) || str(panel.args[7]),
    name: str(panel.args[2]),
    room,
    screenPreset: str(lay.ScreenPreset),
    width: Number(lay.ResolutionWidth) || undefined,
    height: Number(lay.ResolutionHeight) || undefined,
    pages: [{ id: 'p1', name: 'Main' }],
    deviceId: str(lay.DeviceId),
    widgets: [],
  };
  return { block, layout, layoutHash: str(lay.LayoutHash), controls: Number(lay.Controls) || 0 };
}
