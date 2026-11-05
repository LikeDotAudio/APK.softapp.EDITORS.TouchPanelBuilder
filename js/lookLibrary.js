// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

// THE LOOK LIBRARY — every look a device theme or a single control can take.
//
// Two sources:
//   1. VINTAGE_LOOKS: era palettes, written here — analog, digital and
//      broadcast consoles, synths and tape machines. Colour approximations of
//      the hardware, for theming; not reproductions of anyone's artwork.
//   2. The widget library itself: WEB.Frontend-Assets serves every Gui_Frames
//      frame inlined in /FrontEnd/api/tree.json (knob families, the fader zoo,
//      LTP, MDP, CMDP, VU needles, buttons, meters, whole consoles). harvestLooks()
//      reads each element's own colours out of it — nothing is copied here.

const TREE_URLS = ['/FrontEnd/api/tree.json', '/api/os/tree/FrontEnd'];

// [bg, border, accent, text, cap, glassBg, bezel]
const L = (group, name, era, c, extra = {}) => ({
  id: `vintage/${group}/${name}`,
  source: 'vintage',
  group,
  family: era,
  name,
  style: {
    bg: c[0], border: c[1], accent: c[2], text: c[3], cap: c[4], glassBg: c[5], bezel: c[6],
    radius: 4, borderWidth: 1, shadow: 'soft', ...extra,
  },
});

const AN = 'Vintage Analog Consoles';
const DG = 'Vintage Digital Consoles';
const BC = 'Vintage Broadcast & Radio Consoles';
const SY = 'Vintage Synths';
const TP = 'Vintage Tape Recorders';

