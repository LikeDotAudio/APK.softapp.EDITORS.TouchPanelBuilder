// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

// DEVICE PALETTES — the logic behind a device's own column entry.
//
// A device in the left/right column carries its own palette: its variables
// (from library.js variablesFromApi) sorted into Set / Do / Rig / Get, and
// under each verb its sub-categories (the api.json `subsystem`, else `group`).
// Every node can be dragged as a "grab bag": a whole verb, a whole
// sub-category, or the whole device. Nothing here names a model, a command or
// a subsystem: every grouping and every filter is read off the variables.
// Pure functions, no DOM. Laying the chosen variables out on the glass is
// devicePanel.panelFromVariables' job, not this file's.

import { VERB_LABEL } from './library.js';

// The four columns a palette shows. A `nab` (a read that returns several
// things) is an output like a get, so it sits under Get; the variable keeps
// its own verb, so the widget it becomes is still a nab.
export const PALETTE_VERBS = ['set', 'do', 'rig', 'get'];
const PALETTE_VERB_OF = { set: 'set', do: 'do', rig: 'rig', get: 'get', nab: 'get' };

export const INPUT_VERBS = ['set', 'do', 'rig'];
export const OUTPUT_VERBS = ['get', 'nab'];

/** The palette column ('set'|'do'|'rig'|'get') a variable sits in, or '' for a verb it has no column for. */
export function paletteVerbOf(v) {
  return PALETTE_VERB_OF[String(v?.verb || '').toLowerCase()] || '';
}

// ── sub-category names ───────────────────────────────────────────────────────
// api.json files spell one subsystem several ways: the SCPI long form
// ('SENSe'), its short form ('SENS'), a title-cased word ('System' next to
// 'SYSTem'/'SYST'). The key is the SCPI short form: the leading capitals of a
// mixed-case SCPI word, else the whole name upper-cased; then a longer key is
// folded into a shorter one it starts with, but only when the shorter is at
// least four letters (SCPI short forms are four letters, so 'SYSTEM' folds
// into 'SYST' while 'CALC' never folds into the three-letter 'CAL').

const MIN_FOLD = 4;

function rawSubsystem(v) {
  return String(v?.subsystem || v?.group || 'General').trim() || 'General';
}

function isScpiWord(s) {
  return /^[A-Z]{2,}[a-z]+$/.test(s);
}

/** The un-merged key of a sub-category name: 'SENSe' -> 'SENS', 'System' -> 'SYSTEM'. */
export function subsystemKey(name) {
  const s = String(name || '').trim();
  if (!s) return 'GENERAL';
  if (isScpiWord(s)) return s.match(/^[A-Z]+/)[0];
  return s.toUpperCase().replace(/\s+/g, ' ');
}

/** For a set of variables: raw subsystem name -> { key, label } after merging
    duplicates. The label is the SCPI long form when one is present, else the
    spelling used most often. */
export function subsystemNames(variables) {
  const keyCounts = new Map();     // base key -> Map(raw name -> count)
  for (const v of variables || []) {
    const raw = rawSubsystem(v);
    const k = subsystemKey(raw);
    if (!keyCounts.has(k)) keyCounts.set(k, new Map());
    const m = keyCounts.get(k);
    m.set(raw, (m.get(raw) || 0) + 1);
  }
  // Fold a key into the shortest other key (>= MIN_FOLD letters) it starts with.
  const keys = [...keyCounts.keys()].sort((a, b) => a.length - b.length || a.localeCompare(b));
  const target = new Map();
  for (const k of keys) {
    const into = keys.find(s => s !== k && s.length >= MIN_FOLD && s.length < k.length && k.startsWith(s));
    target.set(k, into ? target.get(into) || into : k);
  }
  const spellings = new Map();     // merged key -> Map(raw -> count)
  for (const [k, m] of keyCounts) {
    const t = target.get(k);
    if (!spellings.has(t)) spellings.set(t, new Map());
    const into = spellings.get(t);
    for (const [raw, n] of m) into.set(raw, (into.get(raw) || 0) + n);
  }
  const out = new Map();
  for (const [key, m] of spellings) {
    const names = [...m.entries()];
    const scpi = names.filter(([raw]) => isScpiWord(raw)).sort((a, b) => b[1] - a[1])[0];
    const label = scpi ? scpi[0] : names.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    for (const [raw] of names) out.set(raw, { key, label });
  }
  return out;
}

