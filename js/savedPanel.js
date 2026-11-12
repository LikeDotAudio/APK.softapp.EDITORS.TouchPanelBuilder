// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* savedPanel.js — A DEVICE'S SAVED TOUCH PANEL, KEPT ON THE BUS (ROAD-3503).

   The panel a person edits and saves for one box is published RETAINED at
       APK.audio/Gui/TouchPanels/<identity>/Saved
   where <identity> is the box's serial (or the key it is presented under) —
   never its IP. The builder opens it first when it is there, and the runner
   (run.html) runs it; the generated panels (each placement the device
   presents, or its api.json) stay one pick away.

   A retained document on the Gui tree is state, not a command: KOMAND never
   fires a retained value (AUDIO.komand/src/mqtt.rs), and nothing teaches it a
   handler for this topic.

   Pure helpers plus two small bus calls; the tests feed it a fake link. */

import { brokerFor } from './runPanel.js';
import { panelToFrame, frameKey } from './frameExport.js';

/** The panel in the device's own frame form, one frame per source frame (the
    pages that came from it, overflow pages too), else one per page:
    [{ path, content }]. The OS shows these in the device's window in place of
    its template's (OS Apps/Frames/bus-panels withSavedTouchPanel), so what was
    edited is what the window shows. */
export function framesOf(panel, opts = {}) {
  const p = panel || {};
  const pages = Array.isArray(p.pages) ? p.pages : [];
  const groups = new Map();
  pages.forEach((pg, i) => {
    const src = pg && pg.source;
    const path = (src && src.path) || `${i}_${frameKey(pg.name, 'Page')}/0_${frameKey(pg.name, 'Page')}.json`;
    if (!groups.has(path)) groups.set(path, { pages: [], src });
    groups.get(path).pages.push(pg);
  });
  const out = [];
  for (const [path, g] of groups) {
    const ids = new Set(g.pages.map(pg => pg.id));
    const one = { ...p, pages: g.pages, widgets: (p.widgets || []).filter(w => ids.has(w.page)) };
    // At the addresses the device window gives its fields (ROAD-3697), so the
    // window shows what is lit on the saved panel as it does on the template.
    const doc = panelToFrame(one, undefined, opts);
    const bin = Object.values(doc)[0];
    if (g.src && g.src.card) bin.card = { ...g.src.card };
    const root = (g.src && g.src.root) || Object.keys(doc)[0];
    out.push({ path, content: { [root]: bin } });
  }
  return out;
}
/** The identity a saved panel is filed under: serial, else the presented key. Never an IP. */
export function savedIdentity(panel, link) {
  const real = (s) => { const v = String(s ?? '').trim(); return v && !/^0+$/.test(v) ? v : ''; };
  return real(link && link.serial) || String((panel && panel.deviceId) || '').trim();
}

/** Where it lives. guiTopic: APKContracts.Topics.gui.topic (path -> topic). */
export function savedTopic(guiTopic, identity) {
  const seg = String(identity || '').replace(/[^A-Za-z0-9._-]+/g, '_');
  return seg ? guiTopic(['TouchPanels', seg, 'Saved']) : '';
}

/** The retained document: the panel as a block, and the link that reopens its box. */
export function savedDoc(panel, link, now = new Date(), opts = {}) {
  const p = panel || {};
  return {
    kind: 'touch_panel',
    saved_at: now.toISOString(),
    link: { ...(link || {}) },
    // The placement it was edited from, and the panel as frames for it.
    placement: p.sourcePlacement || (link && link.placement) || 'Instruments',
    frames: framesOf(p, opts),
    block: {
      id: p.id, name: p.name, room: p.room, width: p.width, height: p.height, screenPreset: p.screenPreset,
      theme: p.theme, deviceId: p.deviceId, sourcePlacement: p.sourcePlacement, sourceFolder: p.sourceFolder,
      pages: p.pages, widgets: p.widgets,
    },
  };
}

/** The block inside a retained document, or null when it is not one of ours. */
export function blockOf(text) {
  if (!text) return null;
  try {
    const doc = typeof text === 'string' ? JSON.parse(text) : text;
    if (!doc || doc.kind !== 'touch_panel' || !doc.block || !Array.isArray(doc.block.widgets)) return null;
    return { ...doc.block, saved_at: doc.saved_at };
  } catch (_) { return null; }
}

/** The retained saved panel at `topic`, or null after waitMs (nothing retained arrives). */
export function readSaved(link, topic, waitMs = 1500) {
  if (!link || !topic) return Promise.resolve(null);
  return new Promise((resolve) => {
    let off = null;
    const done = (v) => { clearTimeout(timer); try { off && off(); } catch (_) { /* gone */ } resolve(v); };
    const timer = setTimeout(() => done(null), waitMs);
    off = link.subscribe(topic, (_t, text) => { const b = blockOf(text); if (b) done(b); });
  });
}

/** Publish the saved panel, retained. False when there is no connected bus. */
export function writeSaved(link, topic, doc) {
  if (!link || !link.connected || !topic) return false;
  link.publish(topic, JSON.stringify(doc), { qos: 1, retain: true });
  return true;
}

/** The bus a page dials: the OS shell's when it is framed by one, else config `broker_urls`. */
export async function benchBus(S, cfg, win = globalThis.window) {
  if (!S || typeof S.bus !== 'function') return null;
  let shell = false;
  try { shell = win.parent !== win && !!(win.parent.OS && win.parent.OS.brokerUrl); } catch (_) { /* other origin */ }
  if (shell) return S.bus();
  const urls = brokerFor(cfg, (win && win.location) || '127.0.0.1');
  return S.bus(urls.length ? { brokerUrl: urls[0] } : undefined);
}
