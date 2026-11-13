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

/* A GENERATOR'S TRACE IS ITS OWN WORD (owner 2026-11-12: "all this was created … and there is
   no trace????"). A source sends no Trace/<channel> — but every few seconds it says exactly
   what it is putting out: shape, frequency, amplitude, offset, symmetry / duty / pulse width,
   polarity, output on or off. Two periods of that waveform, drawn from those answers alone,
   captioned with them; nothing invented — a shape it cannot draw (USER) says so. */

/** A query's header in short form: `:FUNCtion:RAMP:SYMMetry?` → `FUNC:RAMP:SYMM`. */
export function shortHeader(q) {
  return String(q || '').trim().replace(/^:+/, '').replace(/\?.*$/, '').split(':')
    .map(n => (/[a-z]/.test(n) ? n.replace(/[^A-Z0-9]/g, '') : n.toUpperCase().slice(0, 4))).join(':');
}

/** The settings a generator said, from its data points [{scpi, value, raw}]: null when it has
    not said its shape, frequency and amplitude. */
export function generatorSettings(points) {
  const by = new Map();
  for (const p of points || []) by.set(shortHeader(p.scpi), p);
  const num = (...keys) => { for (const k of keys) { const p = by.get(k); if (p && Number.isFinite(p.value)) return p.value; } return NaN; };
  const word = (...keys) => { for (const k of keys) { const p = by.get(k); if (p && String(p.raw ?? '').trim()) return String(p.raw).trim().replace(/^"|"$/g, '').toUpperCase(); } return ''; };
  const shape = word('FUNC', 'SOUR:FUNC', 'FUNC:SHAP');
  const freq = num('FREQ', 'SOUR:FREQ');
  const amp = num('VOLT', 'SOUR:VOLT');
  if (!shape || !Number.isFinite(freq) || !Number.isFinite(amp)) return null;
  const outp = by.get('OUTP');
  const out = outp ? String(outp.raw ?? outp.value).trim() : '';
  return {
    shape, freq, amp, unit: word('VOLT:UNIT') || 'VPP',
    offset: Number.isFinite(num('VOLT:OFFS')) ? num('VOLT:OFFS') : 0,
    symmetry: Number.isFinite(num('FUNC:RAMP:SYMM')) ? num('FUNC:RAMP:SYMM') : 100,
    duty: Number.isFinite(num('FUNC:SQU:DCYC')) ? num('FUNC:SQU:DCYC') : 50,
    pulseDuty: Number.isFinite(num('FUNC:PULS:DCYC')) ? num('FUNC:PULS:DCYC')
      : Number.isFinite(num('FUNC:PULS:WIDT')) && freq > 0 ? Math.min(100, num('FUNC:PULS:WIDT') * freq * 100) : 50,
    inverted: word('OUTP:POL') === 'INV',
    on: out === '' ? null : /^(1|ON)$/i.test(out),
  };
}

const SI = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n']];
const si = (v, u) => { if (v === 0) return `0 ${u}`; const a = Math.abs(v); const [k, p] = SI.find(([f]) => a >= f) || SI[SI.length - 1]; return `${+(v / k).toPrecision(4)} ${p}${u}`; };

/** Two periods of what a generator is set to, as a trace [{source, points 0..255}], or null.
    The frame is ±(|offset| + peak) so the offset is seen; NOIS is a fixed pseudo-random line. */
export function generatorTrace(settings, n = 400) {
  const s = settings;
  if (!s) return null;
  const peak = s.unit === 'VRMS' ? s.amp * Math.SQRT2 : s.unit === 'DBM' ? NaN : s.amp / 2;
  const drawable = Number.isFinite(peak) && !['USER', 'ARB'].includes(s.shape);
  const wave = (ph) => {                         // ph: 0 … 1 within a period → −1 … 1
    switch (s.shape.slice(0, 4)) {
      case 'SIN': case 'SINU': return Math.sin(2 * Math.PI * ph);
      case 'SQU': case 'SQUA': return ph < s.duty / 100 ? 1 : -1;
      case 'PULS': return ph < s.pulseDuty / 100 ? 1 : -1;
      case 'RAMP': { const k = s.symmetry / 100; return k <= 0 ? 1 - 2 * ph : k >= 1 ? 2 * ph - 1 : ph < k ? 2 * ph / k - 1 : 1 - 2 * (ph - k) / (1 - k); }
      case 'TRI': case 'TRIA': return ph < 0.5 ? 4 * ph - 1 : 3 - 4 * ph;
      case 'NOIS': { let x = Math.sin(ph * 12.9898 * 1e3) * 43758.5453; return 2 * (x - Math.floor(x)) - 1; }
      case 'DC': return 0;
      default: return 0;
    }
  };
  const volts = Array.from({ length: n }, (_, i) => {
    const v = drawable ? (s.inverted ? -1 : 1) * peak * wave(((i / (n - 1)) * 2) % 1) : 0;
    return s.shape === 'DC' ? s.offset : v + s.offset;
  });
  const span = Math.max(Math.abs(s.offset) + (Number.isFinite(peak) ? peak : 0), 1e-12) * 1.15;
  const points = volts.map(v => Math.max(0, Math.min(255, Math.round(((v + span) / (2 * span)) * 255))));
  const said = [s.shape, si(s.freq, 'Hz'), s.unit === 'DBM' ? `${s.amp} dBm` : si(s.amp, s.unit === 'VRMS' ? 'Vrms' : 'Vpp'),
    `offset ${si(s.offset, 'V')}`, s.inverted ? 'inverted' : '',
    s.on === false ? 'OUTPUT OFF — what it would put out' : s.on ? 'output ON' : ''].filter(Boolean).join(' · ');
  return [{ source: drawable ? `SET: ${said}` : `SET: ${said} — this shape is not drawn from its settings`, points }];
}
