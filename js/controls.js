// Part of APK.audio - Touch Panel Builder
// Ported from OneThing FEATURE.surfaceDesigner/controls
//
// Every control draws its look from CSS custom properties (--w-bg, --w-border,
// --w-accent, --w-text, --w-radius, --w-bw, --w-fs, --w-fw). A widget's `style`
// sets them on its element (widgetStyleVars); left unset, each falls back to
// the stock Deep Horizon look written beside it here.

const V = (name, fallback) => `var(--w-${name}, ${fallback})`;

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// What a control looks like — every field the schedule's style editor offers.
export const STYLE_FIELDS = [
  { key: 'bg', label: 'Background', kind: 'color' },
  { key: 'border', label: 'Border', kind: 'color' },
  { key: 'accent', label: 'Accent / Value', kind: 'color' },
  { key: 'text', label: 'Text', kind: 'color' },
  { key: 'cap', label: 'Cap / Knob', kind: 'color' },
  { key: 'capShape', label: 'Cap Shape', kind: 'select', options: ['circle', 'gear', 'octagon', 'chicken', 'skirt', 'flange', 'knurled', 'bakelite', 'concentric'] },
  { key: 'pointer', label: 'Pointer', kind: 'select', options: ['line', 'dot', 'triangle', 'notch', 'block', 'vintage'] },
  { key: 'faderCap', label: 'Fader Cap', kind: 'select', options: ['standard', 'square', 'tall', 'tbar', 'slim', 'chrome'] },
  { key: 'buttonShape', label: 'Button', kind: 'select', options: ['rect', 'round', 'square', 'lit', 'lamp', 'wink', 'toggle', 'piano', 'membrane'] },
  { key: 'radius', label: 'Corner Radius', kind: 'number', unit: 'px', min: 0, max: 60 },
  { key: 'borderWidth', label: 'Border Width', kind: 'number', unit: 'px', min: 0, max: 8 },
  { key: 'fontSize', label: 'Font Size', kind: 'number', unit: 'px', min: 6, max: 48 },
  { key: 'fontWeight', label: 'Font Weight', kind: 'select', options: ['400', '500', '600', '700', '800'] },
  { key: 'opacity', label: 'Opacity', kind: 'range', min: 0.1, max: 1, step: 0.05 },
  { key: 'shadow', label: 'Shadow', kind: 'select', options: ['none', 'soft', 'deep', 'glow'] },
];

// How a control behaves when touched.
export const BEHAVIOR_FIELDS = [
  { key: 'mode', label: 'Touch Mode', kind: 'select', options: ['momentary', 'toggle', 'latch', 'radio', 'display only'] },
  { key: 'min', label: 'Min', kind: 'number' },
  { key: 'max', label: 'Max', kind: 'number' },
  { key: 'step', label: 'Step', kind: 'number' },
  { key: 'default', label: 'Default / Shown Value', kind: 'text' },
  { key: 'unit', label: 'Unit', kind: 'text' },
  { key: 'taper', label: 'Taper', kind: 'select', options: ['linear', 'audio (log)', 'dB'] },
  { key: 'orientation', label: 'Orientation', kind: 'select', options: ['vertical', 'horizontal'] },
  { key: 'feedback', label: 'Feedback Address', kind: 'text' },
  { key: 'icon', label: 'Icon', kind: 'text' },
  { key: 'subtitle', label: 'Subtitle', kind: 'text' },
];

// One-click looks. Values only — a preset never touches behaviour.
export const STYLE_PRESETS = {
  'Deep Horizon': {},
  'Crestron Blue': { bg: '#0b2545', border: '#3b82f6', accent: '#60a5fa', text: '#e0f2fe', radius: 4, borderWidth: 1, shadow: 'soft' },
  'Q-SYS Graphite': { bg: '#2a2d33', border: '#52525b', accent: '#fbbf24', text: '#f4f4f5', radius: 2, borderWidth: 1, shadow: 'none' },
  'Alert Red': { bg: '#450a0a', border: '#ef4444', accent: '#f87171', text: '#fee2e2', radius: 8, borderWidth: 2, shadow: 'glow' },
  'Go Green': { bg: '#052e16', border: '#22c55e', accent: '#4ade80', text: '#dcfce7', radius: 8, borderWidth: 2, shadow: 'glow' },
  'Glass': { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.25)', accent: '#e2e8f0', text: '#f8fafc', radius: 14, borderWidth: 1, shadow: 'deep' },
  'Paper': { bg: '#f8fafc', border: '#94a3b8', accent: '#0f172a', text: '#0f172a', radius: 6, borderWidth: 1, shadow: 'soft' },
};

const SHADOWS = {
  none: 'none',
  soft: '0 2px 6px rgba(0,0,0,0.4)',
  deep: '0 10px 24px rgba(0,0,0,0.65)',
  glow: '0 0 14px var(--w-accent, #38bdf8)',
};

// The CSS a widget's style puts on its element.
export function widgetStyleVars(w) {
  const s = w?.style || {};
  const out = {};
  if (s.bg) out['--w-bg'] = s.bg;
  if (s.border) out['--w-border'] = s.border;
  if (s.accent) out['--w-accent'] = s.accent;
  if (s.text) out['--w-text'] = s.text;
  if (s.cap) out['--w-cap'] = s.cap;
  if (s.radius !== undefined && s.radius !== '') out['--w-radius'] = `${s.radius}px`;
  if (s.borderWidth !== undefined && s.borderWidth !== '') out['--w-bw'] = `${s.borderWidth}px`;
  if (s.fontSize) out['--w-fs'] = `${s.fontSize}px`;
  if (s.fontWeight) out['--w-fw'] = s.fontWeight;
  if (s.opacity !== undefined && s.opacity !== '') out.opacity = String(s.opacity);
  if (s.shadow && SHADOWS[s.shadow]) out['--w-shadow'] = SHADOWS[s.shadow];
  return out;
}

