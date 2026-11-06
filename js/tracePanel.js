// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* tracePanel.js — A MONITORING BOX'S PANEL DRAWS ITS TRACE (ROAD-3516).

   Each INSTRUMENT.<Family> repo's thing.json names what the family IS on the
   bench; WEB.OsApi serves them on GET /api/instrument/families. A family whose
   roles include `monitoring` (scopes, spectrum analysers, VNAs, audio analysers,
   test sets, generators) has something to WATCH, not just numbers to read, so
   its running panel:

     1. gains a TRACE page with one trace control on the box's retained rig,
        `System/Captures/Rig/<device>` — the capture recorder's Trace/<source>
        leaves (WEB.OsApi capture_trace.py: points 0..255 plus the preamble);
     2. draws any readout whose readback arrives as a series (a waveform or
        spectrum query answers hundreds of numbers) as a trace, not as text.

   Pure: no DOM, no bus. runner.js feeds it the panel and the messages. */

/** The roles a family's thing.json names, from /api/instrument/families. */
export function rolesFor(families, family) {
  const f = families && families.families && families.families[String(family || '')];
  return Array.isArray(f && f.roles) ? f.roles.map(String) : [];
}

export const isMonitoring = (roles) => Array.isArray(roles) && roles.includes('monitoring');

/** `…/Protocols/visa/Device/Oscilloscope/54641D/Dev716/Write` → `visa/Oscilloscope/54641D/Dev716`. */
export function deviceKeyOf(writeTopic) {
  const m = String(writeTopic || '').match(/\/Protocols\/([^/]+)\/Device\/(.+?)\/(Write|Control)$/);
  return m ? `${m[1]}/${m[2]}` : '';
}

const parsed = (text) => {
  if (typeof text !== 'string') return text;
  try { return JSON.parse(text); } catch (_) { return text; }
};

/** A readback as a series of numbers, or null when it is one value (a readout).
    A JSON array, {value: array}, or a comma list — at least `min` numbers. */
export function seriesOf(text, min = 16) {
  let v = parsed(text);
  if (v && typeof v === 'object' && !Array.isArray(v) && 'value' in v) v = parsed(v.value);
  const list = Array.isArray(v) ? v : typeof v === 'string' && v.includes(',') ? v.split(',') : null;
  if (!list || list.length < min) return null;
  const nums = list.map(Number);
  return nums.every(Number.isFinite) ? nums : null;
}

/** Numbers scaled onto the 0..255 a trace lane draws (flat → the centre line). */
export function toBytes(nums) {
  let lo = Infinity, hi = -Infinity;
  for (const n of nums) { lo = Math.min(lo, n); hi = Math.max(hi, n); }
  if (!(hi > lo)) return nums.map(() => 128);
  return nums.map(n => Math.round(((n - lo) / (hi - lo)) * 255));
}

/** Every Trace/<source> leaf of a rig message: [{source, points}], in source order. */
export function tracesFromRig(text) {
  const doc = parsed(text);
  const rig = doc && typeof doc === 'object' ? doc.rig : null;
  if (!rig || typeof rig !== 'object') return [];
  const out = [];
  for (const [leaf, raw] of Object.entries(rig)) {
    if (!leaf.startsWith('Trace/')) continue;
    const t = parsed(raw);
    if (!t || !Array.isArray(t.points) || !t.points.length) continue;
    out.push({ source: String(t.source || leaf.slice(6)), points: t.points.map(p => Math.max(0, Math.min(255, Number(p) || 0))) });
  }
  return out.sort((a, b) => a.source.localeCompare(b.source, undefined, { numeric: true }));
}

/** The panel with a TRACE page for a monitoring box: one trace control on its rig
    topic. Unchanged when the box is not monitoring, has no rig, or already has one. */
export function withTracePage(panel, roles, rigTopic, { width = 1280, height = 800 } = {}) {
  if (!panel || !isMonitoring(roles) || !rigTopic) return panel;
  if ((panel.widgets || []).some(w => w.type === 'trace' && w.rig === rigTopic)) return panel;
  const page = { id: 'trace', name: 'TRACE' };
  const widget = { id: 'trace_rig', type: 'trace', page: page.id, label: 'TRACE', rig: rigTopic,
    x: 20, y: 20, w: width - 40, h: height - 40, behavior: {}, style: {} };
  return { ...panel, pages: [...(panel.pages || []), page], widgets: [...(panel.widgets || []), widget] };
}