export const VINTAGE_LOOKS = [
  L(AN, 'Neve 80-Series', '1970s', ['#56697a', '#2e3b47', '#d9472b', '#f1f1ea', '#b9bec2', '#4a5c6c', '#2b3640']),
  L(AN, 'SSL 4000 E', '1979', ['#3b3e42', '#1f2124', '#e0b23a', '#f2f2f2', '#2b2b2b', '#2f3236', '#1a1b1d']),
  L(AN, 'SSL 4000 G', '1987', ['#44484d', '#25272a', '#3f8fd2', '#f2f2f2', '#d8d8d8', '#373a3e', '#1d1e20']),
  L(AN, 'API 1608 / 2488 era', '1970s', ['#3c5c7d', '#1b2c3d', '#f2f2f2', '#ffffff', '#1d1d1d', '#2e4964', '#16212c']),
  L(AN, 'Helios', '1969', ['#7b7f7a', '#3d403c', '#d7c14a', '#101010', '#202020', '#6a6e69', '#2d2f2c']),
  L(AN, 'EMI TG12345', '1968', ['#8d9883', '#4d5547', '#c7372f', '#111111', '#2a2a2a', '#7c8673', '#3f4639']),
  L(AN, 'Trident A-Range', '1973', ['#1e2126', '#40454c', '#4ea1d3', '#e6e6e6', '#b02a2a', '#16181c', '#0d0e10']),
  L(AN, 'Harrison 32 Series', '1975', ['#2c2c2c', '#4a4a4a', '#e5862d', '#eeeeee', '#9a9a9a', '#222222', '#151515']),
  L(AN, 'MCI JH-500', '1975', ['#cfc6b0', '#7d7461', '#2b5f9e', '#1d1d1d', '#3a3a3a', '#bdb39b', '#5f5848']),
  L(AN, 'Amek Angela', '1980', ['#5d6670', '#2f353b', '#f0c419', '#f2f2f2', '#2b2b2b', '#4f5761', '#262b30']),
  L(AN, 'Studer 169', '1970s', ['#a9adb0', '#5d6164', '#1a1a1a', '#111111', '#3c3c3c', '#979b9e', '#4b4e50']),
  L(AN, 'Soundcraft Series 2', '1977', ['#30343a', '#5a6068', '#5fb3e3', '#eeeeee', '#c8c8c8', '#25282d', '#141619']),

  L(DG, 'Yamaha 02R', '1995', ['#3a3f4a', '#5e6573', '#5ab3ff', '#e9eef5', '#cfd3da', '#2d313a', '#1b1e24'], { radius: 3 }),
  L(DG, 'Yamaha DM2000', '2002', ['#2e333b', '#59606b', '#65c3ff', '#f0f3f8', '#d9dde3', '#23272e', '#16181c'], { radius: 3 }),
  L(DG, 'Yamaha PM1D', '2001', ['#2b2f35', '#4b525b', '#f2a33a', '#f1f1f1', '#cfcfcf', '#202328', '#131518'], { radius: 3 }),
  L(DG, 'Yamaha PM5D', '2004', ['#2f343c', '#525a65', '#43b2ff', '#f2f2f2', '#d3d3d3', '#24282e', '#15171b'], { radius: 3 }),
  L(DG, 'Sony Oxford OXF-R3', '1996', ['#2a3a4c', '#4f6378', '#f0a030', '#eef3f8', '#cdd6de', '#1f2c3a', '#121b24'], { radius: 2 }),
  L(DG, 'Neve Capricorn', '1991', ['#2b2d31', '#4c5056', '#e3473a', '#efefef', '#b8bcc2', '#202226', '#121315'], { radius: 2 }),
  L(DG, 'SSL Axiom-MT', '1990s', ['#383b3f', '#5a5e63', '#e5b43a', '#f0f0f0', '#d0d0d0', '#2b2e31', '#18191b'], { radius: 2 }),
  L(DG, 'Euphonix System 5', '1999', ['#c9ccd0', '#7d8288', '#2c7be5', '#121212', '#2a2a2a', '#b6b9bd', '#5f6368'], { radius: 4 }),
  L(DG, 'Digidesign ICON D-Control', '2004', ['#1b1d21', '#3a3e45', '#35a7ff', '#e8ecf2', '#c6cad1', '#121417', '#0a0b0d'], { radius: 4 }),
  L(DG, 'DiGiCo D5', '2002', ['#25303d', '#47566a', '#41b6e6', '#eef4fa', '#d6dde5', '#1a222c', '#0f141a'], { radius: 4 }),
  L(DG, 'Soundcraft Vi6', '2008', ['#2a2d33', '#4b5059', '#4fc3f7', '#f2f2f2', '#d8d8d8', '#1f2227', '#121417'], { radius: 4 }),

  L(BC, 'Gates Studioette', '1950s', ['#6f7c78', '#3a423f', '#d4a640', '#111111', '#1b1b1b', '#5f6b67', '#323a37'], { radius: 8 }),
  L(BC, 'RCA BC-7', '1960s', ['#7d7f74', '#44463e', '#b33a2c', '#111111', '#262626', '#6c6e64', '#3a3c35'], { radius: 8 }),
  L(BC, 'Collins 212', '1960s', ['#8a8f8c', '#4c504e', '#2a6db0', '#101010', '#222222', '#787d7a', '#3f4341'], { radius: 8 }),
  L(BC, 'Western Electric 25B', '1940s', ['#4b4a45', '#25241f', '#c9a14a', '#ece6d3', '#151515', '#3e3d38', '#1d1c18'], { radius: 10 }),
  L(BC, 'Ward-Beck', '1970s', ['#3f4a55', '#1f262d', '#e8b730', '#f1f1f1', '#d9d9d9', '#34404a', '#1a2026']),
  L(BC, 'Wheatstone A-500', '1980s', ['#2f3439', '#525a62', '#4fb0e0', '#eeeeee', '#d0d0d0', '#25292d', '#16191b']),
  L(BC, 'Pacific Recorders BMX', '1980s', ['#3d4147', '#5f656d', '#f08a24', '#f2f2f2', '#cfcfcf', '#30343a', '#1c1f22']),
  L(BC, 'Harris Gold Medalist', '1970s', ['#5b5446', '#2f2b23', '#d8b14a', '#f1ead6', '#191919', '#4c463a', '#29251e'], { radius: 6 }),

  L(SY, 'Minimoog Model D', '1970', ['#121212', '#7a4a26', '#e9e3d0', '#e9e3d0', '#0e0e0e', '#161616', '#6b3f1f'], { radius: 2, shadow: 'deep' }),
  L(SY, 'ARP 2600', '1971', ['#9fa4a8', '#4d5154', '#ffffff', '#111111', '#f2f2f2', '#8c9195', '#3b3e41'], { radius: 2 }),
  L(SY, 'ARP Odyssey', '1972', ['#111111', '#2b2b2b', '#e8792a', '#f2f2f2', '#f2f2f2', '#0c0c0c', '#1e1e1e'], { radius: 2 }),
  L(SY, 'Sequential Prophet-5', '1978', ['#121212', '#6b3d1f', '#d9d4c3', '#e8e3d1', '#1a1a1a', '#0f0f0f', '#5a3318'], { radius: 2, shadow: 'deep' }),
  L(SY, 'Roland Jupiter-8', '1981', ['#1b1b1b', '#3a3a3a', '#e35a3a', '#f2f2f2', '#ececec', '#141414', '#0b0b0b'], { radius: 2 }),
  L(SY, 'Roland Juno-106', '1984', ['#22252a', '#45494f', '#e94b3c', '#eeeeee', '#d8d8d8', '#1a1c20', '#101113'], { radius: 2 }),
  L(SY, 'Yamaha DX7', '1983', ['#3d342b', '#665a4b', '#58b88a', '#efe8dc', '#7a6a58', '#30281f', '#1d1812'], { radius: 2 }),
  L(SY, 'Oberheim OB-Xa', '1981', ['#16181b', '#3b3f44', '#3f8fd2', '#eeeeee', '#cfcfcf', '#101113', '#08090a'], { radius: 2 }),
  L(SY, 'Yamaha CS-80', '1977', ['#2a2622', '#5a4f43', '#d94a3a', '#efe7db', '#e8e1d4', '#211d19', '#14110e'], { radius: 2 }),
  L(SY, 'Roland TB-303', '1981', ['#c5c8cb', '#7c8084', '#111111', '#111111', '#151515', '#b3b6b9', '#62666a'], { radius: 6 }),
  L(SY, 'Korg MS-20', '1978', ['#1c1c1c', '#3a3a3a', '#f2f2f2', '#f2f2f2', '#121212', '#151515', '#0b0b0b'], { radius: 2 }),
  L(SY, 'EMS VCS3', '1969', ['#e7e2d4', '#7e6a4f', '#1b4f9c', '#111111', '#1d1d1d', '#d6d0bf', '#5f4f39'], { radius: 4 }),

  L(TP, 'Studer A80', '1970', ['#a7abae', '#5a5e61', '#2f6db3', '#111111', '#222222', '#959a9d', '#484b4e']),
  L(TP, 'Studer A800', '1978', ['#9da2a6', '#53585c', '#e14b3a', '#111111', '#1f1f1f', '#8b9094', '#41454a']),
  L(TP, 'Studer A820', '1984', ['#b6babd', '#62676b', '#3b82f6', '#111111', '#202020', '#a4a8ab', '#4f5357']),
  L(TP, 'Ampex ATR-102', '1976', ['#7b7f80', '#3e4142', '#d8b04a', '#f2f2f2', '#1b1b1b', '#6a6e6f', '#303334']),
  L(TP, 'Ampex MM1200', '1970s', ['#4d5257', '#2a2d30', '#e0b23a', '#f1f1f1', '#d7d7d7', '#40454a', '#1f2124']),
  L(TP, '3M M79', '1970s', ['#5d6266', '#2f3235', '#e2463a', '#f0f0f0', '#cfcfcf', '#4e5357', '#26292b']),
  L(TP, 'Otari MTR-90', '1980', ['#c9c6bd', '#76726a', '#2c6ab0', '#111111', '#202020', '#b7b4ab', '#5f5c55']),
  L(TP, 'MCI JH-24', '1980', ['#d2cbb6', '#7f7865', '#2a5f9e', '#151515', '#232323', '#c0b9a3', '#655f4f']),
  L(TP, 'Revox A77', '1967', ['#b9b4a8', '#5e5a50', '#1b1b1b', '#111111', '#2b2b2b', '#a7a296', '#4b473f'], { radius: 6 }),
  L(TP, 'Nagra IV-S', '1971', ['#b8bcc0', '#5a5e62', '#c7372f', '#111111', '#141414', '#a6aaae', '#45494d'], { radius: 6 }),
  L(TP, 'TEAC A-3340S', '1970s', ['#202224', '#4a4e52', '#d7d7d7', '#eeeeee', '#bdbdbd', '#18191b', '#0e0f10'], { radius: 4 }),
  L(TP, 'Scully 280', '1960s', ['#7b847f', '#3f4642', '#d9a441', '#111111', '#202020', '#6a736e', '#353b37'], { radius: 6 }),
];