// ── housekeeping: IEEE-488.2 common commands ────────────────────────────────
// *CLS, *ESE, *IDN?, *RST ... are spelled with a leading '*' in their SCPI, and
// api.json files file them under a subsystem named "Common". Either marks one.

/** True when a variable is an IEEE-488.2 common command (status/ID/reset housekeeping). */
export function isCommonCommand(v, names = null) {
  if (/^\s*\*/.test(String(v?.scpi || ''))) return true;
  const key = names ? names.get(rawSubsystem(v))?.key : subsystemKey(rawSubsystem(v));
  return key === 'COMMON';
}

// ── the palette tree ────────────────────────────────────────────────────────

function compareSub(a, b) {
  return (a.common - b.common) || a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
}

/** A device's palette: verb (Set, Do, Rig, Get) -> sub-category -> variables.
    { count, verbs: [{ verb, label, count, subcategories: [{ key, label, count, common, variables }] }] }
    Every verb is present (count 0 when the device has none) unless
    opts.keepEmpty is false. Sub-categories are sorted by name, with the
    common-command housekeeping one last. Variables keep their api.json order.
    Counts add up: palette.count === variables.length for any variables whose
    verb is set/do/rig/get/nab. */
export function paletteOf(variables, { keepEmpty = true } = {}) {
  const vars = (variables || []).filter(v => paletteVerbOf(v));
  const names = subsystemNames(vars);
  const verbs = PALETTE_VERBS.map(verb => {
    const subs = new Map();
    for (const v of vars) {
      if (paletteVerbOf(v) !== verb) continue;
      const { key, label } = names.get(rawSubsystem(v));
      if (!subs.has(key)) subs.set(key, { key, label, count: 0, common: key === 'COMMON', variables: [] });
      const s = subs.get(key);
      s.variables.push(v);
      s.count += 1;
    }
    const subcategories = [...subs.values()].sort(compareSub);
    return {
      verb,
      label: VERB_LABEL[verb] || verb,
      count: subcategories.reduce((n, s) => n + s.count, 0),
      subcategories,
    };
  }).filter(n => keepEmpty || n.count);
  return { count: verbs.reduce((n, v) => n + v.count, 0), verbs };
}

/** The variables a grab bag brings: a whole verb, one sub-category (of one
    verb, or across all verbs), or everything. `verb` is a palette column
    ('get' brings nabs too); `subsystem` may be a raw name ('SENS'), its long
    form ('SENSe') or the merged key. Returned in palette order. */
export function grabBag(variables, { verb = '', subsystem = '' } = {}) {
  const tree = paletteOf(variables);
  const vKey = String(verb || '').toLowerCase();
  const pv = vKey ? PALETTE_VERB_OF[vKey] || vKey : '';
  let subKey = '';
  if (subsystem) {
    const names = subsystemNames((variables || []).filter(v => paletteVerbOf(v)));
    const hit = names.get(String(subsystem));
    subKey = hit ? hit.key : subsystemKey(subsystem);
    // A key that folds into a shorter one (e.g. 'SYSTEM' asked for, 'SYST' kept).
    if (!hit) {
      const merged = [...new Set([...names.values()].map(n => n.key))];
      if (!merged.includes(subKey)) subKey = merged.find(k => k.length >= MIN_FOLD && subKey.startsWith(k)) || subKey;
    }
  }
  const out = [];
  for (const node of tree.verbs) {
    if (pv && node.verb !== pv) continue;
    for (const s of node.subcategories) {
      if (subKey && s.key !== subKey) continue;
      out.push(...s.variables);
    }
  }
  return out;
}

// ── the "whole device" drop ─────────────────────────────────────────────────

// SCPI header of a command in short form, without arguments or '?':
// ':SENSe:VOLTage:DC:RANGe?' -> 'SENS:VOLT:DC:RANG'. Optional [nodes] dropped.
function scpiHeader(scpi) {
  const head = String(scpi || '').trim().split(/\s+/)[0].replace(/\?$/, '').replace(/\[[^\]]*\]/g, '');
  return head.split(':').filter(Boolean).map(n => (isScpiWord(n) ? n.match(/^[A-Z]+/)[0] : n.toUpperCase())).join(':');
}

