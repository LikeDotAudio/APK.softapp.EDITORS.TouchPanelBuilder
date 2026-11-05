// Part of APK.audio - Touch Panel Builder
// Ported from OneThing FEATURE.surfaceDesigner/controls
//
// Every control draws its look from CSS custom properties (--w-bg, --w-border,
// --w-accent, --w-text, --w-radius, --w-bw, --w-fs, --w-fw). A widget's `style`
// sets them on its element (widgetStyleVars); left unset, each falls back to
// the stock Deep Horizon look written beside it here.

const V = (name, fallback) => `var(--w-${name}, ${fallback})`;

// What a control looks like — every field the schedule's style editor offers.
export const STYLE_FIELDS = [
  { key: 'bg', label: 'Background', kind: 'color' },
  { key: 'border', label: 'Border', kind: 'color' },
  { key: 'accent', label: 'Accent / Value', kind: 'color' },
  { key: 'text', label: 'Text', kind: 'color' },
  { key: 'cap', label: 'Cap / Knob', kind: 'color' },
  { key: 'capShape', label: 'Cap Shape', kind: 'select', options: ['circle', 'gear', 'octagon', 'chicken', 'skirt', 'flange'] },
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
  { key: 'page', label: 'Page / Tab', kind: 'text' },
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
  moog: 'skirt', api: 'skirt', british: 'skirt', marconi: 'skirt', 'wbs-elma': 'skirt',
  1176: 'flange', fender: 'flange', flange: 'flange', skirt: 'skirt', circle: 'circle', standard: 'circle',
};
const GEAR = 'polygon(50% 0%,59% 10%,71% 4%,75% 16%,88% 15%,86% 28%,98% 34%,90% 45%,98% 56%,87% 63%,89% 76%,76% 77%,72% 90%,60% 86%,50% 96%,40% 86%,28% 90%,24% 77%,11% 76%,13% 63%,2% 56%,10% 45%,2% 34%,14% 28%,12% 15%,25% 16%,29% 4%,41% 10%)';
const OCTAGON = 'polygon(30% 0,70% 0,100% 30%,100% 70%,70% 100%,30% 100%,0 70%,0 30%)';

function knobCap(shape) {
  const s = CAP_SHAPE_OF[String(shape || '').toLowerCase()] || 'circle';
  const pointer = `<div style="width:2px; height:12px; background:${V('accent', '#38bdf8')}; transform:translateY(-8px);"></div>`;
  if (s === 'chicken') {
    return `<div style="width:22px; height:44px; border-radius:11px 11px 40% 40%; background:${V('cap', '#1e222b')}; border:1px solid #475569; display:flex; justify-content:center; padding-top:3px; box-sizing:border-box; transform:rotate(30deg);">
      <div style="width:2px; height:12px; background:${V('accent', '#f2f2f2')};"></div></div>`;
  }
  const clip = s === 'gear' ? `clip-path:${GEAR};` : s === 'octagon' ? `clip-path:${OCTAGON};` : '';
  const radius = s === 'gear' || s === 'octagon' ? '0' : '50%';
  const skirt = s === 'skirt' ? 'box-shadow:0 0 0 5px #c9ced3, 0 2px 6px rgba(0,0,0,0.6);'
    : s === 'flange' ? 'box-shadow:0 0 0 4px #2b2b2b, 0 0 0 5px #777, 0 2px 6px rgba(0,0,0,0.6);' : '';
  return `<div style="width:38px; height:38px; border-radius:${radius}; ${clip} ${skirt} background:${V('cap', '#1e222b')}; border:1px solid #475569; display:flex; align-items:center; justify-content:center;">${pointer}</div>`;
}

const shownValue = (c, fallback) => {
  const b = c.behavior || {};
  if (c.value !== undefined && c.value !== null && c.value !== '') return c.value;
  if (b.default !== undefined && b.default !== '') return `${b.default}${b.unit ? ' ' + b.unit : ''}`;
  return fallback;
};

const box = (bg, border, radius) =>
  `background:${V('bg', bg)}; border:${V('bw', '1px')} solid ${V('border', border)}; border-radius:${V('radius', radius)}; box-shadow:${V('shadow', 'none')};`;

