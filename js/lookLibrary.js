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

// [bg, border, accent, text, cap, glassBg, bezel] + the hardware: knob cap and
// pointer, fader cap, button, and what the card shows (`preview`: a list of
// control types, or 'strip' — a channel strip of knob rows, buttons and a fader;
// `rows`: one knob-cap colour per strip row).
const L = (group, name, era, c, extra = {}) => {
  const { preview, rows, ...hw } = { ...(GROUP_HW[group] || {}), ...extra };
  return {
    id: `vintage/${group}/${name}`,
    source: 'vintage',
    group,
    family: era,
    name,
    preview,
    rows,
    style: {
      bg: c[0], border: c[1], accent: c[2], text: c[3], cap: c[4], glassBg: c[5], bezel: c[6],
      radius: 4, borderWidth: 1, shadow: 'soft', ...hw,
    },
  };
};

const AN = 'Vintage Analog Consoles';
const DG = 'Vintage Digital Consoles';
const BC = 'Vintage Broadcast & Radio Consoles';
const WB = 'Ward-Beck Systems';
const OB = 'Vintage Outboard (UREI & friends)';
const SY = 'Vintage Synths';
const TP = 'Vintage Tape Recorders';

// What each shelf's hardware usually was; a look overrides any of it.
const GROUP_HW = {
  [AN]: { preview: 'strip', capShape: 'skirt', pointer: 'line', faderCap: 'square', buttonShape: 'square' },
  [DG]: { preview: 'strip', capShape: 'circle', pointer: 'dot', faderCap: 'tall', buttonShape: 'lit' },
  [BC]: { preview: ['knob', 'vu', 'button'], capShape: 'chicken', pointer: 'vintage', faderCap: 'chrome', buttonShape: 'toggle' },
  [WB]: { preview: ['selector', 'vu', 'button'], capShape: 'knurled', pointer: 'line', faderCap: 'chrome', buttonShape: 'lit' },
  [OB]: { preview: ['knob', 'vu', 'button'], capShape: 'flange', pointer: 'line', buttonShape: 'square' },
  [SY]: { preview: ['knob', 'fader', 'button'], capShape: 'skirt', pointer: 'line', faderCap: 'slim', buttonShape: 'toggle' },
  [TP]: { preview: ['vu', 'button', 'selector'], capShape: 'knurled', pointer: 'line', buttonShape: 'piano' },
};