// Knob cap outline, from the library's visualization names to the shapes drawn here.
const CAP_SHAPE_OF = {
  gear: 'gear', crafty: 'gear', octagon: 'octagon', chicken: 'chicken', pedal: 'chicken',
  moog: 'skirt', british: 'skirt', marconi: 'skirt', 'wbs-elma': 'knurled', elma: 'knurled', knurled: 'knurled',
  api: 'concentric', concentric: 'concentric', bakelite: 'bakelite', vintage: 'bakelite',
  1176: 'flange', fender: 'flange', flange: 'flange', skirt: 'skirt', circle: 'circle', standard: 'circle',
};
const GEAR = 'polygon(50% 0%,59% 10%,71% 4%,75% 16%,88% 15%,86% 28%,98% 34%,90% 45%,98% 56%,87% 63%,89% 76%,76% 77%,72% 90%,60% 86%,50% 96%,40% 86%,28% 90%,24% 77%,11% 76%,13% 63%,2% 56%,10% 45%,2% 34%,14% 28%,12% 15%,25% 16%,29% 4%,41% 10%)';
const OCTAGON = 'polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)';

function pointerMark(kind) {
  const a = V('accent', '#38bdf8');
  switch (kind) {
    case 'dot': return `<div style="position:absolute; left:calc(50% - 3px); top:4px; width:6px; height:6px; border-radius:50%; background:${a};"></div>`;
    case 'triangle': return `<div style="position:absolute; left:calc(50% - 5px); top:2px; width:0; height:0; border-left:5px solid transparent; border-right:5px solid transparent; border-top:9px solid ${a};"></div>`;
    case 'notch': return `<div style="position:absolute; left:calc(50% - 2px); top:0; width:4px; height:10px; background:#000; box-shadow:inset 0 0 0 1px ${a};"></div>`;
    case 'block': return `<div style="position:absolute; left:calc(50% - 4px); top:2px; width:8px; height:13px; background:${a}; border-radius:1px;"></div>`;
    case 'vintage': return `<div style="position:absolute; left:calc(50% - 1px); top:1px; width:2px; height:calc(50% + 4px); background:${a};"></div>`;
    default: return `<div style="position:absolute; left:calc(50% - 1px); top:3px; width:2px; height:12px; background:${a};"></div>`;
  }
}

function knobCap(shape, pointer = 'line') {
  const s = CAP_SHAPE_OF[String(shape || '').toLowerCase()] || 'circle';
  const cap = V('cap', '#1e222b');
  const p = pointerMark(pointer);
  if (s === 'chicken') {
    return `<div style="position:relative; width:22px; height:44px; border-radius:11px 11px 40% 40%; background:${cap}; border:1px solid #111; box-shadow:0 3px 6px rgba(0,0,0,0.6); transform:rotate(30deg);">${p}</div>`;
  }
  if (s === 'knurled') {
    // Elma style: knurled black grip, bright index line, small metal centre.
    return `<div style="position:relative; width:40px; height:40px; border-radius:50%; background:repeating-conic-gradient(${cap} 0 7deg, #000 7deg 10deg); box-shadow:0 3px 6px rgba(0,0,0,0.7);">
      <div style="position:absolute; inset:8px; border-radius:50%; background:${cap}; border:1px solid #000;"></div>
      <div style="position:absolute; inset:16px; border-radius:50%; background:linear-gradient(135deg,#e5e7eb,#6b7280);"></div>${p}</div>`;
  }
  if (s === 'concentric') {
    // API style: small cap over a coloured skirt with a white index.
    return `<div style="position:relative; width:42px; height:42px; border-radius:50%; background:${V('accent', '#38bdf8')}; box-shadow:0 2px 6px rgba(0,0,0,0.6);">
      <div style="position:absolute; inset:7px; border-radius:50%; background:${cap}; border:1px solid #000;">${p}</div></div>`;
  }
  if (s === 'bakelite') {
    return `<div style="position:relative; width:42px; height:42px; border-radius:50%; background:radial-gradient(circle at 35% 30%, #5b4636, ${cap} 60%, #0b0806); box-shadow:0 4px 8px rgba(0,0,0,0.7);">${p}</div>`;
  }
  const clip = s === 'gear' ? `clip-path:${GEAR};` : s === 'octagon' ? `clip-path:${OCTAGON};` : '';
  const radius = s === 'gear' || s === 'octagon' ? '0' : '50%';
  const skirt = s === 'skirt' ? 'box-shadow:0 0 0 5px #c9ced3, 0 2px 6px rgba(0,0,0,0.6);'
    : s === 'flange' ? 'box-shadow:0 0 0 4px #2b2b2b, 0 0 0 5px #777, 0 2px 6px rgba(0,0,0,0.6);' : '';
  return `<div style="position:relative; width:38px; height:38px; border-radius:${radius}; ${clip} ${skirt} background:${cap}; border:1px solid #475569;">${p}</div>`;
}

// The fader's cap: the part of a console you recognise first.
function faderThumb(kind, horiz, frac = 0.3) {
  const cap = V('cap', '#475569');
  const a = V('accent', '#94a3b8');
  const pct = (10 + Math.max(0, Math.min(1, frac)) * 80).toFixed(1);
  const pos = horiz ? `left:${pct}%; top:50%; transform:translate(-50%,-50%) rotate(90deg); transition:left 0.15s ease-out;`
                    : `bottom:${pct}%; left:50%; transform:translateX(-50%); transition:bottom 0.15s ease-out;`;
  const at = (w, h, extra) => `<div style="position:absolute; ${pos} width:${w}px; height:${h}px; ${extra}"></div>`;
  switch (kind) {
    case 'square': return at(24, 24, `background:${cap}; border-radius:2px; border:1px solid #111; box-shadow:0 3px 5px rgba(0,0,0,0.6), inset 0 -10px 0 rgba(0,0,0,0.15); background-image:linear-gradient(${a},${a}); background-size:100% 2px; background-repeat:no-repeat; background-position:center;`);
    case 'tall': return at(26, 36, `background:${cap}; border-radius:3px 3px 6px 6px; border:1px solid #000; box-shadow:0 4px 6px rgba(0,0,0,0.6); background-image:linear-gradient(${a},${a}), repeating-linear-gradient(transparent 0 4px, rgba(0,0,0,0.25) 4px 5px); background-size:100% 3px, 100% 100%; background-repeat:no-repeat, repeat; background-position:center;`);
    case 'tbar': return at(40, 12, `background:linear-gradient(${cap},#111); border-radius:2px; border:1px solid #000; box-shadow:0 3px 4px rgba(0,0,0,0.6); border-top:2px solid ${a};`);
    case 'slim': return at(14, 26, `background:${cap}; border-radius:2px; border:1px solid rgba(0,0,0,0.5); box-shadow:0 2px 3px rgba(0,0,0,0.5); background-image:linear-gradient(#111,#111); background-size:100% 2px; background-repeat:no-repeat; background-position:center;`);
    case 'chrome': return at(30, 22, `background:linear-gradient(180deg,#f4f4f5,#9ca3af 45%,#e5e7eb 55%,#6b7280); border-radius:3px; border:1px solid #333; box-shadow:0 3px 5px rgba(0,0,0,0.6); border-top:2px solid ${a};`);
    default: return at(30, 18, `background:${cap}; border-radius:3px; border:1px solid ${a}; box-shadow:0 2px 4px rgba(0,0,0,0.5);`);
  }
}