export const CONTROL_DEFINITIONS = {
  fader: {
    type: 'fader',
    name: 'Motorized Fader',
    icon: '🎚️',
    w: 60,
    h: 180,
    render(c) {
      const horiz = c.behavior?.orientation === 'horizontal';
      const track = horiz
        ? `<div style="height:6px; width:80%; background:#0f1115; border-radius:3px; position:relative;">
            <div style="position:absolute; left:60%; top:-6px; width:18px; height:18px; background:${V('cap', '#475569')}; border-radius:3px; border:1px solid ${V('accent', '#94a3b8')};"></div></div>`
        : `<div style="width:6px; flex:1; max-height:120px; background:#0f1115; border-radius:3px; position:relative;">
            <div style="position:absolute; bottom:30%; left:-12px; width:30px; height:18px; background:${V('cap', '#475569')}; border-radius:3px; border:1px solid ${V('accent', '#94a3b8')}; box-shadow:0 2px 4px rgba(0,0,0,0.5);"></div></div>`;
      return `
        <div style="width:100%; height:100%; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; justify-content:space-between; gap:6px; padding:8px 0; ${box('#181b22', '#333948', '6px')}">
          <span style="font-size:${V('fs', '10px')}; font-weight:${V('fw', '400')}; color:${V('text', '#94a3b8')};">${c.label || 'LEVEL'}</span>
          ${track}
          <span style="font-size:9px; color:${V('accent', '#38bdf8')}; font-family:monospace;">${shownValue(c, '-6 dB')}</span>
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
      return `
        <div style="width:100%; height:100%; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; ${box('transparent', 'transparent', '6px')}">
          <div style="width:50px; height:50px; border-radius:50%; background:conic-gradient(${V('accent', '#38bdf8')} 0deg 240deg, #1e293b 240deg 360deg); display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.6);">
            ${knobCap(c.style?.capShape)}
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
      return `
        <div style="width:100%; height:100%; box-sizing:border-box; display:flex; align-items:center; justify-content:center; gap:6px; ${box('#242a38', '#3b82f6', '6px')} cursor:pointer;">
          ${icon}<span style="font-size:${V('fs', '11px')}; font-weight:${V('fw', '600')}; color:${V('text', '#e2e8f0')}; letter-spacing:0.5px;">${c.label || 'MUTE'}</span>
        </div>`;
    }
  },
  meter: {
    type: 'meter',
    name: 'LED Peak Meter',
    icon: '📊',
    w: 40,
    h: 180,
    render(c) {
      return `
        <div style="width:100%; height:100%; box-sizing:border-box; ${box('#13151b', '#2e3442', '4px')} padding:6px; display:flex; flex-direction:column; justify-content:space-between; align-items:center;">
          <div style="width:100%; flex:1; display:flex; flex-direction:column-reverse; gap:2px;">
            ${Array.from({ length: 16 }).map((_, i) => {
              const color = i > 13 ? '#ef4444' : i > 10 ? '#f59e0b' : V('accent', '#10b981');
              const opacity = i < 9 ? '0.9' : '0.2';
              return `<div style="height:6px; background:${color}; opacity:${opacity}; border-radius:1px;"></div>`;
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
          <span style="font-size:${V('fs', '14px')}; font-family:monospace; color:${V('accent', '#38bdf8')}; font-weight:${V('fw', '700')};">${shownValue(c, '1000 Hz')}</span>
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
          <span style="font-size:9px; color:${V('accent', '#38bdf8')}; font-family:monospace;">${shownValue(c, '-4 dB · L20')}</span>
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
    w: 160,
    h: 110,
    render(c) {
      return `
        <div style="width:100%; height:100%; box-sizing:border-box; position:relative; overflow:hidden; ${box('#efe3bd', '#3b3325', '6px')}">
          <div style="position:absolute; left:10%; right:10%; top:18%; height:120%; border-radius:50%; border-top:2px solid #222;"></div>
          <div style="position:absolute; right:12%; top:18%; width:22%; height:30%; border-top:3px solid #c0392b; border-radius:0 60% 0 0;"></div>
          <div style="position:absolute; left:50%; bottom:6%; width:2px; height:72%; background:${V('accent', '#111')}; transform-origin:bottom center; transform:rotate(18deg);"></div>
          <span style="position:absolute; left:0; right:0; top:52%; text-align:center; font-family:serif; font-weight:700; font-size:${V('fs', '14px')}; color:${V('text', '#222')};">VU</span>
          <span style="position:absolute; left:6px; bottom:4px; font-size:9px; color:${V('text', '#222')};">${c.label || ''}</span>
        </div>`;
    }
  },
  selector: {
    type: 'selector',
    name: 'Rotary Selector',
    icon: '🎚',
    w: 120,
    h: 120,
    render(c) {
      const n = Math.max(2, Math.min(12, parseInt(c.behavior?.positions, 10) || 6));
      const ticks = Array.from({ length: n }).map((_, i) => {
        const a = -135 + (270 / (n - 1)) * i;
        return `<div style="position:absolute; left:50%; top:50%; width:2px; height:46%; transform-origin:top center; transform:rotate(${a + 180}deg);"><div style="width:2px; height:7px; background:${V('text', '#94a3b8')}; position:absolute; bottom:0;"></div></div>`;
      }).join('');
      return `
        <div style="width:100%; height:100%; box-sizing:border-box; position:relative; ${box('transparent', 'transparent', '6px')}">
          ${ticks}
          <div style="position:absolute; left:22%; top:22%; width:56%; height:56%; border-radius:50%; background:${V('cap', '#2a2d33')}; border:2px solid ${V('border', '#52525b')}; box-shadow:0 3px 8px rgba(0,0,0,0.6); transform:rotate(-30deg);">
            <div style="position:absolute; left:calc(50% - 2px); top:4px; width:4px; height:40%; background:${V('accent', '#f59e0b')}; border-radius:2px;"></div>
          </div>
          <span style="position:absolute; left:0; right:0; bottom:0; text-align:center; font-size:${V('fs', '10px')}; font-weight:${V('fw', '600')}; color:${V('text', '#94a3b8')};">${c.label || 'SOURCE'}</span>
        </div>`;
    }
  }
};
