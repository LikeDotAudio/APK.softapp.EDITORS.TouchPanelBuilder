// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import { connectTouchPanelHost, panelBlock } from './touchPanelHost.js';
import { VINTAGE_LOOKS, loadLibraryLooks } from './lookLibrary.js';
import { panelToFrame, deviceWindowPath } from './frameExport.js';
import { ControlLibrary, VERBS } from './library.js';
import { FIT_SCREEN } from './touchPanel/screens.js';
import { mixInto, VAR_PAGE, inertFrame, guiPrefixOf } from './touchPanel/common.js';
import { TouchPanelLooks } from './touchPanel/looks.js';
import { TouchPanelEvents } from './touchPanel/events.js';
import { TouchPanelVariables } from './touchPanel/variables.js';
import { TouchPanelWires } from './touchPanel/wires.js';
import { TouchPanelOpenSave } from './touchPanel/openSave.js';
import { TouchPanelPages } from './touchPanel/pages.js';
import { TouchPanelSurface } from './touchPanel/surface.js';
import { TouchPanelTableFrame } from './touchPanel/tableFrame.js';

/* The screens and resize maths live in js/touchPanel/screens.js; the names stay exported here. */
export { FIT_SCREEN, RESIZE_EDGES, resizeBox, fitPageSize, SCREEN_PRESETS } from './touchPanel/screens.js';

/* The one Touch Panel Builder. Its methods are grouped in js/touchPanel/*.js
   and mixed into this prototype below, so `this` is always the app. */
export class TouchPanelApp {
  constructor() {
    this.panel = {
      id: 'tp_01',
      name: 'TP-STAGE-01',
      room: 'MAIN AUDITORIUM',
      screenPreset: FIT_SCREEN,
      width: 1280,
      height: 800,
      // The device theme: every control on this glass wears it unless the
      // control's own style says otherwise.
      theme: { preset: 'Deep Horizon', style: {} },
      // Pages: the tabs across the top of the designer. Every control lives on
      // one (`w.page`); a control without one is on the first.
      pages: [{ id: 'p1', name: 'Main' }],
      widgets: [],
    };
    this.currentPage = 'p1';

    this.selectedWidgetId = null;
    this.glassScale = 1;
    // Look library: vintage palettes now, the widget library once tree.json lands.
    this.looks = [...VINTAGE_LOOKS];
    this.lookById = new Map(this.looks.map(l => [l.id, l]));
    this.lookGroup = VINTAGE_LOOKS[0].group;
    this.lookQuery = '';
    this.lookTarget = 'theme';
    this.lookLimit = 240;
    this.lookView = 'live';        // library shelves open on the real widgets
    this.lookFile = '';
    this.lookFiles = new Map();
    this.panel.savedLooks = [];
    this.expanded = new Set();     // widget ids whose style editor is open

    // Library view state
    this.library = new ControlLibrary();
    this.selectedModels = [];          // model keys whose variables are listed
    this.bimFor = new Map();           // model key -> {bimId, bimRef} it was picked from the BIM library as (ROAD-3572)
    this.deviceFor = new Map();        // model key -> bench device it was picked as
    this.varsByModel = new Map();      // model key -> variables[]
    this.varIndex = new Map();         // variable id -> variable
    this.verbFilter = new Set(VERBS);
    this.varQuery = '';
    this.devQuery = '';
    this.collapsed = new Set(['__offline']);
    this.collapsedSub = new Set();     // variable sub-categories folded shut
    this.varLimit = VAR_PAGE;
    this.wireFrame = 0;

    this.initElements();
    this.attachEvents();
    this.loadInitialData();
    this.libraryReady = this.loadLibrary();
    this.loadLooks();
    // Opened from a device's link (Discovery Engine, Discovered VISA → Links): start on its panel.
    this.openFromLink();

    // The CAD bridge: cad.like.audio/host@1 through the vendored APKSoftapp client (ROAD-3491).
    this.host = window.APKSoftapp ? connectTouchPanelHost(window.APKSoftapp, this) : null;
    if (window.APKSoftapp) this.describeSelf(window.APKSoftapp);
  }

