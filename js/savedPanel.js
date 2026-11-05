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
export function savedDoc(panel, link, now = new Date()) {
  const p = panel || {};
  return {
    kind: 'touch_panel',
    saved_at: now.toISOString(),
    link: { ...(link || {}) },
    block: {
      id: p.id, name: p.name, room: p.room, width: p.width, height: p.height, screenPreset: p.screenPreset,
      theme: p.theme, deviceId: p.deviceId, pages: p.pages, widgets: p.widgets,
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
  const host = (win && win.location && win.location.hostname) || '127.0.0.1';
  const urls = (Array.isArray(cfg && cfg.broker_urls) ? cfg.broker_urls : [])
    .map(u => String(u || '').replace('{host}', host)).filter(Boolean);
  return S.bus(urls.length ? { brokerUrl: urls[0] } : undefined);
}
