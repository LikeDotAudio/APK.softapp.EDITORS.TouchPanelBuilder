// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/* copyControl.js — PUSH AND HOLD A CONTROL TO COPY IT.

   The copy is the whole control: its type, look, behaviour, page, address and
   every binding (its ins and outs), so a wired MUTE copied is a second wired
   MUTE, not a blank button. Only the identity and the place are new. Pure. */

// How long a press must stay still before it becomes a copy, and how far the
// pointer may wander and still count as still.
export const HOLD_MS = 600;
export const HOLD_SLOP_PX = 4;

const deep = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

/** A copy of control `w` with a fresh id, placed `offset` px down-right. */
export function cloneControl(w, { id, offset = 20, bounds = null } = {}) {
  const copy = deep(w);
  copy.id = id || `w_${Date.now()}_copy`;
  copy.x = (w.x || 0) + offset;
  copy.y = (w.y || 0) + offset;
  if (bounds) {
    copy.x = Math.max(0, Math.min(copy.x, bounds.width - (copy.w || 0)));
    copy.y = Math.max(0, Math.min(copy.y, bounds.height - (copy.h || 0)));
  }
  return copy;
}

/** True once a press has been held long enough without moving. */
export function isHold(elapsedMs, dx, dy) {
  return elapsedMs >= HOLD_MS && Math.hypot(dx, dy) <= HOLD_SLOP_PX;
}
