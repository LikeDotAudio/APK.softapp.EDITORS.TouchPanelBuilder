// Part of APK.audio - Touch Panel Builder
// Ported from OneThing FEATURE.surfaceDesigner/controls

export const CONTROL_DEFINITIONS = {
  fader: {
    type: 'fader',
    name: 'Motorized Fader',
    icon: '🎚️',
    w: 60,
    h: 180,
    render(c) {
      return `
        <div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:8px 0; background:#181b22; border-radius:6px; border:1px solid #333948;">
          <span style="font-size:10px; color:#94a3b8;">${c.label || 'LEVEL'}</span>
          <div style="width:6px; height:120px; background:#0f1115; border-radius:3px; position:relative;">
            <div style="position:absolute; bottom:30%; left:-12px; width:30px; height:18px; background:#475569; border-radius:3px; border:1px solid #94a3b8; box-shadow:0 2px 4px rgba(0,0,0,0.5);"></div>
          </div>
          <span style="font-size:9px; color:#38bdf8; font-family:monospace;">${c.value ?? '-6 dB'}</span>
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
        <div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px;">
          <div style="width:50px; height:50px; border-radius:50%; background:conic-gradient(#38bdf8 0deg 240deg, #1e293b 240deg 360deg); display:flex; align-items:center; justify-content:center; box-shadow:0 2px 8px rgba(0,0,0,0.6);">
            <div style="width:38px; height:38px; border-radius:50%; background:#1e222b; border:1px solid #475569; display:flex; align-items:center; justify-content:center;">
              <div style="width:2px; height:12px; background:#38bdf8; transform:translateY(-8px);"></div>
            </div>
          </div>
          <span style="font-size:10px; color:#94a3b8;">${c.label || 'GAIN'}</span>
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
      return `
        <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#242a38; border:1px solid #3b82f6; border-radius:6px; box-shadow:0 2px 6px rgba(0,0,0,0.4); cursor:pointer;">
          <span style="font-size:11px; font-weight:600; color:#e2e8f0; letter-spacing:0.5px;">${c.label || 'MUTE'}</span>
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
        <div style="width:100%; height:100%; background:#13151b; border:1px solid #2e3442; border-radius:4px; padding:6px; display:flex; flex-direction:column; justify-content:space-between; align-items:center;">
          <div style="width:100%; flex:1; display:flex; flex-direction:column-reverse; gap:2px;">
            ${Array.from({ length: 16 }).map((_, i) => {
              const color = i > 13 ? '#ef4444' : i > 10 ? '#f59e0b' : '#10b981';
              const opacity = i < 9 ? '0.9' : '0.2';
              return `<div style="height:6px; background:${color}; opacity:${opacity}; border-radius:1px;"></div>`;
            }).join('')}
          </div>
          <span style="font-size:8px; color:#64748b; margin-top:4px;">${c.label || 'CH 1'}</span>
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
        <div style="width:100%; height:100%; background:#1c2230; border:1px solid #334155; border-radius:8px; padding:12px; display:flex; flex-direction:column; justify-content:space-between;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span style="font-size:18px;">${c.icon || '📻'}</span>
            <span style="width:8px; height:8px; border-radius:50%; background:#34d399;"></span>
          </div>
          <div>
            <div style="font-size:12px; font-weight:600; color:#f1f5f9;">${c.label || 'Apple Music'}</div>
            <div style="font-size:9px; color:#64748b;">${c.subtitle || 'Zone A · Active'}</div>
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
        <div style="width:100%; height:100%; background:#0a0d12; border:1px solid #222938; border-radius:4px; padding:6px 10px; display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:9px; color:#64748b;">${c.label || 'FREQ'}</span>
          <span style="font-size:14px; font-family:monospace; color:#38bdf8; font-weight:700;">${c.value || '1000 Hz'}</span>
        </div>`;
    }
  }
};
