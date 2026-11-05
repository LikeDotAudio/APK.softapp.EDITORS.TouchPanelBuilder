// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* touchPanelHost.js — the touch-panel block in and out of the CAD over
   cad.like.audio/host@1, through the vendored APKSoftapp client (ROAD-3485 /
   ROAD-3491). No DOM here: the round-trip test drives it with the real client. */

export const EDITOR = 'Touch Panel Builder';
export const BLOCK_TYPE = 'touch_panel';

/** The block the CAD stores, from the app's panel. */
export function panelBlock(panel) {
  return {
    type: BLOCK_TYPE,
    id: panel.id,
    name: panel.name,
    room: panel.room,
    screenPreset: panel.screenPreset,
    width: panel.width,
    height: panel.height,
    theme: panel.theme,
    savedLooks: panel.savedLooks || [],
    pages: panel.pages || [],
    deviceId: panel.deviceId || '',
    widgets: panel.widgets,
  };
}

export function panelMeta(panel) {
  const name = String(panel.name || 'panel');
  return {
    title: `${name} (${(panel.widgets || []).length} Widgets)`,
    filename: `touchpanel_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
  };
}

/** Bind the panel to a discovered device (APKSoftapp thing): its MAC / serial, never its IP. */
export function bindPanelDevice(panel, thing) {
  const id = thing && (thing.mac || thing.serial || thing.agent);
  if (!id) return false;
  panel.deviceId = id;
  return true;
}

/**
 * app: { panel, handleBlockLoaded(block, meta) } — the TouchPanelApp, or a stub.
 * Returns the APKSoftapp host handle.
 */
export function connectTouchPanelHost(S, app, { notice } = {}) {
  return S.connectHost({
    editor: EDITOR,
    blockType: BLOCK_TYPE,
    block: panelBlock(app.panel),
    notice,
    onLoad: (block, meta) => {
      app.panel.deviceId = block.deviceId || '';
      app.handleBlockLoaded(block, meta);
    },
    onRequest: () => ({ block: panelBlock(app.panel), meta: panelMeta(app.panel) }),
  });
}