// ---------------------------------------------------------------- harvesting

const WIDGET_OF = [
  [/^_?CMDP|_CMDP/i, 'cmdp'],
  [/^_MDP/i, 'mdp'],
  [/LTP/i, 'ltp'],
  [/NeedleVU|VUMeterKnob/i, 'vu'],
  [/SelectorSwitch|rotary_selector/i, 'selector'],
  [/Knob/i, 'knob'],
  [/Fader|GCA|slider|Horizontal_with_dial/i, 'fader'],
  [/Meter|BarGraph|Light/i, 'meter'],
  [/Button|Toggle|Toggler|Actuator|Checkbox/i, 'button'],
  [/Value|Label|Readout/i, 'readout'],
];

export function widgetTypeFor(sourceType) {
  for (const [re, t] of WIDGET_OF) if (re.test(sourceType)) return t;
  return null;
}

const get = (o, path) => path.split('.').reduce((a, k) => (a && typeof a === 'object' ? a[k] : undefined), o);
const isColor = (v) => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v.trim());
const first = (o, paths) => {
  for (const p of paths) {
    const v = get(o, p);
    if (isColor(v)) return v.trim();
  }
  return undefined;
};

const PICK = {
  bg: ['cosmetics.styling.fill_color', 'cosmetics.colors.primary', 'style.active.bg_color', 'style.inactive.bg_color',
    'graph.style.bg_color', 'cosmetics.colors.background', 'cosmetics.colors.meter_face_colour', 'color'],
  cap: ['cosmetics.cap.color', 'cosmetics.styling.cap_color', 'cosmetics.colors.cap', 'knob_config.cap_color',
    'ltp.cap_color', 'cap_color'],
  accent: ['cosmetics.colors.tick', 'cosmetics.colors.foreground', 'fader_config.cosmetics.colors.highlight',
    'cosmetics.colors.secondary', 'led_color', 'shutter_color', 'cosmetics.colors.lower', 'cosmetics.colors.highlight',
    'cosmetics.colors.active', 'cap_highlight_color', 'tick_color', 'cosmetics.colors.pointer'],
  border: ['cosmetics.styling.outline_color', 'style.active.border_color', 'cosmetics.colors.bezel',
    'knob_config.cap_outline_color', 'style.border_color'],
  text: ['cosmetics.colors.text', 'style.active.text_color', 'cosmetics.colors.scale_label', 'label.active.text_color',
    'label.text_color', 'text_inside_color', 'style.label_color'],
};

