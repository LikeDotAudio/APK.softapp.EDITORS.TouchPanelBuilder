// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/* What every part of the Touch Panel Builder shares: the discovered config,
   frame helpers, drag MIME types, the theme fields and esc (moved out of
   js/touchPanelApp.js, ROAD-3766). */

/* The Discovered panel and the app's discovery tunables are the shared client's
   (APKSoftapp.discoveredPanel / discoveredConfig, ROAD-3502). */
export const DISCOVERED_CONFIG = new URL('../../config/discovered.json', import.meta.url).href;
export const loadDiscoveredConfig = () => (window.APKSoftapp?.discoveredConfig
  ? window.APKSoftapp.discoveredConfig(DISCOVERED_CONFIG) : Promise.resolve({}));

// Rows drawn in the variable column before "show more" — the DOM, not the
// library, is the limit: one Generator model alone carries over a thousand.
export const VAR_PAGE = 1500;

/* Every field of a frame told not to seed and not to ask on load (in place). */
export function inertFrame(node) {
  if (!node || typeof node !== 'object') return node;
  if (typeof node.type === 'string' && node.type !== 'OcaBin' && node.type !== 'OcaBlock') {
    node.komand_seed = false;
    delete node.komand_nab_on_load;
  }
  for (const v of Object.values(node)) if (v && typeof v === 'object') inertFrame(v);
  return node;
}
/* The Gui topic prefix the engine gives a frame path (contracts
   Topics.gui.fromPanelPath, the OaTopicMaker twin), or '' without contracts. */
export const guiPrefixOf = (path) => {
  const g = typeof window !== 'undefined' && window.APKContracts && window.APKContracts.Topics && window.APKContracts.Topics.gui;
  return g && typeof g.fromPanelPath === 'function' ? g.fromPanelPath(path) : '';
};
export const isFrame = (o) => !!o && typeof o === 'object' && (o.type === 'OcaBin'
  || Object.values(o).some(v => v && typeof v === 'object' && v.type === 'OcaBin'));
export const DRAG_MIME = 'application/x-apk-variable';
export const GRAB_MIME = 'application/x-apk-grabbag';

// What only the device as a whole has: the glass and the bezel around it.
export const THEME_FIELDS = [
  { key: 'glassBg', label: 'Glass Background', kind: 'color' },
  { key: 'bezel', label: 'Bezel', kind: 'color' },
];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Copies a mixin class's methods onto `target`'s prototype as the class itself would
    define them (non-enumerable), so `this` and every method name stay the TouchPanelApp's. */
export function mixInto(target, ...mixins) {
  for (const M of mixins) {
    for (const [name, d] of Object.entries(Object.getOwnPropertyDescriptors(M.prototype))) {
      if (name === 'constructor') continue;
      if (Object.prototype.hasOwnProperty.call(target.prototype, name)) throw new Error(`mixInto: ${name} is defined twice`);
      Object.defineProperty(target.prototype, name, d);
    }
  }
}