  /* What the builder takes in, puts out and lets you control: the ? help panel (F1). */
  describeSelf(S) {
    S.describe({
      name: 'Touch Panel Builder',
      does: 'Designs a touch panel: pages of faders, knobs, buttons and meters on a chosen glass, each wired to an instrument variable, wearing a device theme or a look from the library.',
      inputs: [
        { name: 'Touch panel block', from: 'the CAD drawing when opened from the CAD', kind: 'cad' },
        { name: 'Block file', from: 'a .json saved by this editor or its .ifc twin (the panel, no layout), or a Gui_Frames frame, picked with Open (APKSoftapp.openModel)', kind: 'file' },
        { name: 'Instrument library', from: 'GET /api/instrument/api (WEB.OsApi, every <Model>.api.json) — the models and their variables', kind: 'http' },
        { name: 'Bench', from: 'GET /api/bim/instances, else /api/devices — the boxes online or remembered, re-read every 30 s', kind: 'http' },
        { name: 'Looks', from: 'GET /FrontEnd/api/tree.json — the widget library looks (vintage palettes are built in)', kind: 'http' },
        { name: 'A device\'s own panel', from: 'retained Gui/Panels/<device> when opened from a device link', kind: 'bus', topic: 'Gui/Panels/#' },
        { name: 'Discovered surfaces', from: 'what the bus has discovered; which kinds show is config/discovered.json', kind: 'bus' },
      ],
      outputs: [
        { name: 'Touch panel block', to: 'the CAD drawing on Save & Return; standalone, Save Model writes <name>.json beside its .ifc twin', kind: 'file' },
        { name: 'IFC twin', to: '<name>.ifc (IFC4X3_ADD2) with the .json when standalone: the panel an IfcUnitaryControlElement CONTROLPANEL in its room, its layout by hash and a document reference to the .json (js/touchPanelIfc.js)', kind: 'file' },
      ],
      controls: [
        { name: 'Add a control', how: 'Drag from the palette onto the glass, or + Add Widget' },
        { name: 'Wire a control', how: 'Pick a model / bench device on the left, then drag a variable onto a control or its schedule row; double-click a wire to disconnect' },
        { name: 'Pages', how: 'Tabs above the glass: click opens, + adds, double-click renames, drag reorders, ✕ deletes' },
        { name: 'Screen / name', how: 'Panel name and screen preset in the top bar' },
        { name: 'Theme and looks', how: '🎨 edits the device theme; 📚 Looks applies a look to the theme or the selected control (Esc closes)' },
        { name: 'Schedule', how: 'The control table: edit fields, ▾ Styles opens every style editor, ⤢ Pop Out (Esc docks)' },
        { name: 'Open / Save & Return / Close / Discovered', how: 'Top-bar buttons' },
      ],
      problems: ['fetch_failed', 'http_not_found', 'bad_json', 'bad_input', 'file_unreadable', 'bus_missing', 'device_stale', 'save_failed'],
    });
  }

  async loadLooks() {
    const lib = await loadLibraryLooks();
    this.lookFiles = lib.files || new Map();
    this.looks = [...VINTAGE_LOOKS, ...lib];
    this.lookById = new Map(this.looks.map(l => [l.id, l]));
    const btn = document.getElementById('btn-looks');
    if (btn) btn.textContent = `📚 Looks (${this.looks.length})`;
    if (!this.lookLibEl?.hidden) this.renderLookLibrary();
  }

  changed() {
    if (this.host) this.host.changed(panelBlock(this.panel));
    this.scheduleEngineGlass();
  }

  // ENGINE GLASS (ROAD-3499): the real widget engine draws the open page at its
  // true pixels behind the glass (frame host iframe beside the surface, so a
  // re-render of the surface never reloads it). The stand-ins stay on top,
  // invisible, so selecting, dragging, ports and wires work as before.
  setEngineGlass(on) {
    this.engineGlass = !!on;
    this.surfaceEl.classList.toggle('engine-on', this.engineGlass);
    const btn = document.getElementById('btn-engine-glass');
    if (btn) btn.classList.toggle('on', this.engineGlass);
    let frame = this.bezelEl.querySelector('iframe.engine-glass');
    if (!this.engineGlass) { if (frame) frame.hidden = true; return; }
    if (!frame) {
      frame = document.createElement('iframe');
      frame.className = 'engine-glass';
      frame.title = 'Engine glass';
      // ?readonly=1: the glass subscribes and draws what is retained (a lit
      // crosspoint) and its bus client sends NOTHING (MqttProvider
      // oaBusReadOnly) — opening a device's panel here can never move it.
      frame.src = '/FrontEnd/apkos-frame-host.html?readonly=1';
      this.bezelEl.insertBefore(frame, this.surfaceEl);
      window.addEventListener('message', (e) => {
        if (e.data?.type === 'apkos:frame-host-ready' && e.source === frame.contentWindow) this.postEngineGlass();
      });
    }
    frame.hidden = false;
    this.postEngineGlass();
  }