// Buttons: every era pressed something different.
function buttonFace(kind, label, icon) {
  const t = `font-size:${V('fs', '11px')}; font-weight:${V('fw', '600')}; letter-spacing:0.5px;`;
  const a = V('accent', '#3b82f6');
  const full = 'width:100%; height:100%; box-sizing:border-box; display:flex; align-items:center; justify-content:center; gap:6px; cursor:pointer;';
  switch (kind) {
    case 'round':
      return `<div style="${full}"><div style="width:min(100%,46px); aspect-ratio:1; border-radius:50%; ${box('#242a38', '#111', '50%')} border-radius:50%; box-shadow:0 3px 0 #000, 0 4px 6px rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center;"></div>
        <span style="${t} color:${V('text', '#e2e8f0')};">${icon}${label}</span></div>`;
    case 'square':
      return `<div style="${full} ${box('#1f2329', '#000', '3px')} box-shadow:0 3px 0 #000; flex-direction:column; gap:3px;">
        <i style="width:8px; height:8px; border-radius:50%; background:${a}; box-shadow:0 0 6px ${a};"></i>
        <span style="${t} color:${V('text', '#e2e8f0')};">${icon}${label}</span></div>`;
    case 'lit':
      return `<div style="${full} border-radius:${V('radius', '3px')}; background:${a}; border:2px solid ${V('border', '#111')}; box-shadow:0 0 12px ${a}, inset 0 0 10px rgba(255,255,255,0.45);">
        <span style="${t} color:#111;">${icon}${label}</span></div>`;
    case 'lamp':
      return `<div style="${full}"><div style="width:30px; height:30px; border-radius:50%; background:radial-gradient(circle at 40% 35%, #fff, ${a} 45%, #000 120%); border:4px solid #8a8f94; box-shadow:0 0 14px ${a};"></div>
        <span style="${t} color:${V('text', '#e2e8f0')};">${icon}${label}</span></div>`;
    case 'wink':
      // The library's Wink: a lit window behind two shutters, half open.
      return `<div style="${full} position:relative; overflow:hidden; border-radius:${V('radius', '10px')}; background:${a}; border:2px solid ${V('border', '#333')};">
        <div style="position:absolute; left:0; right:0; top:0; height:32%; background:${V('bg', '#000')};"></div>
        <div style="position:absolute; left:0; right:0; bottom:0; height:32%; background:${V('bg', '#000')};"></div>
        <span style="position:relative; ${t} color:#000;">${icon}${label}</span>
        <div style="position:absolute; inset:0; background:linear-gradient(rgba(255,255,255,0.35), transparent 50%);"></div></div>`;
    case 'toggle':
      return `<div style="${full} flex-direction:column; gap:2px; ${box('#2a2d31', '#111', '4px')}">
        <div style="position:relative; width:18px; height:18px; border-radius:50%; background:radial-gradient(#d1d5db,#4b5563); border:1px solid #111;">
          <div style="position:absolute; left:6px; top:-14px; width:6px; height:20px; border-radius:3px; background:linear-gradient(90deg,#9ca3af,#f3f4f6,#6b7280); transform:rotate(-15deg); transform-origin:bottom;"></div></div>
        <span style="font-size:9px; font-weight:700; color:${V('text', '#e2e8f0')};">${icon}${label}</span></div>`;
    case 'piano':
      return `<div style="${full} align-items:flex-end; padding-bottom:6px; background:linear-gradient(${V('bg', '#e5e7eb')} 70%, rgba(0,0,0,0.35)); border:1px solid #111; border-radius:2px 2px 6px 6px; box-shadow:0 4px 0 #111;">
        <span style="${t} color:${V('text', '#111')};">${icon}${label}</span></div>`;
    case 'membrane':
      return `<div style="${full} flex-direction:column; ${box('#3d342b', '#000', '1px')}">
        <div style="width:70%; height:5px; background:${a};"></div>
        <span style="font-size:9px; color:${V('text', '#efe8dc')};">${icon}${label}</span></div>`;
    default:
      return `<div style="${full} ${box('#242a38', '#3b82f6', '6px')}">
        ${icon}<span style="${t} color:${V('text', '#e2e8f0')};">${label}</span></div>`;
  }
}

/* NOTHING UNPROVEN IS SHOWN CRISP (haze-until-proven). A value is the live
   one, or the panel's own words (behavior.default); otherwise the control
   wears the haze and says "—", never a made-up "1000 Hz" a person would read
   as the instrument. */
export const HAZE = '<span class="tp-haze" title="No reading proven yet — nothing is invented">—</span>';
const shownValue = (c) => {
  const b = c.behavior || {};
  if (c.value !== undefined && c.value !== null && c.value !== '' && c.value !== '—') return esc(c.value);
  if (b.default !== undefined && b.default !== '') return esc(`${b.default}${b.unit ? ' ' + b.unit : ''}`);
  return HAZE;
};

/* The words of a frame label ({En}, {text:{En}}, {inactive:{text}}), or ''. */
function words(l) {
  if (l == null) return '';
  if (typeof l === 'string' || typeof l === 'number') return String(l);
  if (typeof l === 'object') {
    if (l.inactive || l.active) return words(l.inactive || l.active);
    if ('text' in l) return words(l.text);
    return words(l.En ?? Object.values(l).find(v => typeof v === 'string'));
  }
  return '';
}

/* A toggler's options in order, from the frame field it carries. */
function optionList(field) {
  const o = field && field.options;
  if (!o || typeof o !== 'object') return [];
  const list = Array.isArray(o) ? o.map((v, i) => [String(i + 1), v]) : Object.entries(o);
  return list.filter(([, v]) => v && v.value != null)
    .sort(([a], [b]) => (Number(a) - Number(b)) || String(a).localeCompare(String(b)))
    .map(([, v]) => ({ value: String(v.value), label: words(v.label) || String(v.value) }));
}