export const VINTAGE_LOOKS = [
  L(AN, 'Neve 80-Series', '1970s', ['#56697a', '#2e3b47', '#d9472b', '#f1f1ea', '#b9bec2', '#4a5c6c', '#2b3640'],
    { rows: ['#c8372d', '#9aa3aa', '#2f5fa8', '#2f5fa8', '#c8372d'], capShape: 'marconi', pointer: 'line', faderCap: 'square', buttonShape: 'square' }),
  L(AN, 'SSL 4000 E', '1979', ['#3b3e42', '#1f2124', '#e0b23a', '#f2f2f2', '#2b2b2b', '#2f3236', '#1a1b1d'],
    { rows: ['#d23a2f', '#2e7d32', '#1e5aa8', '#e0b23a', '#7a7a7a'], capShape: 'circle', pointer: 'line', faderCap: 'tall', buttonShape: 'lit' }),
  L(AN, 'SSL 4000 G', '1987', ['#44484d', '#25272a', '#3f8fd2', '#f2f2f2', '#d8d8d8', '#373a3e', '#1d1e20'],
    { rows: ['#d23a2f', '#2e7d32', '#3f8fd2', '#e0b23a', '#d8d8d8'], capShape: 'circle', pointer: 'line', faderCap: 'tall', buttonShape: 'lit' }),
  L(AN, 'API 1608 / 2488 era', '1970s', ['#3c5c7d', '#1b2c3d', '#7ec8f0', '#ffffff', '#1d1d1d', '#2e4964', '#16212c'],
    { rows: ['#7ec8f0', '#e9e9e9', '#7ec8f0', '#f2a23a'], capShape: 'concentric', pointer: 'line', faderCap: 'tbar', buttonShape: 'round' }),
  L(AN, 'Helios', '1969', ['#7b7f7a', '#3d403c', '#d7c14a', '#101010', '#202020', '#6a6e69', '#2d2f2c'],
    { rows: ['#202020', '#202020', '#7a1f1f'], capShape: 'chicken', pointer: 'vintage', faderCap: 'chrome', buttonShape: 'toggle' }),
  L(AN, 'EMI TG12345', '1968', ['#8d9883', '#4d5547', '#c7372f', '#111111', '#2a2a2a', '#7c8673', '#3f4639'],
    { rows: ['#2a2a2a', '#2a2a2a'], capShape: 'bakelite', pointer: 'vintage', faderCap: 'chrome', buttonShape: 'toggle' }),
  L(AN, 'Trident A-Range', '1973', ['#1e2126', '#40454c', '#4ea1d3', '#e6e6e6', '#b02a2a', '#16181c', '#0d0e10'],
    { rows: ['#b02a2a', '#4ea1d3', '#4ea1d3', '#e6e6e6'], capShape: 'circle', pointer: 'line', faderCap: 'tall', buttonShape: 'square' }),
  L(AN, 'Harrison 32 Series', '1975', ['#2c2c2c', '#4a4a4a', '#e5862d', '#eeeeee', '#9a9a9a', '#222222', '#151515'],
    { rows: ['#e5862d', '#9a9a9a', '#9a9a9a'], capShape: 'circle', pointer: 'block', faderCap: 'tall', buttonShape: 'lit' }),
  L(AN, 'MCI JH-500', '1975', ['#cfc6b0', '#7d7461', '#2b5f9e', '#1d1d1d', '#3a3a3a', '#bdb39b', '#5f5848'],
    { rows: ['#2b5f9e', '#3a3a3a', '#b33a2c'], capShape: 'skirt', pointer: 'line', faderCap: 'tbar', buttonShape: 'lit' }),
  L(AN, 'Amek Angela', '1980', ['#5d6670', '#2f353b', '#f0c419', '#f2f2f2', '#2b2b2b', '#4f5761', '#262b30'],
    { rows: ['#f0c419', '#2b2b2b', '#2b6cb0'], capShape: 'circle', faderCap: 'tall' }),
  L(AN, 'Studer 169', '1970s', ['#a9adb0', '#5d6164', '#1a1a1a', '#111111', '#3c3c3c', '#979b9e', '#4b4e50'],
    { rows: ['#3c3c3c', '#3c3c3c'], capShape: 'knurled', faderCap: 'chrome', buttonShape: 'square' }),
  L(AN, 'Soundcraft Series 2', '1977', ['#30343a', '#5a6068', '#5fb3e3', '#eeeeee', '#c8c8c8', '#25282d', '#141619'],
    { rows: ['#c8c8c8', '#5fb3e3', '#d23a2f'], capShape: 'circle', faderCap: 'standard', buttonShape: 'square' }),

  L(DG, 'Yamaha 02R', '1995', ['#3a3f4a', '#5e6573', '#5ab3ff', '#e9eef5', '#cfd3da', '#2d313a', '#1b1e24'], { radius: 3, rows: ['#cfd3da'], buttonShape: 'membrane' }),
  L(DG, 'Yamaha DM2000', '2002', ['#2e333b', '#59606b', '#65c3ff', '#f0f3f8', '#d9dde3', '#23272e', '#16181c'], { radius: 3, rows: ['#d9dde3', '#d9dde3'] }),
  L(DG, 'Yamaha PM1D', '2001', ['#2b2f35', '#4b525b', '#f2a33a', '#f1f1f1', '#cfcfcf', '#202328', '#131518'], { radius: 3, rows: ['#cfcfcf'] }),
  L(DG, 'Yamaha PM5D', '2004', ['#2f343c', '#525a65', '#43b2ff', '#f2f2f2', '#d3d3d3', '#24282e', '#15171b'], { radius: 3, rows: ['#d3d3d3', '#d3d3d3'] }),
  L(DG, 'Sony Oxford OXF-R3', '1996', ['#2a3a4c', '#4f6378', '#f0a030', '#eef3f8', '#cdd6de', '#1f2c3a', '#121b24'], { radius: 2, rows: ['#cdd6de', '#cdd6de', '#cdd6de'], pointer: 'notch' }),
  L(DG, 'Neve Capricorn', '1991', ['#2b2d31', '#4c5056', '#e3473a', '#efefef', '#b8bcc2', '#202226', '#121315'], { radius: 2, rows: ['#b8bcc2'], faderCap: 'square' }),
  L(DG, 'SSL Axiom-MT', '1990s', ['#383b3f', '#5a5e63', '#e5b43a', '#f0f0f0', '#d0d0d0', '#2b2e31', '#18191b'], { radius: 2, rows: ['#d0d0d0'] }),
  L(DG, 'Euphonix System 5', '1999', ['#c9ccd0', '#7d8288', '#2c7be5', '#121212', '#2a2a2a', '#b6b9bd', '#5f6368'], { radius: 4, rows: ['#2a2a2a'], faderCap: 'standard' }),
  L(DG, 'Digidesign ICON D-Control', '2004', ['#1b1d21', '#3a3e45', '#35a7ff', '#e8ecf2', '#c6cad1', '#121417', '#0a0b0d'], { radius: 4, rows: ['#c6cad1', '#c6cad1'] }),
  L(DG, 'DiGiCo D5', '2002', ['#25303d', '#47566a', '#41b6e6', '#eef4fa', '#d6dde5', '#1a222c', '#0f141a'], { radius: 4, rows: ['#d6dde5'] }),
  L(DG, 'Soundcraft Vi6', '2008', ['#2a2d33', '#4b5059', '#4fc3f7', '#f2f2f2', '#d8d8d8', '#1f2227', '#121417'], { radius: 4, rows: ['#d8d8d8'] }),

  L(BC, 'Gates Studioette', '1950s', ['#6f7c78', '#3a423f', '#d4a640', '#111111', '#1b1b1b', '#5f6b67', '#323a37'], { radius: 8 }),
  L(BC, 'RCA BC-7', '1960s', ['#7d7f74', '#44463e', '#b33a2c', '#111111', '#262626', '#6c6e64', '#3a3c35'], { radius: 8, capShape: 'bakelite' }),
  L(BC, 'Collins 212', '1960s', ['#8a8f8c', '#4c504e', '#2a6db0', '#111111', '#222222', '#787d7a', '#3f4341'], { radius: 8, capShape: 'skirt' }),
  L(BC, 'Western Electric 25B', '1940s', ['#4b4a45', '#25241f', '#c9a14a', '#ece6d3', '#151515', '#3e3d38', '#1d1c18'], { radius: 10, capShape: 'bakelite', buttonShape: 'lamp' }),
  L(BC, 'Wheatstone A-500', '1980s', ['#2f3439', '#525a62', '#4fb0e0', '#eeeeee', '#d0d0d0', '#25292d', '#16191b'], { preview: ['fader', 'button', 'vu'], faderCap: 'tall', buttonShape: 'lit' }),
  L(BC, 'Pacific Recorders BMX', '1980s', ['#3d4147', '#5f656d', '#f08a24', '#f2f2f2', '#cfcfcf', '#30343a', '#1c1f22'], { preview: ['fader', 'button', 'vu'], faderCap: 'tbar', buttonShape: 'lit' }),
  L(BC, 'Harris Gold Medalist', '1970s', ['#5b5446', '#2f2b23', '#d8b14a', '#f1ead6', '#191919', '#4c463a', '#29251e'], { radius: 6, buttonShape: 'lamp' }),

  // Ward-Beck Systems, Toronto: broadcast consoles and panels built around Elma
  // rotary hardware, illuminated keys and VU bridges (the library's WBS Elma knobs).
  L(WB, 'WBS Broadcast Console', '1970s', ['#8c9396', '#3c4245', '#f2c230', '#111111', '#1b1b1b', '#7b8285', '#2e3336'], { preview: 'strip', rows: ['#1b1b1b', '#1b1b1b', '#1b1b1b'] }),
  L(WB, 'WBS On-Air Radio Console', '1980s', ['#5c6a73', '#2a3136', '#e23b2e', '#f2f2f2', '#1b1b1b', '#4e5a62', '#232a2e'], { preview: ['fader', 'button', 'vu'], faderCap: 'tbar' }),
  L(WB, 'WBS Elma Selector Panel', '1970s', ['#a4a9ab', '#4b5053', '#f2c230', '#111111', '#111111', '#93989a', '#3d4144'], { preview: ['selector', 'selector', 'button'] }),
  L(WB, 'WBS VU Bridge', '1970s', ['#8c9396', '#3c4245', '#111111', '#111111', '#1b1b1b', '#7b8285', '#2e3336'], { preview: ['vu', 'vu', 'button'], buttonShape: 'square' }),
  L(WB, 'WBS Distribution Frame', '1980s', ['#2f3437', '#55595c', '#38c172', '#eeeeee', '#1b1b1b', '#25292b', '#16191a'], { preview: ['knob', 'button', 'meter'], buttonShape: 'lamp' }),
  L(WB, 'WBS Router Control Panel', '1980s', ['#3a4045', '#5d646a', '#f2c230', '#f2f2f2', '#d0d0d0', '#2e3337', '#1b1e20'], { preview: ['button', 'button', 'button'], buttonShape: 'lit' }),

  L(OB, 'UREI 1176LN Blackface', '1970s', ['#121212', '#555555', '#e8e8e8', '#f2f2f2', '#c8ccd0', '#0d0d0d', '#9da2a6'], { preview: ['knob', 'vu', 'button'] }),
  L(OB, 'UREI 1176 Silverface', '1970s', ['#b9bdc1', '#4b4f53', '#2f6db3', '#111111', '#1a1a1a', '#a7abaf', '#55595d']),
  L(OB, 'UREI 1178 Dual', '1970s', ['#141414', '#4d4d4d', '#e8e8e8', '#f2f2f2', '#c8ccd0', '#0e0e0e', '#9da2a6'], { preview: ['knob', 'knob', 'vu'] }),
  L(OB, 'UREI LA-4', '1970s', ['#2d2f31', '#555a5e', '#e8a33a', '#f2f2f2', '#1a1a1a', '#232527', '#6b7074'], { capShape: 'circle', buttonShape: 'toggle' }),
  L(OB, 'UREI 1620 Rotary Mixer', '1980s', ['#1b1b1b', '#4a4a4a', '#e0e0e0', '#eeeeee', '#b8bcc0', '#121212', '#7a7e82'], { preview: ['knob', 'knob', 'vu'], capShape: 'knurled', buttonShape: 'round' }),
  L(OB, 'UREI 545 Parametric EQ', '1970s', ['#1c1c1c', '#4d4d4d', '#f2f2f2', '#f2f2f2', '#c8ccd0', '#141414', '#8d9296'], { preview: ['knob', 'knob', 'button'] }),
  L(OB, 'Teletronix LA-2A', '1960s', ['#b9b6ad', '#5e5b53', '#111111', '#111111', '#1a1a1a', '#a6a39a', '#4a4741'], { capShape: 'bakelite', pointer: 'vintage', buttonShape: 'toggle' }),
  L(OB, 'Pultec EQP-1A', '1950s', ['#5d7286', '#2d3a46', '#f2f2f2', '#f2f2f2', '#111111', '#4e6274', '#222c36'], { preview: ['knob', 'knob', 'selector'], capShape: 'chicken', pointer: 'vintage' }),
  L(OB, 'Fairchild 670', '1950s', ['#7c7f80', '#3d3f40', '#c9a14a', '#111111', '#151515', '#6b6e6f', '#2f3132'], { capShape: 'bakelite', pointer: 'vintage', buttonShape: 'lamp' }),

  L(SY, 'Minimoog Model D', '1970', ['#121212', '#7a4a26', '#e9e3d0', '#e9e3d0', '#0e0e0e', '#161616', '#6b3f1f'], { radius: 2, shadow: 'deep', capShape: 'moog', preview: ['knob', 'knob', 'button'] }),
  L(SY, 'ARP 2600', '1971', ['#9fa4a8', '#4d5154', '#ffffff', '#111111', '#f2f2f2', '#8c9195', '#3b3e41'], { radius: 2, preview: ['fader', 'fader', 'button'] }),
  L(SY, 'ARP Odyssey', '1972', ['#111111', '#2b2b2b', '#e8792a', '#f2f2f2', '#f2f2f2', '#0c0c0c', '#1e1e1e'], { radius: 2, preview: ['fader', 'fader', 'button'] }),
  L(SY, 'Sequential Prophet-5', '1978', ['#121212', '#6b3d1f', '#d9d4c3', '#e8e3d1', '#1a1a1a', '#0f0f0f', '#5a3318'], { radius: 2, shadow: 'deep', capShape: 'flange', buttonShape: 'square', preview: ['knob', 'knob', 'button'] }),
  L(SY, 'Roland Jupiter-8', '1981', ['#1b1b1b', '#3a3a3a', '#e35a3a', '#f2f2f2', '#ececec', '#141414', '#0b0b0b'], { radius: 2, capShape: 'circle', buttonShape: 'lit' }),
  L(SY, 'Roland Juno-106', '1984', ['#22252a', '#45494f', '#e94b3c', '#eeeeee', '#d8d8d8', '#1a1c20', '#101113'], { radius: 2, buttonShape: 'square', preview: ['fader', 'fader', 'button'] }),
  L(SY, 'Yamaha DX7', '1983', ['#3d342b', '#665a4b', '#58b88a', '#efe8dc', '#7a6a58', '#30281f', '#1d1812'], { radius: 2, buttonShape: 'membrane', preview: ['fader', 'button', 'button'] }),
  L(SY, 'Oberheim OB-Xa', '1981', ['#16181b', '#3b3f44', '#3f8fd2', '#eeeeee', '#cfcfcf', '#101113', '#08090a'], { radius: 2, capShape: 'flange', buttonShape: 'lit' }),
  L(SY, 'Yamaha CS-80', '1977', ['#2a2622', '#5a4f43', '#d94a3a', '#efe7db', '#e8e1d4', '#211d19', '#14110e'], { radius: 2, buttonShape: 'lit', preview: ['fader', 'fader', 'button'] }),
  L(SY, 'Roland TB-303', '1981', ['#c5c8cb', '#7c8084', '#111111', '#111111', '#151515', '#b3b6b9', '#62666a'], { radius: 6, capShape: 'circle', buttonShape: 'square', preview: ['knob', 'knob', 'button'] }),
  L(SY, 'Korg MS-20', '1978', ['#1c1c1c', '#3a3a3a', '#f2f2f2', '#f2f2f2', '#121212', '#151515', '#0b0b0b'], { radius: 2, capShape: 'circle', pointer: 'dot' }),
  L(SY, 'EMS VCS3', '1969', ['#e7e2d4', '#7e6a4f', '#1b4f9c', '#111111', '#1d1d1d', '#d6d0bf', '#5f4f39'], { radius: 4, capShape: 'bakelite', preview: ['knob', 'knob', 'knob'] }),

  L(TP, 'Studer A80', '1970', ['#a7abae', '#5a5e61', '#2f6db3', '#111111', '#222222', '#959a9d', '#484b4e'], { buttonShape: 'square' }),
  L(TP, 'Studer A800', '1978', ['#9da2a6', '#53585c', '#e14b3a', '#111111', '#1f1f1f', '#8b9094', '#41454a'], { buttonShape: 'lit' }),
  L(TP, 'Studer A820', '1984', ['#b6babd', '#62676b', '#3b82f6', '#111111', '#202020', '#a4a8ab', '#4f5357'], { buttonShape: 'lit' }),
  L(TP, 'Ampex ATR-102', '1976', ['#7b7f80', '#3e4142', '#d8b04a', '#f2f2f2', '#1b1b1b', '#6a6e6f', '#303334'], { buttonShape: 'piano', capShape: 'skirt' }),
  L(TP, 'Ampex MM1200', '1970s', ['#4d5257', '#2a2d30', '#e0b23a', '#f1f1f1', '#d7d7d7', '#40454a', '#1f2124'], { buttonShape: 'piano' }),
  L(TP, '3M M79', '1970s', ['#5d6266', '#2f3235', '#e2463a', '#f0f0f0', '#cfcfcf', '#4e5357', '#26292b'], { buttonShape: 'lit' }),
  L(TP, 'Otari MTR-90', '1980', ['#c9c6bd', '#76726a', '#2c6ab0', '#111111', '#202020', '#b7b4ab', '#5f5c55'], { buttonShape: 'square' }),
  L(TP, 'MCI JH-24', '1980', ['#d2cbb6', '#7f7865', '#2a5f9e', '#151515', '#232323', '#c0b9a3', '#655f4f'], { buttonShape: 'lit' }),
  L(TP, 'Revox A77', '1967', ['#b9b4a8', '#5e5a50', '#1b1b1b', '#111111', '#2b2b2b', '#a7a296', '#4b473f'], { radius: 6, buttonShape: 'piano', capShape: 'skirt' }),
  L(TP, 'Nagra IV-S', '1971', ['#b8bcc0', '#5a5e62', '#c7372f', '#111111', '#141414', '#a6aaae', '#45494d'], { radius: 6, buttonShape: 'toggle', capShape: 'chicken' }),
  L(TP, 'TEAC A-3340S', '1970s', ['#202224', '#4a4e52', '#d7d7d7', '#eeeeee', '#bdbdbd', '#18191b', '#0e0f10'], { radius: 4, buttonShape: 'piano', capShape: 'skirt' }),
  L(TP, 'Scully 280', '1960s', ['#7b847f', '#3f4642', '#d9a441', '#111111', '#202020', '#6a736e', '#353b37'], { radius: 6, buttonShape: 'toggle', capShape: 'bakelite' }),
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

const SHELF_OF = (path) => {
  const segs = String(path).split('/').filter(Boolean);
  const top = segs[0] || '';
  if (/Samples/i.test(top)) return { group: `Library · ${clean(segs[1]) || 'Samples'}`, family: clean(segs[segs.length - 2] || segs[1]) };
  if (/Console/i.test(top)) return { group: 'Library · Consoles', family: clean(segs[segs.length - 2] || segs[1]) };
  return null; // discovered devices, captures, protocols: not looks
};

// One element of a frame as a look, or null when it is not a control with colours.
// `field` keeps the whole element, so nothing about it is lost (ROAD-3499).
export function lookFromField(path, key, o, shelf = SHELF_OF(path)) {
  if (!o || typeof o !== 'object' || !shelf) return null;
  const ty = typeof o.type === 'string' ? o.type : '';
  const widget = ty ? widgetTypeFor(ty) : null;
  if (!widget || !(ty.startsWith('_') || ty === 'SelectorSwitch')) return null;
  const style = {};
  for (const [k, paths] of Object.entries(PICK)) {
    const v = first(o, paths);
    if (v) style[k] = v;
  }
  if (!Object.keys(style).length) return null;
  const viz = get(o, 'cosmetics.style_overrides.shape') || get(o, 'cosmetics.visualization');
  if (typeof viz === 'string' && viz) style.capShape = viz.toLowerCase();
  const ptr = get(o, 'cosmetics.pointer.style') || get(o, 'cosmetics.indicator.style');
  if (typeof ptr === 'string' && ptr) style.pointer = ptr.toLowerCase();
  if (widget === 'button') {
    if (/Wink/i.test(ty)) style.buttonShape = 'wink';
    else if (/Toggle|Actuator/i.test(ty)) style.buttonShape = 'toggle';
    else if (o.shape_type) style.buttonShape = { round: 'round', square: 'square', rect: 'rect', rounded_rect: 'rect' }[o.shape_type] || 'rect';
    else if (/Trapezoid|HighVis/i.test(ty)) style.buttonShape = 'lit';
  }
  const family = shelf.family;
  return {
    id: `lib/${path}#${key}`,
    source: 'library',
    group: shelf.group,
    family: viz && String(viz).toLowerCase().replace(/[^a-z0-9]/g, '') !== family.toLowerCase().replace(/[^a-z0-9]/g, '')
      ? `${family} · ${viz}` : family,
    name: nameOf(key, o),
    widget,
    sourceType: ty,
    path,
    field: o,
    style,
  };
}

// Every styled element in the tree, as { group, family, name, widget, style }.
// `group` is the library shelf (Knobs, Faders, Buttons, Consoles…), `family`
// the folder it sits in (1176, Moog, LTP, MDP…). `looks.files` maps each frame
// file to its content, for the live factory view.
export function harvestLooks(tree) {
  const looks = [];
  const files = new Map();
  const seen = new Set();

  const visitFile = (path, content) => {
    const shelf = SHELF_OF(path);
    if (!shelf) return;
    files.set(path, content);
    const walk = (o, key) => {
      if (Array.isArray(o)) { o.forEach(v => walk(v, key)); return; }
      if (!o || typeof o !== 'object') return;
      const look = lookFromField(path, key, o, shelf);
      if (look) {
        const sig = `${look.widget}|${JSON.stringify(look.style)}`;
        if (!seen.has(sig)) {
          seen.add(sig);
          looks.push(look);
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
  looks.files = files;
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