  scheduleEngineGlass() {
    if (!this.engineGlass) return;
    clearTimeout(this.engineTimer);
    this.engineTimer = setTimeout(() => this.postEngineGlass(), 250);
  }

  postEngineGlass() {
    const frame = this.bezelEl?.querySelector('iframe.engine-glass');
    if (!this.engineGlass || !frame?.contentWindow) return;
    frame.style.width = `${this.panel.width}px`;
    frame.style.height = `${this.panel.height}px`;
    const page = this.panel.pages.find(p => p.id === this.currentPage) || this.panel.pages[0];
    const one = { ...this.panel, pages: [page], widgets: this.panel.widgets.filter(w => this.isOnPage(w)) };
    // Drawn at the address the device's own window draws this frame (and its
    // fields at theirs), so what is lit there is lit here and the crosspoint
    // matrix finds its device on the bench by the same path (ROAD-3697).
    const out = panelToFrame(one, (w) => this.effectiveStyle(w), { prefixOf: guiPrefixOf });
    const windowPath = deviceWindowPath(this.panel, page);
    // Bare glass: no panel cover, no block title — the block IS the screen.
    const bin = Object.values(out).find(v => v && v.type === 'OcaBin') || out;
    bin.background = { enabled: false };
    for (const b of Object.values(bin.blocks || {})) b.description = { ...(b.description || {}), show_label: false };
    // The glass is a picture, never a sender: no control seeds its resting
    // value and nothing asks on load, so opening the editor on a device's panel
    // can not move the device (a seeded crosspoint is a CLOSE).
    inertFrame(out);
    frame.contentWindow.postMessage({ type: 'apkos:render-frame', layoutJson: out,
      filePath: windowPath || `TouchPanels/${this.panel.name || 'panel'}.json` }, '*');
  }

  initElements() {
    this.btnOpen = document.getElementById('btn-open');
    this.btnSave = document.getElementById('btn-save');
    this.btnClose = document.getElementById('btn-close');
    this.btnSyncDiscovered = document.getElementById('btn-sync-discovered');

    this.inputPanelName = document.getElementById('input-panel-name');
    this.selectPreset = document.getElementById('select-screen-preset');
    this.paletteEl = document.getElementById('palette-items');
    this.surfaceEl = document.getElementById('touchpanel-surface');
    this.tableBody = document.getElementById('widget-table-body');
    this.btnAddWidget = document.getElementById('btn-add-widget');

    this.workbenchEl = document.getElementById('workbench');
    this.stageEl = document.getElementById('canvas-stage');
    this.wireLayer = document.getElementById('wire-layer');
    this.devList = document.getElementById('dev-list');
    this.devCount = document.getElementById('dev-count');
    this.devSearch = document.getElementById('dev-search');
    this.varList = document.getElementById('var-list');
    this.varCount = document.getElementById('var-count');
    this.varSearch = document.getElementById('var-search');
    this.verbFiltersEl = document.getElementById('verb-filters');
    this.bezelEl = document.getElementById('touchpanel-bezel');
    this.glassFitEl = document.getElementById('glass-fit');
    this.glassScaleEl = document.getElementById('glass-scale');
    this.selectTheme = document.getElementById('select-theme');
    this.gridPanel = document.getElementById('data-grid-panel');
    this.themeEditor = document.getElementById('theme-editor');

    this.setupPresetDropdown();
    this.setupPalette();
    this.setupVerbFilters();
    this.setupThemeDropdown();
  }
}

mixInto(TouchPanelApp, TouchPanelLooks, TouchPanelEvents, TouchPanelVariables, TouchPanelWires, TouchPanelOpenSave, TouchPanelPages, TouchPanelSurface, TouchPanelTableFrame);

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    window.touchPanelApp = new TouchPanelApp();
  });
}
