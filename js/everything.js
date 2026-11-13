// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* everything.js — EVERYTHING IN (owner 2026-11-12): "I see such a rich amount of
   data coming in with nothing displaying it on the touch panel".

   Every query the unit answers becomes a data point: one live meter per answer
   (Everything in) and one trend per answer (Everything over time), on every
   device's touch panel, after the family GUI file's pages (run.html).

   WHERE A DATA POINT COMES FROM. The unit's own `/Reply` (PLUGIN.VISA answers
   every exchange: {command, raw | done | error, correlation_id}) — the one proof
   (haze until proven). A stacked query (`FUNC?;:READ?`, `CALC:AVER:MIN?;…`) is
   cut into its parts the way WEB.OsApi gui_certificate.py stack_answers does: one
   answer per `;` outside quotes, matched to the stack's questions, a relative
   part (`MEAS:VOLT?;CURR?`) left out rather than guessed. History before the
   panel opened comes from the capture recorder's Write → Read pairs.

   WHAT IT IS CALLED. The SDK (the model's api.json) names it: the get/nab whose
   own SCPI is that question gives its description; a part of a stacked SDK
   command with no command of its own is named by the stack's returns.fields.
   Only a question the SDK does not know is shown as its SCPI. Its unit is the
   SDK's returns.unit; a READ / FETCh (whose unit is whatever the meter is set
   to) takes the unit of the function the unit last said it was in.

   Nothing here is per model: the SDK and the traffic drive it all. Pure: no DOM,
   no bus — the tests drive it with recorded replies. */

/* THE BENCH'S CATEGORICAL TONES — the Capture Timeline's per-track colours
   (Softapps/TIME/TIME.CaptureTimeline js/capture-timeline.js TONES), read on the
   dark glass. A data point's colour is its identity hashed into these, never its
   arrival order, so it is the same on every page, device and reload. */
export const TONES = ['#f4902c', '#4cc38a', '#5aa9e6', '#c678dd', '#e5c07b', '#e06c75', '#56b6c2', '#d19a66', '#98c379', '#61afef'];