/* The frame's own button colours (field.style.active / inactive), else the panel's. */
function faceOf(field, on) {
  const st = (field && field.style && field.style[on ? 'active' : 'inactive']) || {};
  return {
    bg: st.bg_color || (on ? '#000000' : '#2b2b2b'),
    fg: st.text_color || (on ? '#FF9900' : '#888888'),
    border: st.border_color || (on ? '#FF9900' : '#555555'),
    bw: Number(st.border_thickness) || 2,
  };
}

const box = (bg, border, radius) =>
  `background:${V('bg', bg)}; border:${V('bw', '1px')} solid ${V('border', border)}; border-radius:${V('radius', radius)}; box-shadow:${V('shadow', 'none')};`;

/* A rig's / nab's arguments, from behavior.args (objects or bare names). */
function rigArgs(c, fallback) {
  const raw = Array.isArray(c.behavior?.args) && c.behavior.args.length ? c.behavior.args : fallback;
  return raw.slice(0, 6).map(a => (typeof a === 'string' ? { name: a } : (a || { name: '?' })));
}

/** The height a rig / nab needs for n rows. */
export function rigHeight(n) {
  return 34 + 17 * Math.max(1, Math.min(6, n || 1));
}

export const CONTROL_DEFINITIONS = {
  fader: {
    type: 'fader',
    name: 'Motorized Fader',
    icon: '🎚️',
    w: 60,
    h: 180,
    render(c) {
      const horiz = c.behavior?.orientation === 'horizontal';
      const b = c.behavior || {};
      const min = Number(b.min);
      const max = Number(b.max);
      const numVal = parseFloat(String(c.value ?? b.default ?? '').replace(/^[^\d.+-]+/, ''));
      const frac = (Number.isFinite(numVal) && Number.isFinite(min) && Number.isFinite(max) && max > min)
        ? Math.max(0, Math.min(1, (numVal - min) / (max - min))) : (c.value != null && c.value !== '—' ? 0.5 : 0.3);
      const track = horiz
        ? `<div style="height:6px; width:80%; background:#0f1115; border-radius:3px; position:relative;">
            ${faderThumb(c.style?.faderCap, true, frac)}</div>`
        : `<div style="width:6px; flex:1; max-height:120px; background:#0f1115; border-radius:3px; position:relative;">
            ${faderThumb(c.style?.faderCap, false, frac)}</div>`;
      return `
        <div style="width:100%; height:100%; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; justify-content:space-between; gap:6px; padding:8px 0; ${box('#181b22', '#333948', '6px')}">
          <span style="font-size:${V('fs', '10px')}; font-weight:${V('fw', '400')}; color:${V('text', '#94a3b8')};">${c.label || 'LEVEL'}</span>
          ${track}
          <span style="font-size:9px; color:${V('accent', '#38bdf8')}; font-family:monospace;">${shownValue(c)}</span>
        </div>`;
    }
  },
  knob: {
    type: 'knob',
    name: 'Rotary Encoder',
    icon: '🔘',
    w: 80,
    h: 90,
    render(c) {
      const b = c.behavior || {};
      const min = Number(b.min);
      const max = Number(b.max);
      const numVal = parseFloat(String(c.value ?? b.default ?? '').replace(/^[^\d.+-]+/, ''));
      const frac = (Number.isFinite(numVal) && Number.isFinite(min) && Number.isFinite(max) && max > min)
        ? Math.max(0, Math.min(1, (numVal - min) / (max - min))) : 0.66;
      const deg = Math.round(frac * 270);
      const angle = -135 + deg;
      return `
        <div style="width:100%; height:100%; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; ${box('transparent', 'transparent', '6px')}">
          <div style="width:50px; height:50px; border-radius:50%; background:conic-gradient(${V('accent', '#38bdf8')} 0deg ${deg}deg, #1e293b ${deg}deg 360deg); display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.6);">
            <div style="transform:rotate(${angle}deg); transition:transform 0.15s ease-out; display:flex; align-items:center; justify-content:center;">
              ${knobCap(c.style?.capShape, c.style?.pointer)}
            </div>
          </div>
          <span style="font-size:${V('fs', '10px')}; font-weight:${V('fw', '400')}; color:${V('text', '#94a3b8')};">${c.label || 'GAIN'}</span>
        </div>`;
    }
  },
  button: {
    type: 'button',
    name: 'Push Button',
    icon: '⬛',
    w: 100,
    h: 50,
    render(c) {
      const icon = c.behavior?.icon ? `<span style="font-size:16px;">${c.behavior.icon}</span>` : '';
      return buttonFace(c.style?.buttonShape, c.label ?? 'MUTE', icon);
    }
  },
  meter: {
    type: 'meter',
    name: 'LED Peak Meter',
    icon: '📊',
    w: 40,
    h: 180,
    render(c) {
      const b = c.behavior || {};
      const min = Number(b.min);
      const max = Number(b.max);
      const numVal = parseFloat(String(c.value ?? b.default ?? '').replace(/^[^\d.+-]+/, ''));
      const frac = (Number.isFinite(numVal) && Number.isFinite(min) && Number.isFinite(max) && max > min)
        ? Math.max(0, Math.min(1, (numVal - min) / (max - min))) : (c.value != null && c.value !== '—' ? 0.5 : 0);
      const lit = Math.round(frac * 16);
      return `
        <div style="width:100%; height:100%; box-sizing:border-box; ${box('#13151b', '#2e3442', '4px')} padding:6px; display:flex; flex-direction:column; justify-content:space-between; align-items:center;">
          <div style="width:100%; flex:1; display:flex; flex-direction:column-reverse; gap:2px;">
            ${Array.from({ length: 16 }).map((_, i) => {
              const color = i > 13 ? '#ef4444' : i > 10 ? '#f59e0b' : V('accent', '#10b981');
              const opacity = i < lit ? '0.9' : '0.2';
              return `<div style="height:6px; background:${color}; opacity:${opacity}; border-radius:1px; transition:opacity 0.1s ease-out;"></div>`;
            }).join('')}
          </div>
          <span style="font-size:${V('fs', '8px')}; font-weight:${V('fw', '400')}; color:${V('text', '#64748b')}; margin-top:4px;">${c.label || 'CH 1'}</span>
        </div>`;
    }
  },
  tile: {
    type: 'tile',
    name: 'Source Selector Tile',
    icon: '🔲',
    w: 140,
    h: 90,
    render(c) {
      return `
        <div style="width:100%; height:100%; box-sizing:border-box; ${box('#1c2230', '#334155', '8px')} padding:12px; display:flex; flex-direction:column; justify-content:space-between;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:18px;">${c.behavior?.icon || c.icon || '📻'}</span>
            <span style="width:8px; height:8px; border-radius:50%; background:${V('accent', '#34d399')};"></span>
          </div>
          <div>
            <div style="font-size:${V('fs', '12px')}; font-weight:${V('fw', '600')}; color:${V('text', '#f1f5f9')};">${c.label || 'Apple Music'}</div>
            <div style="font-size:9px; color:#64748b;">${c.behavior?.subtitle || c.subtitle || 'Zone A · Active'}</div>
          </div>
        </div>`;
    }
  },
  /* A row of crosspoint buttons — ONE control bound to an ARRAY of elements:
     each button is its own connection (its channel in the command's argument),
     drawn with its label and its channel number the way the device window
     draws the frame (_GuiButtonToggler with options). Lit only when a reading
     proves it closed; never in the editor. */
  crosspoints: {
    type: 'crosspoints',
    name: 'Crosspoint Buttons',
    icon: '🔀',
    w: 640,
    h: 56,
    // Sized by the engine's own rules (ButtonToggler.jsx, FieldComponent's
    // toggler branch): a grid of max_cols equal columns, shrunk to its content
    // and centred, padx/pady gaps (5 when unset or 0), 10px padding, each button
    // layout.height tall — so a wire leaves from the button the engine draws.
    // Content-box, as the engine's: its button is the cell's width and
    // layout.height PLUS its border, so a border-box stand-in was 2 × border
    // smaller and every wire left ~2 px off the drawn button's middle
    // (measured on the 3235's EDAC rows, ROAD-3697).
    render(c) {
      const f = c.field || {};
      const lay = f.layout || {};
      const opts = optionList(f);
      const list = opts.length ? opts : Array.from({ length: 8 }, (_, i) => ({ value: String(i + 1), label: `Point ${i + 1}` }));
      const cols = Math.max(1, parseInt(lay.max_cols || 4, 10));
      const gx = parseInt(lay.padx || 5, 10);
      const gy = parseInt(lay.pady || 5, 10);
      const bh = typeof lay.height === 'number' ? lay.height : 50;
      const face = faceOf(f, false);
      const fs = (f.style && f.style.inactive && f.style.inactive.font_size) || 11;
      const cells = list.map(o => `<div class="tp-el" data-el="${esc(o.value)}" title="${esc(o.label)} · ${esc(o.value)}"
          style="box-sizing:content-box; width:100%; height:${bh}px; display:flex; align-items:center; justify-content:center; text-align:center; white-space:pre;
          background:${face.bg}; color:${face.fg}; border:${face.bw}px solid ${face.border}; border-radius:${Number(lay.corner_radius) || 6}px; font-size:${fs}px; line-height:1.1;">${esc(o.label)}
(${esc(o.value)})</div>`).join('');
      return `<div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center;">
        <div style="display:grid; grid-template-columns:repeat(${cols}, 1fr); gap:${gy}px ${gx}px; padding:10px; border-radius:5px; border:1px solid #444; background:#222;">${cells}</div></div>`;
    }
  },
  /* A crosspoint matrix — buses down, sources across, every cell its own
     channel (slot*100 + bus*10 + source), laid out by CrossMatrix.jsx's own
     sizes (name_width, cell width × height, 6px gaps) so a wire leaves from
     the cell the engine draws. */
  matrix: {
    type: 'matrix',
    name: 'Crosspoint Matrix',
    icon: '▦',
    w: 720,
    h: 180,
    render(c) {
      const f = c.field || {};
      const buses = Array.isArray(f.buses) && f.buses.length ? f.buses : [{ label: 'BUS 1' }, { label: 'BUS 2' }];
      const sources = Array.isArray(f.sources) && f.sources.length ? f.sources : [{ label: 'SRC 1' }, { label: 'SRC 2' }, { label: 'SRC 3' }, { label: 'SRC 4' }];
      const cell = f.cell || {};
      const cw = Number(cell.width) || 150; const chh = Number(cell.height) || 34; const nw = Number(cell.name_width) || 190;
      const slot = Number(f.slot) || 0;
      const face = faceOf(f, false);
      const ch = (b, s2) => String(slot * 100 + (b + 1) * 10 + (s2 + 1)).padStart(3, '0');
      const head = `<div style="display:flex; align-items:flex-end; gap:6px; margin-bottom:4px;">
          <div style="width:${nw}px; flex-shrink:0; color:#666; font-size:10px;">${esc(words(f.corner) || 'BUS \\ SOURCE')}</div>
          ${sources.map((src, i) => `<div style="width:${cw}px; flex-shrink:0; text-align:center; color:#ccc; font-size:11px; font-weight:bold; border-bottom:1px solid #444; padding-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(words(src.label))}<div style="color:#666; font-weight:normal; font-size:9px;">Ø${i + 1}</div></div>`).join('')}</div>`;
      const rows = buses.map((bus, b) => `<div style="display:flex; align-items:center; gap:6px; margin-bottom:3px;">
          <div style="width:${nw}px; flex-shrink:0; color:#ccc; font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(words(bus.label))} <span style="color:#666;">row ${(b + 1) * 10}</span></div>
          ${sources.map((_, s2) => `<div class="tp-el" data-el="${ch(b, s2)}" title="${esc(words(bus.label))} ← ${esc(words(sources[s2].label))} · ${ch(b, s2)}"
            style="box-sizing:border-box; width:${cw}px; height:${chh}px; flex-shrink:0; display:flex; align-items:center; justify-content:center; background:${face.bg}; color:${face.fg};
            border:${face.bw}px solid ${face.border}; border-radius:6px; font-size:11px;">${ch(b, s2)}</div>`).join('')}</div>`).join('');
      return `<div style="width:100%; height:100%; box-sizing:border-box; padding:4px 6px; overflow:hidden;">${head}${rows}</div>`;
    }
  },
  readout: {
    type: 'readout',
    name: 'Digital Readout',
    icon: '📟',
    w: 120,
    h: 45,
    render(c) {
      return `
        <div style="width:100%; height:100%; box-sizing:border-box; ${box('#0a0d12', '#222938', '4px')} padding:6px 10px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:9px; color:${V('text', '#64748b')};">${c.label || 'FREQ'}</span>
          <span style="font-size:${V('fs', '14px')}; font-family:monospace; color:${V('accent', '#38bdf8')}; font-weight:${V('fw', '700')};">${shownValue(c)}</span>
        </div>`;
    }
  },
  ltp: {
    type: 'ltp',
    name: 'LTP Travelling Pot',
    icon: '🎛️',
    w: 70,
    h: 220,
    // Linear Travelling Potentiometer: the cap rides the rail (level) and
    // turns (pan / second parameter) — libControl/faders/LTPFader.
    render(c) {
      return `
        <div style="width:100%; height:100%; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; justify-content:space-between; gap:6px; padding:8px 0; ${box('#16181d', '#333948', '6px')}">
          <span style="font-size:${V('fs', '10px')}; font-weight:${V('fw', '600')}; color:${V('text', '#94a3b8')};">${c.label || 'LTP'}</span>
          <div style="width:4px; flex:1; background:linear-gradient(${V('accent', '#38bdf8')} 0 45%, #0f1115 45%); border-radius:2px; position:relative;">
            <div style="position:absolute; top:40%; left:-15px; width:34px; height:34px; border-radius:50%; background:${V('cap', '#cfd2d6')}; border:2px solid #111; box-shadow:0 3px 6px rgba(0,0,0,0.6); transform:rotate(40deg);">
              <div style="position:absolute; left:15px; top:2px; width:3px; height:12px; background:#111; border-radius:1px;"></div>
            </div>
          </div>
          <span style="font-size:9px; color:${V('accent', '#38bdf8')}; font-family:monospace;">${shownValue(c)}</span>
        </div>`;
    }
  },
  mdp: {
    type: 'mdp',
    name: 'MDP XY Pad',
    icon: '✛',
    w: 180,
    h: 180,
    // Motion Draggable Potentiometer: one puck, two values (x, y).
    render(c) {
      return `
        <div style="width:100%; height:100%; box-sizing:border-box; position:relative; overflow:hidden; ${box('#0d1117', '#2e3442', '8px')}
          background-image:linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px); background-size:20% 20%;">
          <div style="position:absolute; left:62%; top:0; bottom:0; width:1px; background:${V('accent', '#38bdf8')}; opacity:0.5;"></div>
          <div style="position:absolute; top:38%; left:0; right:0; height:1px; background:${V('accent', '#38bdf8')}; opacity:0.5;"></div>
          <div style="position:absolute; left:calc(62% - 13px); top:calc(38% - 13px); width:26px; height:26px; border-radius:50%; background:${V('cap', '#e2e8f0')}; border:2px solid ${V('accent', '#38bdf8')}; box-shadow:0 0 10px ${V('accent', '#38bdf8')};"></div>
          <span style="position:absolute; left:8px; bottom:6px; font-size:${V('fs', '10px')}; font-weight:${V('fw', '600')}; color:${V('text', '#94a3b8')};">${c.label || 'MDP'}</span>
        </div>`;
    }
  },
  cmdp: {
    type: 'cmdp',
    name: 'CMDP Circular Panner',
    icon: '◎',
    w: 220,
    h: 220,
    // Circular Motion Displacement Potentiometer: every channel a radial
    // fader around one centre — libControl/special/CMDP.
    render(c) {
      const n = Math.max(3, Math.min(16, parseInt(c.behavior?.channels, 10) || 8));
      const spokes = Array.from({ length: n }).map((_, i) => {
        const a = (i / n) * 360;
        const r = 28 + ((i * 37) % 50);
        return `<div style="position:absolute; left:50%; top:50%; width:2px; height:44%; background:rgba(148,163,184,0.35); transform-origin:top center; transform:rotate(${a}deg) translateY(10%);">
          <div style="position:absolute; left:-6px; top:${r}%; width:14px; height:14px; border-radius:50%; background:${V('cap', '#e2e8f0')}; border:2px solid ${V('accent', '#38bdf8')};"></div></div>`;
      }).join('');
      return `
        <div style="width:100%; height:100%; box-sizing:border-box; position:relative; overflow:hidden; ${box('#0d1117', '#2e3442', '50%')}">
          ${spokes}
          <div style="position:absolute; left:50%; top:50%; width:22px; height:22px; margin:-11px 0 0 -11px; border-radius:50%; background:${V('accent', '#38bdf8')};"></div>
          <span style="position:absolute; left:0; right:0; bottom:8%; text-align:center; font-size:${V('fs', '10px')}; font-weight:${V('fw', '600')}; color:${V('text', '#94a3b8')};">${c.label || 'CMDP'}</span>
        </div>`;
    }
  },
  vu: {
    type: 'vu',
    name: 'Needle VU Meter',
    icon: '◔',
    w: 260,
    h: 160,
    render(c) {
      const b = c.behavior || {};
      const numVal = parseFloat(String(c.value ?? b.default ?? '').replace(/^[^\d.+-]+/, ''));
      const unit = b.unit || 'V';
      
      // Calculate 10X mantissa and scale decade
      let mantissa = 0;
      let scaleMultText = '×1';
      
      if (Number.isFinite(numVal) && numVal !== 0) {
        const abs = Math.abs(numVal);
        if (abs > 1e30) {
          mantissa = 10;
          scaleMultText = 'OVERLOAD';
        } else {
          const scaleExp = Math.floor(Math.log10(abs));
          mantissa = abs / Math.pow(10, scaleExp);
          if (scaleExp !== 0) {
            scaleMultText = scaleExp === 1 ? '×10' : scaleExp === 2 ? '×100' : scaleExp === 3 ? '×1k' : scaleExp === 6 ? '×1M' : scaleExp === -3 ? '×1m' : `×10^${scaleExp}`;
          }
        }
      } else if (numVal === 0) {
        mantissa = 0;
        scaleMultText = '×1';
      }

      // 10X Scale spans 0 to 10
      const clampedMantissa = Math.max(0, Math.min(10, mantissa));
      
      const cx = 130;
      const cy = 145;
      const R = 96;
      // View angle 76 deg, centered at 90 deg (standard analog VU geometry)
      const startDeg = 128;
      const sweepDeg = 76;
      const angOf = (v) => (startDeg - (v / 10) * sweepDeg) * Math.PI / 180;
      
      const arcPath = (v1, v2) => {
        const a1 = angOf(v1);
        const a2 = angOf(v2);
        const x1 = cx + R * Math.cos(a1);
        const y1 = cy - R * Math.sin(a1);
        const x2 = cx + R * Math.cos(a2);
        const y2 = cy - R * Math.sin(a2);
        return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
      };
      
      const ticks = [];
      for (let i = 0; i <= 10; i++) {
        const rad = angOf(i);
        const isMajor = i % 2 === 0;
        const tickLen = isMajor ? 10 : 6;
        const x1 = cx + R * Math.cos(rad);
        const y1 = cy - R * Math.sin(rad);
        const x2 = cx + (R - tickLen) * Math.cos(rad);
        const y2 = cy - (R - tickLen) * Math.sin(rad);
        const stroke = i >= 8.5 ? '#dc2626' : (i >= 7 ? '#d97706' : '#222');
        ticks.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${stroke}" stroke-width="${isMajor ? 2 : 1}"/>`);
        
        if (i < 10) {
          const subRad = angOf(i + 0.5);
          const sx1 = cx + R * Math.cos(subRad);
          const sy1 = cy - R * Math.sin(subRad);
          const sx2 = cx + (R - 4) * Math.cos(subRad);
          const sy2 = cy - (R - 4) * Math.sin(subRad);
          ticks.push(`<line x1="${sx1.toFixed(1)}" y1="${sy1.toFixed(1)}" x2="${sx2.toFixed(1)}" y2="${sy2.toFixed(1)}" stroke="#444" stroke-width="0.75"/>`);
        }

        if (isMajor) {
          const tx = cx + (R - 19) * Math.cos(rad);
          const ty = cy - (R - 19) * Math.sin(rad);
          ticks.push(`<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="10" font-family="system-ui, sans-serif" font-weight="700" fill="${stroke}">${i}</text>`);
        }
      }

      const needleRot = -38 + (clampedMantissa / 10) * 76;
      const needleLen = R + 4;
      const displayVal = c.value !== undefined && c.value !== null && c.value !== '' ? c.value : '—';

      return `
        <div style="width:100%; height:100%; box-sizing:border-box; position:relative; overflow:hidden; ${box('#efe3bd', '#3b3325', '6px')}">
          <svg viewBox="0 0 260 160" style="width:100%; height:100%; display:block;">
            <defs>
              <filter id="needle-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.4"/>
              </filter>
            </defs>
            <path d="${arcPath(0, 7)}" fill="none" stroke="#222" stroke-width="2"/>
            <path d="${arcPath(7, 8.5)}" fill="none" stroke="#d97706" stroke-width="2.5"/>
            <path d="${arcPath(8.5, 10)}" fill="none" stroke="#dc2626" stroke-width="3.5"/>
            ${ticks.join('')}
            <text x="130" y="78" text-anchor="middle" font-family="serif" font-weight="700" font-size="14" fill="#222">VU</text>
            <text x="130" y="94" text-anchor="middle" font-family="monospace" font-weight="700" font-size="10" fill="#475569">10X · ${esc(scaleMultText)} ${esc(unit)}</text>
            <text x="14" y="148" font-size="10" font-weight="700" fill="#222">${esc(c.label || 'READING')}</text>
            <text x="246" y="148" text-anchor="end" font-family="monospace" font-size="10" font-weight="700" fill="#222">${esc(displayVal)}</text>
            <g style="transform-origin: ${cx}px ${cy}px; transform: rotate(${needleRot.toFixed(1)}deg); transition: transform 0.2s ease-out;">
              <line x1="${cx}" y1="${cy}" x2="${cx}" y2="${cy - needleLen}" stroke="#111" stroke-width="2" stroke-linecap="round" filter="url(#needle-shadow)"/>
            </g>
            <circle cx="${cx}" cy="${cy}" r="11" fill="#1e222b" stroke="#3b3325" stroke-width="2"/>
            <circle cx="${cx}" cy="${cy}" r="4" fill="#f59e0b"/>
          </svg>
        </div>`;
    }
  },
  rig: {
    type: 'rig',
    name: 'Rig (multi-input command)',
    icon: '🧰',
    w: 230,
    h: 104,
    // One command, 2–4 arguments sent together (APPLy:SIN freq, amp, offset):
    // a row per argument and one SEND key. The arguments are behavior.args.
    render(c) {
      const args = rigArgs(c, ['A', 'B']);
      return `
        <div style="width:100%; height:100%; box-sizing:border-box; ${box('#141821', '#3a3248', '6px')} padding:6px 8px; display:flex; flex-direction:column; gap:3px;">
          <span style="font-size:${V('fs', '10px')}; font-weight:${V('fw', '700')}; color:${V('text', '#e2e8f0')}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.label || 'RIG'}</span>
          ${args.map(a => `<div style="display:flex; align-items:center; gap:6px; font-size:9px;">
            <span style="flex:0 0 38%; color:#94a3b8; text-transform:uppercase; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${a.name}</span>
            <span style="flex:1; background:#0a0d12; border:1px solid #2a3140; border-radius:3px; padding:1px 5px; font-family:monospace; color:${V('accent', '#a78bfa')}; white-space:nowrap; overflow:hidden;">${a.values ? a.values[0] : '—'}${a.unit ? ` ${a.unit}` : ''}</span>
          </div>`).join('')}
          <span style="margin-top:auto; align-self:flex-end; font-size:9px; font-weight:700; color:#0a0d12; background:${V('accent', '#a78bfa')}; border-radius:3px; padding:2px 8px;">SEND</span>
        </div>`;
    }
  },
  nab: {
    type: 'nab',
    name: 'Nab (multi-value read)',
    icon: '🧲',
    w: 230,
    h: 104,
    // One read that answers several things: a readout per field and a READ key.
    render(c) {
      const args = rigArgs(c, ['VALUE']);
      return `
        <div style="width:100%; height:100%; box-sizing:border-box; ${box('#0d1218', '#23384a', '6px')} padding:6px 8px; display:flex; flex-direction:column; gap:3px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:${V('fs', '10px')}; font-weight:${V('fw', '700')}; color:${V('text', '#e2e8f0')}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.label || 'NAB'}</span>
            <span style="font-size:9px; font-weight:700; color:#0a0d12; background:${V('accent', '#38bdf8')}; border-radius:3px; padding:1px 7px;">READ</span>
          </div>
          ${args.map(a => `<div style="display:flex; justify-content:space-between; gap:6px; font-size:9px;">
            <span style="color:#64748b; text-transform:uppercase; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${a.name}</span>
            <span style="font-family:monospace; color:${V('accent', '#38bdf8')};">—${a.unit ? ` ${a.unit}` : ''}</span>
          </div>`).join('')}
        </div>`;
    }
  },
  selector: {
    type: 'selector',
    name: 'Rotary Selector',
    icon: '🎚',
    w: 220,
    h: 220,
    render(c) {
      const b = c.behavior || {};
      const values = b.values && b.values.length ? b.values : (Array.isArray(b.positions) ? b.positions : []);
      const n = Math.max(2, Math.min(12, values.length || parseInt(b.positions, 10) || 6));
      const effectiveValues = values.length ? values : Array.from({ length: n }, (_, i) => String(i + 1));
      const labels = b.labels && b.labels.length ? b.labels : effectiveValues;
      const cur = String(c.value !== '—' && c.value != null ? c.value : b.default ?? '').trim();
      let idx = -1;
      if (cur) {
        idx = effectiveValues.findIndex(v => String(v).toUpperCase() === cur.toUpperCase());
        if (idx === -1) idx = labels.findIndex(l => String(l).toUpperCase() === cur.toUpperCase());
      }
      if (idx === -1 && b.default) {
        const d = String(b.default).toUpperCase();
        idx = effectiveValues.findIndex(v => String(v).toUpperCase() === d);
        if (idx === -1) idx = labels.findIndex(l => String(l).toUpperCase() === d);
      }
      if (idx === -1) idx = 0;
      const angle = n > 1 ? -135 + (270 / (n - 1)) * idx : 0;

      const cx = 110;
      const cy = 105;
      const radius = 46;
      const sweepAngle = 270;
      const angleStep = n > 1 ? sweepAngle / (n - 1) : 0;

      const ticksAndLabels = effectiveValues.map((v, i) => {
        const posAngle = -135 + i * angleStep;
        const rad = (90 - posAngle) * Math.PI / 180;
        const isActive = i === idx;
        const stroke = isActive ? '#f59e0b' : '#64748b';
        const labelColor = isActive ? '#f59e0b' : '#94a3b8';
        const fontWeight = isActive ? '700' : '500';

        const x1 = cx + (radius + 4) * Math.cos(rad);
        const y1 = cy - (radius + 4) * Math.sin(rad);
        const x2 = cx + (radius + 12) * Math.cos(rad);
        const y2 = cy - (radius + 12) * Math.sin(rad);

        const lx = cx + (radius + 28) * Math.cos(rad);
        const ly = cy - (radius + 28) * Math.sin(rad);

        return `<g class="sel-pos" data-pos="${i}" data-v="${esc(v)}" style="cursor:pointer;">
          <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${stroke}" stroke-width="${isActive ? 2.5 : 1.5}" stroke-linecap="round"/>
          <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-size="9" font-family="system-ui, sans-serif" font-weight="${fontWeight}" fill="${labelColor}">${esc(labels[i] || v)}</text>
        </g>`;
      }).join('');

      return `
        <div style="width:100%; height:100%; box-sizing:border-box; position:relative; ${box('transparent', 'transparent', '6px')}">
          <svg viewBox="0 0 220 220" style="width:100%; height:100%; display:block;">
            <defs>
              <radialGradient id="knob-face" cx="40%" cy="35%" r="60%">
                <stop offset="0%" stop-color="#3d434f"/>
                <stop offset="60%" stop-color="#242830"/>
                <stop offset="100%" stop-color="#14171d"/>
              </radialGradient>
              <filter id="knob-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.6"/>
              </filter>
            </defs>
            ${ticksAndLabels}
            <g style="transform-origin: ${cx}px ${cy}px; transform: rotate(${angle}deg); transition: transform 0.2s ease-out;">
              <circle cx="${cx}" cy="${cy}" r="${radius}" fill="url(#knob-face)" stroke="#525969" stroke-width="2" filter="url(#knob-shadow)"/>
              <circle cx="${cx}" cy="${cy}" r="${radius - 6}" fill="none" stroke="#16181d" stroke-width="1.5"/>
              <line x1="${cx}" y1="${cy - 8}" x2="${cx}" y2="${cy - radius + 2}" stroke="#f59e0b" stroke-width="3.5" stroke-linecap="round"/>
            </g>
            <text x="${cx}" y="208" text-anchor="middle" font-size="11" font-weight="700" letter-spacing="0.05em" font-family="system-ui, sans-serif" fill="#94a3b8">${esc(c.label || 'SELECTOR')}</text>
          </svg>
        </div>`;
    }
  },
  trace: {
    // A monitoring box's waveform or spectrum (ROAD-3516, js/tracePanel.js): one
    // lane per source, points 0..255 bottom to top, drawn — never a text readout.
    type: 'trace',
    name: 'Trace',
    icon: '〰️',
    w: 320,
    h: 180,
    render(c) {
      const traces = Array.isArray(c.trace) && c.trace.length ? c.trace : null;
      const n = traces ? traces.length : 1;
      const lane = 256 / n;
      const COLOURS = ['#5aff7a', '#ffd400', '#5a9dff', '#ff6eb4'];
      const lines = (traces || []).map((t, i) => {
        const pts = t.points || [];
        const k = pts.length > 1 ? 1000 / (pts.length - 1) : 0;
        const d = pts.map((p, j) => `${(j * k).toFixed(1)},${(lane * (i + 1) - (p / 255) * lane).toFixed(1)}`).join(' ');
        return `<polyline points="${d}" fill="none" stroke="${COLOURS[i % COLOURS.length]}" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
          <text x="6" y="${(lane * i + 14).toFixed(1)}" font-size="11" fill="#64748b" font-family="monospace">${String(t.source || '').replace(/[<&]/g, '')}</text>`;
      }).join('');
      const grid = Array.from({ length: n }, (_, i) => `<line x1="0" x2="1000" y1="${(lane * i + lane / 2).toFixed(1)}" y2="${(lane * i + lane / 2).toFixed(1)}" stroke="#1e293b" vector-effect="non-scaling-stroke"/>`).join('');
      return `
        <div style="width:100%; height:100%; box-sizing:border-box; ${box('#0a0d12', '#222938', '6px')} position:relative; overflow:hidden;">
          <svg viewBox="0 0 1000 256" preserveAspectRatio="none" style="position:absolute; inset:0; width:100%; height:100%;">${grid}${lines}</svg>
          <span style="position:absolute; right:8px; top:4px; font-size:${V('fs', '10px')}; font-weight:${V('fw', '700')}; color:${V('text', '#94a3b8')};">${c.label || 'TRACE'}</span>
          ${traces ? '' : `<span style="position:absolute; left:0; right:0; top:45%; text-align:center; font-size:11px; color:#64748b;">no trace yet</span>`}
        </div>`;
    }
  }
};