/** True when a get only reads back what one of the device's own sets writes
    (same SCPI header, '?' instead of an argument): the set control already
    shows that value, so a whole-device drop leaves the readback out. */
export function readbackOf(v, setHeaders) {
  if (paletteVerbOf(v) !== 'get' || v.verb !== 'get') return false;
  const h = scpiHeader(v.scpi);
  return !!h && setHeaders.has(h);
}

/** The default "whole device palette" drop, as a documented rule rather than
    a list of names. A whole-device drag brings:
      - every Set, Do and Rig (what you can change or trigger),
      - every Get / Nab that is a reading of its own (a measurement, a fetch,
        an ID string) — not a readback of a Set the drop already brings,
    and leaves out, unless asked:
      - IEEE-488.2 common commands (SCPI starting '*', or subsystem "Common":
        *CLS, *ESE, *SRE, *STB? ...)            — opts.includeCommon
      - Gets that read back a Set's value       — opts.includeReadbacks
      - binary-block arguments (arbitrary waveform downloads), which no
        panel widget can enter                   — opts.includeBlocks
    opts.verbs limits the drop to some palette columns (default all four).
    Pass the result to devicePanel.panelFromVariables to lay it out. */
export function paletteFilter(variables, {
  includeCommon = false,
  includeReadbacks = false,
  includeBlocks = false,
  verbs = PALETTE_VERBS,
} = {}) {
  const vars = (variables || []).filter(v => paletteVerbOf(v));
  const names = subsystemNames(vars);
  const wanted = new Set((verbs || PALETTE_VERBS).map(v => PALETTE_VERB_OF[String(v).toLowerCase()] || v));
  const setHeaders = new Set(vars.filter(v => v.verb === 'set').map(v => scpiHeader(v.scpi)).filter(Boolean));
  const keep = new Set(vars.filter(v => {
    if (!wanted.has(paletteVerbOf(v))) return false;
    if (!includeCommon && isCommonCommand(v, names)) return false;
    if (!includeBlocks && v.kind === 'block') return false;
    if (!includeReadbacks && readbackOf(v, setHeaders)) return false;
    return true;
  }));
  // Palette order, so a dropped device reads like its column.
  return grabBag(vars).filter(v => keep.has(v));
}

// ── a device's own ins and outs ─────────────────────────────────────────────

function countBy(list, f) {
  const m = {};
  for (const x of list) {
    const k = f(x);
    m[k] = (m[k] || 0) + 1;
  }
  return m;
}

function subsSummary(list, names) {
  const m = new Map();
  for (const v of list) {
    const { key, label } = names.get(rawSubsystem(v));
    if (!m.has(key)) m.set(key, { key, label, count: 0, common: key === 'COMMON' });
    m.get(key).count += 1;
  }
  return [...m.values()].sort(compareSub);
}

/** A device's own ins and outs, for its column label.
    inputs  = what you can Set / Do / Rig;
    outputs = what it reports (Get / Nab), with how many publish a reading topic.
    { family, model, inputs: { count, byVerb, bySubcategory }, outputs: { count,
      byVerb, bySubcategory, readingTopics }, common, total, text } */
export function deviceIO(variables) {
  const vars = (variables || []).filter(v => paletteVerbOf(v));
  const names = subsystemNames(vars);
  const ins = vars.filter(v => INPUT_VERBS.includes(v.verb));
  const outs = vars.filter(v => OUTPUT_VERBS.includes(v.verb));
  const zero = list => Object.fromEntries(list.map(v => [v, 0]));
  const inputs = {
    count: ins.length,
    byVerb: { ...zero(INPUT_VERBS), ...countBy(ins, v => v.verb) },
    bySubcategory: subsSummary(ins, names),
  };
  const outputs = {
    count: outs.length,
    byVerb: { ...zero(OUTPUT_VERBS), ...countBy(outs, v => v.verb) },
    bySubcategory: subsSummary(outs, names),
    readingTopics: outs.filter(v => v.readingTopic).length,
  };
  return {
    family: vars[0]?.family || '',
    model: vars[0]?.model || '',
    inputs,
    outputs,
    common: vars.filter(v => isCommonCommand(v, names)).length,
    total: vars.length,
    text: `${inputs.count} in · ${outputs.count} out`,
  };
}
