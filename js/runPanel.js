// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
/* runPanel.js — WHAT A TOUCH ON THE RUNNING PANEL PUTS ON THE WIRE.

   The runner (run.html) drives the instrument the way the OS's own frames do:
   through KOMAND, which listens on `{ROOT}/Gui/#` and works in two halves
   (AUDIO.komand/src/mqtt.rs, and OS/Komands/send/send-komand.js says it at
   length):
     <topic>/config   {"komand_handler": {…}}   teaches it what <topic> means
     <topic>          {"value": X}               fires it
   in that order, NEVER retained — KOMAND ignores a retained value on purpose
   (a reconnect replaying every panel would re-fire a *RST at every box).
   A DO or NAB fires on the truthy edge only, so a momentary press sends true
   and its release false, exactly like a frame button.

   A rig's arguments are sibling values under `<parent>/Input/<name>`: KOMAND
   folds every `Input/*` beside the firing topic into the payload.

   Pure: no DOM, no bus. run.html feeds it widgets; the tests feed it fixtures. */

/** The topic one control of one running panel answers on, under the Gui tree
    KOMAND listens to. guiTopic: APKContracts.Topics.gui.topic (path -> topic). */
export function controlTopic(guiTopic, panelKey, widgetId) {
  const seg = (s) => String(s || '').replace(/[^A-Za-z0-9._-]+/g, '_') || '_';
  return guiTopic(['TouchPanels', seg(panelKey), seg(widgetId)]);
}

/** The handler KOMAND is taught for a control: the frame's own, else one built
    from its binding (an api.json panel), aimed at the box's Write topic. */
export function handlerFor(widget, writeTopic = '') {
  if (widget && widget.komand && widget.komand.command) {
    const h = { ...widget.komand, enable: widget.komand.enable !== false };
    if (!h.target) h.target = writeTopic;
    return h;
  }
  const b = widget && (widget.bindings || [])[0];
  if (!b || !b.command) return null;
  return {
    enable: true, komand_type: b.verb || 'set', command: b.command, model: b.model || '',
    input_name: '', sub_path: '', converter: '', readback: '',
    target: writeTopic || '', params: {},
  };
}

/** The verb a control fires, lower-case. */
export function verbOf(widget) {
  const h = handlerFor(widget);
  return h ? String(h.komand_type || 'set').toLowerCase() : '';
}

/** The messages, in order, that fire `handler` with `value` at `topic`. */
export function fireMessages(topic, handler, value, args = null) {
  const out = [{ topic: `${topic}/config`, payload: JSON.stringify({ komand_handler: handler }) }];
  if (args && typeof args === 'object') {
    const parent = topic.slice(0, topic.lastIndexOf('/'));
    for (const [name, v] of Object.entries(args)) {
      if (v === '' || v === undefined || v === null) continue;
      out.push({ topic: `${parent}/Input/${name}`, payload: JSON.stringify({ value: v }) });
    }
  }
  out.push({ topic, payload: JSON.stringify({ value }) });
  return out;
}

/** How a touch on this control behaves on the glass. */
export function touchKind(widget) {
  const v = verbOf(widget);
  const b = (widget && widget.behavior) || {};
  if (!v) return 'none';                                  // nothing bound: it only shows
  if (Array.isArray(b.args) && b.args.length) return 'args';
  if (Array.isArray(b.values) && b.values.length) return 'choose';
  if (widget.type === 'button') return b.mode === 'momentary' || v === 'do' ? 'press' : 'toggle';
  if (v === 'do' || v === 'nab' || v === 'get') return 'press';
  if (['knob', 'fader', 'ltp', 'selector', 'tile', 'readout', 'mdp', 'cmdp'].includes(widget.type)) return 'number';
  return 'press';
}

/** A number typed on the glass, kept inside the control's own range. */
export function clampValue(raw, behavior = {}) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  let v = n;
  if (Number.isFinite(behavior.min)) v = Math.max(behavior.min, v);
  if (Number.isFinite(behavior.max)) v = Math.min(behavior.max, v);
  return v;
}

/** A reading as the glass shows it: {value} unwrapped, a bare value as is, anything else short. */
export function readingText(text, unit = '') {
  const raw = String(text ?? '').trim();
  if (!raw) return '';
  let v = raw;
  try {
    const j = JSON.parse(raw);
    if (j && typeof j === 'object' && !Array.isArray(j) && 'value' in j) v = j.value;
    else v = j;
  } catch (_) { /* plain text */ }
  if (v && typeof v === 'object') v = JSON.stringify(v);
  let s = String(v);
  if (s.length > 24) s = `${s.slice(0, 23)}…`;
  return unit && /^-?[\d.]+(e[-+]?\d+)?$/i.test(s) ? `${s} ${unit}` : s;
}

/** The topics a running panel listens to: each control's readback, never a Write topic. */
export function readbackTopics(widgets) {
  const map = new Map();
  for (const w of widgets || []) {
    const t = String(w.address || '');
    if (!t.startsWith('APK.audio/') || /\/(Write|Control)$/.test(t) || /[#+]/.test(t)) continue;
    if (!map.has(t)) map.set(t, []);
    map.get(t).push(w);
  }
  return map;
}

/** The broker a page outside the OS shell dials: config `broker_urls`, `{host}` = this page's host. */
export function brokerFor(cfg, hostname) {
  const list = Array.isArray(cfg && cfg.broker_urls) ? cfg.broker_urls : [];
  return list.map(u => String(u || '').replace('{host}', hostname || '127.0.0.1')).filter(Boolean);
}