const clean = (seg) => {
  const t = String(seg || '').replace(/\.json$/i, '').replace(/^\d+_/, '').replace(/_/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function nameOf(key, o) {
  const l = o.label;
  const t = (l && (l.En || l.active?.text?.En || l.text?.En)) || (typeof l === 'string' ? l : '');
  return String(t || key).replace(/_/g, ' ').trim();
}

// Every styled element in the tree, as { group, family, name, widget, style }.
// `group` is the library shelf (Knobs, Faders, Buttons, Consoles…), `family`
// the folder it sits in (1176, Moog, LTP, MDP…).
export function harvestLooks(tree) {
  const looks = [];
  const seen = new Set();

  const visitFile = (path, content) => {
    const segs = String(path).split('/').filter(Boolean);
    const top = segs[0] || '';
    let group;
    if (/Samples/i.test(top)) group = `Library · ${clean(segs[1]) || 'Samples'}`;
    else if (/Console/i.test(top)) group = 'Library · Consoles';
    else return; // discovered devices, captures, protocols: not looks
    const family = clean(segs[segs.length - 2] || segs[1]);

    const walk = (o, key) => {
      if (Array.isArray(o)) { o.forEach(v => walk(v, key)); return; }
      if (!o || typeof o !== 'object') return;
      const ty = typeof o.type === 'string' ? o.type : '';
      const widget = ty ? widgetTypeFor(ty) : null;
      if (widget && (ty.startsWith('_') || ty === 'SelectorSwitch')) {
        const style = {};
        for (const [k, paths] of Object.entries(PICK)) {
          const v = first(o, paths);
          if (v) style[k] = v;
        }
        if (Object.keys(style).length) {
          const viz = get(o, 'cosmetics.visualization');
          if (typeof viz === 'string' && viz) style.capShape = viz.toLowerCase();
          const sig = `${widget}|${JSON.stringify(style)}|${viz || ''}`;
          if (!seen.has(sig)) {
            seen.add(sig);
            looks.push({
              id: `lib/${path}#${key}`,
              source: 'library',
              group,
              family: viz && String(viz).toLowerCase().replace(/[^a-z0-9]/g, '') !== family.toLowerCase().replace(/[^a-z0-9]/g, '')
                ? `${family} · ${viz}` : family,
              name: nameOf(key, o),
              widget,
              sourceType: ty,
              path,
              style,
            });
          }
        }
      }
      for (const [k, v] of Object.entries(o)) if (v && typeof v === 'object') walk(v, k);
    };
    walk(content, '');
  };

  const visit = (node) => {
    if (!node) return;
    if (node.type === 'file' && node.content) visitFile(node.path || node.name, node.content);
    (node.children || []).forEach(visit);
  };
  visit(tree);
  return looks;
}

export async function loadLibraryLooks(fetchFn = (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null)) {
  for (const url of TREE_URLS) {
    try {
      const res = await fetchFn(url);
      if (res.ok) return harvestLooks(await res.json());
    } catch (_) {}
  }
  return [];
}

export function groupLooks(looks) {
  const groups = new Map();
  for (const l of looks) {
    if (!groups.has(l.group)) groups.set(l.group, []);
    groups.get(l.group).push(l);
  }
  return groups;
}
