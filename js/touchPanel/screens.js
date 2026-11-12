// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/* The screens a panel can be drawn on and the box maths of resizing a control
   (moved out of js/touchPanelApp.js, ROAD-3766; it re-exports every name). */

/** The screen preset whose page is the size of the editor window. */
export const FIT_SCREEN = 'fit';

/* The handles every control on the glass carries: four edges, four corners. */
export const RESIZE_EDGES = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'];
const MIN_SIDE = 16;

/** A control's box after dragging its `edge` handle by (dx, dy) glass px.
    start: { wx, wy, ww, wh } the box when the drag began. The opposite edge
    stays put; no side goes under MIN_SIDE and nothing moves off the glass. */
export function resizeBox(start, edge, dx, dy) {
  let x = start.wx; let y = start.wy; let w = start.ww; let h = start.wh;
  if (edge.includes('e')) w = Math.max(MIN_SIDE, start.ww + dx);
  if (edge.includes('s')) h = Math.max(MIN_SIDE, start.wh + dy);
  if (edge.includes('w')) {
    x = Math.max(0, Math.min(start.wx + dx, start.wx + start.ww - MIN_SIDE));
    w = start.wx + start.ww - x;
  }
  if (edge.includes('n')) {
    y = Math.max(0, Math.min(start.wy + dy, start.wy + start.wh - MIN_SIDE));
    h = start.wy + start.wh - y;
  }
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

/** The page size of a fit-the-window panel: the room there is (availW × availH
    glass px), grown to hold every control placed (so a smaller window scrolls,
    it never cuts a control off). */
export function fitPageSize(availW, availH, widgets = [], margin = 12) {
  let right = 0; let bottom = 0;
  for (const w of widgets) {
    right = Math.max(right, (Number(w.x) || 0) + (Number(w.w) || 0));
    bottom = Math.max(bottom, (Number(w.y) || 0) + (Number(w.h) || 0));
  }
  return {
    width: Math.max(320, Math.floor(availW), right ? Math.ceil(right + margin) : 0),
    height: Math.max(240, Math.floor(availH), bottom ? Math.ceil(bottom + margin) : 0),
  };
}

// Each screen is a BIM library part (ROAD-3598 answer 7): `part` is its id in DATABASE.server.BIM
// (SRC/importers/import_control_surfaces.py writes it from this table), and the panel's IFC type is that
// part's (GlobalId part/<id>, IfcUnitaryControlElementType CONTROLPANEL — touchPanelIfc.js).
export const SCREEN_PRESETS = [
  // The page grows to the screen: its resolution is the editor's glass area,
  // kept up on every resize (and never smaller than what is placed on it).
  { id: FIT_SCREEN, name: 'Fit the window (grows with the screen)', w: 0, h: 0, fit: true },
  { id: '10in', name: '10.1″ Touch Panel (1280 × 800)', w: 1280, h: 800, part: 'generic/touch-panel-10in' },
  { id: '7in', name: '7.0″ Tabletop Panel (1024 × 600)', w: 1024, h: 600, part: 'generic/touch-panel-7in' },
  { id: '15in', name: '15.6″ Wall Mount (1920 × 1080)', w: 1920, h: 1080, part: 'generic/touch-panel-15in' },
  { id: '22in', name: '21.5″ Main Console (1920 × 1080)', w: 1920, h: 1080, part: 'generic/touch-panel-22in' },
];