export function toneOf(identity) {
  let h = 0;
  for (const c of String(identity)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TONES[h % TONES.length];
}

/** Nothing unverified for 5 min is trusted (the house trust-decay rule). */
export const TRUST_MS = 5 * 60 * 1000;

/** `text` cut at each `sep` that is not inside a "quoted string" (IEEE 488.2). */
export function splitUnquoted(text, sep) {
  const parts = []; let cur = ''; let quoted = false;
  for (const ch of String(text ?? '')) {
    if (ch === '"') quoted = !quoted;
    if (ch === sep && !quoted) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

/** One spelling for one question: `:MEASure:VOLTage?` and `MEAS:VOLT?` are the same
    (gui_certificate.py query_key: the standard's short form). */
export function queryKey(query) {
  const s = String(query ?? '').trim().replace(/^:+/, '');
  const sp = s.indexOf(' ');
  const head = sp < 0 ? s : s.slice(0, sp);
  const rest = sp < 0 ? '' : s.slice(sp + 1).trim();
  const words = head.replace(/\?$/, '').toUpperCase().split(':').map((word) => {
    const m = /^([A-Z]+)(\d*)$/.exec(word);
    if (m && m[1].length > 4) {
      const stem = m[1].slice(0, 4);
      return ('AEIOU'.includes(stem[3]) ? stem.slice(0, 3) : stem) + m[2];
    }
    return word;
  });
  return `${words.join(':')}?${rest ? ` ${rest.toUpperCase()}` : ''}`;
}

/** [{ index, query, key, said }] — each question of a (stacked) query with its
    answer, or [] when the answers do not line up one to one. */
export function stackParts(query, answer) {
  const parts = splitUnquoted(query, ';').map(p => p.trim()).filter(Boolean);
  const asks = parts.map((p, i) => [i, p]).filter(([, p]) => p.includes('?'));
  const said = splitUnquoted(String(answer ?? ''), ';').map(a => a.trim());
  if (!asks.length || asks.length !== said.length) return [];
  const out = [];
  asks.forEach(([i, part], n) => {
    const prev = i > 0 ? parts[i - 1].replace(/^:+/, '').split(' ')[0] : '';
    const relative = i > 0 && !part.startsWith(':') && !part.startsWith('*') && prev.includes(':');
    if (said[n] !== '' && !relative) out.push({ index: n, query: part, key: queryKey(part), said: said[n] });
  });
  return out;
}

/* SCPI's own words for what a meter is set to measure → the unit it answers in.
   Wire constants of the standard, not a device list. */
const FUNCTION_UNITS = [
  [/FRES|RES/, 'Ω'], [/VOLT/, 'V'], [/CURR/, 'A'], [/FREQ/, 'Hz'], [/PER/, 's'],
  [/CAP/, 'F'], [/IND/, 'H'], [/TEMP/, '°C'], [/POW/, 'W'], [/CONT/, 'Ω'], [/DIOD/, 'V'],
];
export function unitOfFunction(text) {
  const t = String(text ?? '').replace(/"/g, '').toUpperCase();
  for (const [re, u] of FUNCTION_UNITS) if (re.test(t)) return u;
  return '';
}

/** A measurement (what the device measures) rather than a setting read back. */
export function isMeasurement(key) {
  return /^(MEAS|READ|FETC|DATA|CALC:AVER|SENS:DATA)/.test(String(key || '').replace(/^:+/, ''));
}

/** The model's api.json → { byKey: Map(queryKey → entry), stacks: Map(queryKey of whole → entry) }.
    entry: { command, description, scpi, unit, fields }. A get wins over its nab twin. */
export function sdkIndex(api) {
  const byKey = new Map();
  const stacks = new Map();
  const byCommand = new Map();
  const eps = (api && api.endpoints) || {};
  for (const verb of ['get', 'nab']) {
    for (const [name, ep] of Object.entries(eps[verb] || {})) {
      let scpi = String((ep && ep.scpi) || '');
      if (!scpi.includes('?')) continue;
      const weak = scpi.includes('<');
      // `:MEASure:CURRent:DC? <range>,<resolution>`: asked bare, it is still that
      // command's question — its head names it (a bare command of its own wins).
      if (scpi.includes('<')) {
        if (scpi.includes(';')) continue;
        scpi = scpi.slice(0, scpi.indexOf('?') + 1);
      }
      const r = (ep && ep.returns) || {};
      const entry = { command: ep.command || name, description: String(ep.description || ''), scpi,
        unit: String(r.unit || ''), fields: Array.isArray(r.fields) ? r.fields : null };
      if (!byCommand.has(entry.command)) byCommand.set(entry.command, entry);
      if (scpi.includes(';')) { if (!stacks.has(queryKey(scpi))) stacks.set(queryKey(scpi), entry); }
      else if (!byKey.has(queryKey(scpi)) || (byKey.get(queryKey(scpi)).weak && !weak)) byKey.set(queryKey(scpi), { ...entry, weak });
    }
  }
  return { byKey, stacks, byCommand };
}

/* A description that only says the command's name again ("Get ese") reads worse
   than a cleaned name; otherwise the SDK's words. */
function nameOf(entry) {
  const d = entry.description.trim();
  const flat = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (d && flat(d) !== flat(entry.command.replace(/^(Get|Read|Nab)_/, '')) && flat(d) !== flat(entry.command)) return d;
  return entry.command.replace(/_/g, ' ');
}

/** A number as SCPI says it (NR1 / NR2 / NR3), or null. +9.9E+37 is "no reading". */
export function numberOf(said) {
  const s = String(said ?? '').trim().replace(/^"|"$/g, '');
  if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) && Math.abs(n) < 9e37 ? n : null;
}

const PREFIX = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
/* A unit that takes no engineering prefix. */
const NO_PREFIX = /^(°|%|dB|ppm|bool)/i;

/** 310352.8, 'Ω' → '310.35 kΩ'; 0.01427, 'V' → '14.270 mV'. Five significant figures. */
export function engineering(value, unit = '') {
  if (!Number.isFinite(value)) return '—';
  if (NO_PREFIX.test(unit)) return `${+value.toPrecision(5)} ${unit}`.trim();
  if (value === 0) return `0 ${unit}`.trim();
  const a = Math.abs(value);
  const [k, p] = PREFIX.find(([f]) => a >= f) || PREFIX[PREFIX.length - 1];
  const m = value / k;
  const digits = Math.max(0, 4 - Math.floor(Math.log10(Math.abs(m))));
  return `${m.toFixed(digits)} ${p}${unit}`.trim();
}

/** A linear meter's full scale in the units its number is WRITTEN in (100.00 mV → 200):
    the next 1-2-5 above |value| × 1.25, held while the value stays between a twelfth of it
    and it, so a wandering reading does not flick the range. 0 keeps the last (or 1). */
export function stickyFull(prev, value) {
  const a = Math.abs(Number(value));
  if (!Number.isFinite(a) || a === 0) return Number.isFinite(prev) && prev > 0 ? prev : 1;
  if (Number.isFinite(prev) && prev > 0 && a <= prev && a >= prev / 12) return prev;
  const x = a * 1.25;
  const e10 = 10 ** Math.floor(Math.log10(x));
  const m = x / e10;
  return +((m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * e10).toPrecision(6);
}

/** A meter's decade (10^d is its full scale ÷ 10), held while the value stays on
    that scale, so nearby readings do not flick the range back and forth. */
export function stickyDecade(prev, value) {
  if (!Number.isFinite(value) || value === 0) return Number.isFinite(prev) ? prev : 0;
  const a = Math.abs(value);
  if (Number.isFinite(prev)) {
    const m = a / 10 ** prev;
    if (m >= 0.08 && m <= 10) return prev;
  }
  return Math.floor(Math.log10(a));
}

/** Who asked, short (the /Reply's correlation_id, ROAD-3616/3684). */
export function askerName(id) {
  const a = String(id || '');
  if (!a) return 'unnamed';
  if (a.startsWith('panel-live:')) return 'panel ask';
  if (/record/i.test(a)) return 'recorder';
  return a.length > 22 ? `${a.slice(0, 21)}…` : a;
}

/* The house LOG TIME axis (owner 2026-11-11, "doppler"): the same warp the Capture
   Timeline and the Data Logger draw with — age from the right edge warped by
   ln(1 + age/knee), knee = span/200; linear when off. f ∈ [0, 1] across the plot. */
export function timeToFrac(t, from, to, log) {
  if (!log) return (t - from) / (to - from);
  const knee = Math.max(1e-9, (to - from) / 200);
  return 1 - Math.log1p(Math.max(0, to - t) / knee) / Math.log1p((to - from) / knee);
}
export function fracToTime(f, from, to, log) {
  if (!log) return from + f * (to - from);
  const knee = Math.max(1e-9, (to - from) / 200);
  return to - knee * Math.expm1((1 - f) * Math.log1p((to - from) / knee));
}

/**
 * The data points of one unit. opts: { model, sdk (sdkIndex), history (points kept per point) }.
 * hear(reply, at) takes one /Reply envelope; seed(reads) the recorder's Write/Read pairs.
 * points(): every data point, measurements first, then by name.
 */
export class Everything {
  constructor({ model = '', sdk = { byKey: new Map(), stacks: new Map(), byCommand: new Map() }, history = 2000 } = {}) {
    this.model = model;
    this.sdk = sdk;
    this.keep = history;
    this.map = new Map();
    this.functionUnit = '';
  }

  /* One part of an answer → its data point (made the first time it is heard). */
  point(part, whole) {
    const own = this.sdk.byKey.get(part.key);
    const stack = whole ? this.sdk.stacks.get(queryKey(whole)) : null;
    const field = stack && stack.fields && stack.fields[part.index];
    const id = own ? `${this.model}|${own.command}|0`
      : stack ? `${this.model}|${stack.command}|${part.index}` : `${this.model}|${part.key}|0`;
    let p = this.map.get(id);
    if (!p) {
      const label = own ? nameOf(own)
        : stack ? `${nameOf(stack)}${field && field.name ? ` · ${String(field.name).replace(/_/g, ' ')}` : ` · ${part.index + 1}`}`
          : part.query.replace(/^:+/, '');
      p = { id, key: part.key, scpi: part.query.replace(/^:+/, ''), label, colour: toneOf(id),
        unit: (own && own.unit) || (field && field.unit) || '', measured: isMeasurement(part.key),
        value: null, raw: '', at: 0, asker: '', decade: undefined, history: [] };
      this.map.set(id, p);
    }
    return p;
  }

  take(query, answer, at, asker) {
    const parts = stackParts(query, answer);
    const touched = [];
    for (const part of parts) {
      const p = this.point(part, parts.length > 1 || query.includes(';') ? query : '');
      if (this.apply(p, part.key, part.said, at, asker)) touched.push(p);
    }
    return touched;
  }

  /* One proven answer onto its point. False when it is the same answer heard
     twice (its named reading, then its /Reply): one proof, one point. */
  apply(p, key, said, at, asker) {
    const raw = String(said ?? '').trim().replace(/^"|"$/g, '');
    const n = numberOf(said);
    if (p.at && Math.abs(at - p.at) < 2000 && (p.raw === raw || (n !== null && n === p.value))) {
      if (asker && asker !== 'reading') p.asker = asker;
      return false;
    }
    if (p.at && at < p.at) return false;     // an older answer never overwrites a newer one
    // What the meter is set to, said by FUNC?: a READ / FETCh is in its unit.
    if (/^(CONF|FUNC|SENS:FUNC)/.test(key) && n === null) this.functionUnit = unitOfFunction(raw);
    p.raw = raw;
    p.value = n;
    p.at = at;
    p.offline = false;
    p.asker = asker || '';
    if (!p.unit && /^(READ|FETC|DATA)/.test(key)) p.shownUnit = this.functionUnit;
    if (n !== null) {
      p.decade = stickyDecade(p.decade, n);
      p.history.push({ t: at, v: n });
      if (p.history.length > this.keep) p.history.splice(0, p.history.length - this.keep);
    }
    return true;
  }

  /** A NAMED READING — KOMAND's <unit>/Reading/<Command>[/<field>] (an SDK command
      by name, a stacked one by its returns.fields name) or Reading/RoundRobin/<x>
      ({value, unit, command}). Unambiguous: the reading says which question it
      answers. A NULL value is the unit offline: a gap. */
  takeReading(leaf, payload, at = Date.now()) {
    let doc = payload;
    if (typeof payload === 'string') { try { doc = JSON.parse(payload); } catch (_) { doc = { value: payload }; } }
    if (doc === null || typeof doc !== 'object') doc = { value: doc };
    const segs = String(leaf || '').replace(/^Reading\//, '').split('/').filter(Boolean);
    const when = doc.ts ? Date.parse(doc.ts) || at : at;
    if (doc.value === null || doc.value === undefined) {
      if ('value' in doc) this.gap(when);
      return [];
    }
    const said = String(doc.value);
    if (doc.command) {
      const parts = stackParts(String(doc.command), said);
      if (parts.length !== 1) return [];
      const p = this.point(parts[0], '');
      if (doc.unit && !p.unit) p.unit = String(doc.unit);
      return this.apply(p, parts[0].key, said, when, 'reading') ? [p] : [];
    }
    const entry = this.sdk.byCommand && this.sdk.byCommand.get(segs[0]);
    if (!entry) return [];
    const asks = splitUnquoted(entry.scpi, ';').map(x => x.trim()).filter(x => x.includes('?'));
    let index = 0;
    if (segs[1]) {
      index = entry.fields ? entry.fields.findIndex(f => f && f.name === segs[1]) : -1;
      if (index < 0 || !asks[index]) return [];
    } else if (asks.length !== 1) return [];
    const part = { index, query: asks[index], key: queryKey(asks[index]), said };
    const p = this.point(part, asks.length > 1 ? entry.scpi : '');
    if (doc.unit && !p.unit) p.unit = String(doc.unit);
    return this.apply(p, part.key, said, when, 'reading') ? [p] : [];
  }

  /** One /Reply envelope. Only an answer proves a point: an error or a `done` moves nothing. */
  hear(env, at = Date.now()) {
    if (!env || typeof env !== 'object' || env.error || env.raw == null) return [];
    const command = String(env.command || '');
    if (!command.includes('?')) return [];
    return this.take(command, String(env.raw), at, env.correlation_id);
  }

  /** The capture recorder's reads for this unit: its named readings and its /Reply
      envelopes, each of which says which question it answers. (Its bare Write →
      Read pairs are not used: a timed-out question leaves no Read and every pair
      after it would be misnamed.) A NULL value leaf is the unit offline: a gap. */
  seed(reads) {
    const sorted = (reads || []).slice().sort((a, b) => a.ts - b.ts);
    for (const r of sorted) {
      const at = Math.round(r.ts * 1000);
      const leaf = String(r.leaf || '');
      if (r.value === null) { if (leaf !== 'Write') this.gap(at); continue; }
      if (leaf === 'Reply') {
        let env = null;
        try { env = JSON.parse(r.value); } catch (_) { continue; }
        this.hear(env, at);
      } else if (leaf.startsWith('Reading/')) {
        let doc = null;
        try { doc = JSON.parse(r.value); } catch (_) { doc = { value: r.value }; }
        // The recorder's own time is when it came in; a reading's ts is the same moment.
        this.takeReading(leaf, { ...(doc && typeof doc === 'object' ? doc : { value: doc }), ts: undefined }, at);
      }
    }
  }

  /** The unit is offline (a recorder NULL, its status record says not connected):
      every point breaks its line here and rests — no stale value is shown as live. */
  gap(at = Date.now()) {
    for (const p of this.map.values()) {
      const last = p.history[p.history.length - 1];
      if (!last || last.v !== null) p.history.push({ t: at, v: null });
      p.value = null;
      p.offline = true;
      p.at = 0;
    }
    this.offlineSince = at;
  }

  unitOf(p) { return p.unit || p.shownUnit || ''; }
  fresh(p, now = Date.now()) { return !!p.at && !p.offline && now - p.at < TRUST_MS; }

  /** A series as line runs: a NULL (a gap) ends one run and the next value starts another. */
  static runs(history) {
    const out = []; let cur = [];
    for (const h of history || []) {
      if (h.v === null || !Number.isFinite(h.v)) { if (cur.length) out.push(cur); cur = []; } else cur.push(h);
    }
    if (cur.length) out.push(cur);
    return out;
  }

  points() {
    return [...this.map.values()].sort((a, b) => (b.measured - a.measured) || a.label.localeCompare(b.label));
  }

  /** Every point's series as rows (time ISO, data point, SCPI, value, unit) — the export. */
  seriesRows() {
    const rows = [];
    for (const p of this.points()) {
      for (const h of p.history) rows.push({ time: new Date(h.t).toISOString(), point: p.label, scpi: p.scpi, value: h.v === null ? '' : h.v, unit: h.v === null ? 'offline' : this.unitOf(p) });
    }
    return rows.sort((a, b) => a.time.localeCompare(b.time));
  }
}
