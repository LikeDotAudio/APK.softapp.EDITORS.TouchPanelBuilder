// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import { connectTouchPanelHost, panelBlock, panelMeta, bindPanelDevice } from './touchPanelHost.js';
import { showDiscovered, loadDiscoveredConfig } from './discoveredPanel.js';
import { linkQuery, linkSearch, isPanelFor, panelFromPresented, panelFromVariables, wantFor, arrivals } from './devicePanel.js';
import {
  CONTROL_DEFINITIONS, STYLE_FIELDS, BEHAVIOR_FIELDS, STYLE_PRESETS, widgetStyleVars, rigHeight,
} from './controls.js';
import { VINTAGE_LOOKS, loadLibraryLooks, groupLooks, lookFromField } from './lookLibrary.js';
import { cloneControl, isHold, HOLD_MS } from './copyControl.js';
import {
  ControlLibrary, VERBS, VERB_LABEL, modelKey, suggestWidgetType,
  humanLabel, bindingFor, matchesQuery,
  agoText,
} from './library.js';

export const SCREEN_PRESETS = [
  { id: '10in', name: '10.1″ Touch Panel (1280 × 800)', w: 1280, h: 800 },
  { id: '7in', name: '7.0″ Tabletop Panel (1024 × 600)', w: 1024, h: 600 },
  { id: '15in', name: '15.6″ Wall Mount (1920 × 1080)', w: 1920, h: 1080 },
  { id: '22in', name: '21.5″ Main Console (1920 × 1080)', w: 1920, h: 1080 },
];

// Rows drawn in the variable column before "show more" — the DOM, not the
// library, is the limit: one Generator model alone carries over a thousand.
const VAR_PAGE = 1500;
const DRAG_MIME = 'application/x-apk-variable';

// What only the device as a whole has: the glass and the bezel around it.
const THEME_FIELDS = [
  { key: 'glassBg', label: 'Glass Background', kind: 'color' },
  { key: 'bezel', label: 'Bezel', kind: 'color' },
];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class TouchPanelApp {
  constructor() {
    this.panel = {
      id: 'tp_01',
      name: 'TP-STAGE-01',
      room: 'MAIN AUDITORIUM',
      screenPreset: '10in',
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
    this.deviceFor = new Map();        // model key -> bench device it was picked as
    this.varsByModel = new Map();      // model key -> variables[]
    this.varIndex = new Map();         // variable id -> variable
    this.verbFilter = new Set(VERBS);
    this.varQuery = '';
    this.devQuery = '';
    this.collapsed = new Set(['__offline']);
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
        { name: 'Block file', from: 'a .json saved by this editor, picked with Open', kind: 'file' },
        { name: 'Instrument library', from: 'GET /api/instrument/api (WEB.OsApi, every <Model>.api.json) — the models and their variables', kind: 'http' },
        { name: 'Bench', from: 'GET /api/bim/instances, else /api/devices — the boxes online or remembered, re-read every 30 s', kind: 'http' },
        { name: 'Looks', from: 'GET /FrontEnd/api/tree.json — the widget library looks (vintage palettes are built in)', kind: 'http' },
        { name: 'A device\'s own panel', from: 'retained Gui/Panels/<device> when opened from a device link', kind: 'bus', topic: 'Gui/Panels/#' },
        { name: 'Discovered surfaces', from: 'what the bus has discovered; which kinds show is config/discovered.json', kind: 'bus' },
      ],
      outputs: [
        { name: 'Touch panel block', to: 'the CAD drawing on Save & Return, or a .json download when standalone', kind: 'file' },
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
      problems: ['fetch_failed', 'http_not_found', 'bad_json', 'bad_input', 'file_unreadable', 'bus_missing', 'device_stale'],
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

  setupThemeDropdown() {
    if (!this.selectTheme) return;
    const opt = (v, label) => `<option value="${esc(v)}">${esc(label)}</option>`;
    const parts = [`<optgroup label="Stock">${Object.keys(STYLE_PRESETS).map(n => opt(`stock:${n}`, n)).join('')}</optgroup>`];
    for (const [g, list] of groupLooks(VINTAGE_LOOKS)) {
      parts.push(`<optgroup label="${esc(g)}">${list.map(l => opt(l.id, `${l.name} (${l.family})`)).join('')}</optgroup>`);
    }
    if (this.panel.savedLooks?.length) {
      parts.push(`<optgroup label="Added from the library">${this.panel.savedLooks.map(l => opt(l.id, `${l.name} · ${l.family || ''}`)).join('')}</optgroup>`);
    }
    parts.push(`<optgroup label="More">${opt('__browse', '📚 Browse the whole look library…')}</optgroup>`);
    this.selectTheme.innerHTML = parts.join('');
    this.selectTheme.value = this.panel.theme.id || `stock:${this.panel.theme.preset}`;
  }

  lookFor(id) {
    return this.lookById.get(id) || (this.panel.savedLooks || []).find(l => l.id === id) || null;
  }

  // Wear a look: as the device theme, on the selected control, or as a new control.
  applyLook(look, target = this.lookTarget) {
    if (!look) return;
    if (target === 'theme') {
      this.panel.theme = { id: look.id, preset: look.name, base: { ...look.style }, style: {} };
      if (look.source === 'library' && !this.panel.savedLooks.some(l => l.id === look.id)) {
        this.panel.savedLooks.push({ id: look.id, name: look.name, family: look.family, group: look.group, style: { ...look.style } });
      }
      this.setupThemeDropdown();
    } else {
      let w = target === 'control' ? this.widgetById(this.selectedWidgetId) : null;
      if (!w) {
        const type = look.widget || 'knob';
        const def = CONTROL_DEFINITIONS[type] || CONTROL_DEFINITIONS.button;
        w = {
          id: `w_${Date.now()}_${this.panel.widgets.length + 1}`,
          type,
          label: String(look.name || type).toUpperCase().slice(0, 20),
          ...this.freeSpot(def.w || 100, def.h || 60),
          w: def.w || 100,
          h: def.h || 60,
          address: `/control/param_${this.panel.widgets.length + 1}`,
          channel: 1,
          bindings: [],
        };
        this.panel.widgets.push(this.onPage(w));
      }
      w.style = { ...look.style };
      w.lookId = look.id;
      this.selectedWidgetId = w.id;
    }
    this.render();
    this.changed();
    const note = document.getElementById('look-lib-note');
    if (note) note.textContent = `✓ ${look.name} → ${target === 'theme' ? 'device theme' : target === 'control' ? 'selected control' : 'new control'}`;
  }

  openLookLibrary(target = 'theme') {
    this.lookTarget = target;
    this.lookLibEl.hidden = false;
    this.lookLibEl.querySelectorAll('[name="look-target"]').forEach(r => { r.checked = r.value === target; });
    this.renderLookLibrary();
  }

  mini(type, style, box, label = '') {
    const def = CONTROL_DEFINITIONS[type] || CONTROL_DEFINITIONS.button;
    const k = Math.min(box.w / def.w, box.h / def.h);
    const vars = Object.entries(widgetStyleVars({ style })).map(([n, v]) => `${n}:${v}`).join(';');
    return `<div style="width:${Math.round(def.w * k)}px; height:${Math.round(def.h * k)}px; position:relative; flex:none; ${esc(vars)}">
      <div style="width:${def.w}px; height:${def.h}px; transform:scale(${k}); transform-origin:0 0; position:absolute;">${def.render({ label, style })}</div></div>`;
  }

  lookPreview(look) {
    const vars = Object.entries(widgetStyleVars({ style: look.style })).map(([k, v]) => `${k}:${v}`).join(';');
    const bg = esc(look.style.glassBg || '#121212');
    if (look.preview === 'strip') {
      // A console is its channel strip: rows of knobs (each row its own cap
      // colour), the switches, then the fader.
      const rows = (look.rows && look.rows.length ? look.rows : [look.style.cap]).slice(0, 4);
      const knobRows = rows.map(cap => `<div style="display:flex; gap:2px;">${
        [0, 1].map(() => this.mini('knob', { ...look.style, cap }, { w: 30, h: 24 })).join('')}</div>`).join('');
      return `<div class="look-prev strip" style="${esc(vars)}; background:${bg}">
        <div style="display:flex; flex-direction:column; gap:1px; align-items:center; background:${esc(look.style.bg)}; padding:3px; border-radius:3px;">
          ${knobRows}<div style="display:flex; gap:3px;">${this.mini('button', look.style, { w: 28, h: 16 })}${this.mini('button', look.style, { w: 28, h: 16 })}</div></div>
        ${this.mini('fader', look.style, { w: 40, h: 122 })}</div>`;
    }
    const types = look.widget ? [look.widget] : Array.isArray(look.preview) ? look.preview : ['knob', 'fader', 'button'];
    const w = 170 / types.length;
    const minis = types.map(t => this.mini(t, look.style, { w, h: 116 })).join('');
    return `<div class="look-prev" style="${esc(vars)}; background:${bg}">${minis}</div>`;
  }

  // THE LIVE FACTORY VIEW: the shelf's own frame, drawn by the real widget
  // engine (FrontEnd/apkos-frame-host.html, same origin). A click on any widget
  // in it makes that exact element a look.
  renderLiveView(files) {
    const host = this.lookLibEl.querySelector('#look-live');
    if (!this.lookFile || !files.includes(this.lookFile)) this.lookFile = files[0] || '';
    const sel = this.lookLibEl.querySelector('#look-file');
    sel.innerHTML = files.map(f => `<option value="${esc(f)}" ${f === this.lookFile ? 'selected' : ''}>${esc(f.split('/').slice(-2).join(' / ').replace(/\.json$/, ''))}</option>`).join('');
    const content = this.lookFiles.get(this.lookFile);
    if (!content) { host.innerHTML = '<div class="lib-empty">No frame for this shelf.</div>'; return; }
    let frame = host.querySelector('iframe');
    if (!frame) {
      host.innerHTML = '<iframe title="Widget library" src="/FrontEnd/apkos-frame-host.html"></iframe>';
      frame = host.querySelector('iframe');
      frame.addEventListener('load', () => this.armLiveFrame(frame));
    }
    this.liveFrame = frame;
    this.postLiveFrame();
  }

  postLiveFrame() {
    const frame = this.liveFrame;
    const content = this.lookFiles.get(this.lookFile);
    if (!frame || !content || !frame.contentWindow) return;
    frame.contentWindow.postMessage({ type: 'apkos:render-frame', layoutJson: content, filePath: this.lookFile }, '*');
  }

  armLiveFrame(frame) {
    if (!this.liveMsg) {
      this.liveMsg = (e) => {
        if (e.data?.type === 'apkos:frame-host-ready' && e.source === this.liveFrame?.contentWindow) this.postLiveFrame();
      };
      window.addEventListener('message', this.liveMsg);
    }
    let doc;
    try { doc = frame.contentDocument; } catch (_) { return; }
    if (!doc) return;
    const st = doc.createElement('style');
    st.textContent = '[data-oca-path*=".fields."]:hover{outline:2px solid #F4902C; outline-offset:2px; cursor:copy;}';
    doc.head.appendChild(st);
    doc.addEventListener('click', (e) => {
      const el = e.target.closest?.('[data-oca-path*=".fields."]');
      if (!el) return;
      e.preventDefault();
      e.stopPropagation();
      const path = el.getAttribute('data-oca-path');
      const content = this.lookFiles.get(this.lookFile);
      const node = path.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), content);
      const key = path.split('.').pop();
      const look = lookFromField(this.lookFile, key, node);
      if (look) {
        this.lookById.set(look.id, look);
        this.applyLook(look);
      } else {
        const note = this.lookLibEl.querySelector('#look-lib-note');
        if (note) note.textContent = `${key}: not a control with colours`;
      }
    }, true);
  }

  renderLookLibrary() {
    const el = this.lookLibEl;
    if (!el || el.hidden) return;
    const groups = groupLooks(this.looks);
    if (!groups.has(this.lookGroup)) this.lookGroup = [...groups.keys()][0];
    const q = this.lookQuery.toLowerCase();
    const inGroup = q
      ? this.looks.filter(l => `${l.name} ${l.family} ${l.group} ${l.widget || ''}`.toLowerCase().includes(q))
      : groups.get(this.lookGroup) || [];
    el.querySelector('#look-groups').innerHTML = [...groups.entries()].map(([g, list]) =>
      `<div class="lib-row ${g === this.lookGroup && !q ? 'on' : ''}" data-look-group="${esc(g)}">
        <span class="main"><span>${esc(g.replace(/^Library · /, ''))}</span><span class="sub">${g.startsWith('Library') ? 'widget library' : 'era palettes'}</span></span>
        <span class="n">${list.length}</span></div>`).join('');
    el.querySelector('#look-count').textContent = `${this.looks.length.toLocaleString()} looks · showing ${Math.min(inGroup.length, this.lookLimit)} of ${inGroup.length}`;
    const files = [...new Set(inGroup.filter(l => l.path).map(l => l.path))];
    const live = !q && this.lookView === 'live' && files.length > 0;
    el.querySelector('#look-viewbar').hidden = files.length === 0 || !!q;
    el.querySelectorAll('[data-look-view]').forEach(b => b.classList.toggle('on', b.dataset.lookView === this.lookView));
    el.querySelector('#look-file').hidden = !live;
    el.querySelector('#look-live').hidden = !live;
    el.querySelector('#look-grid').hidden = live;
    if (live) this.renderLiveView(files);
    const cards = inGroup.slice(0, this.lookLimit).map(l => `
      <div class="look-card" data-look="${esc(l.id)}" title="${esc(l.group)} · ${esc(l.family)}${l.path ? '\n' + esc(l.path) : ''}">
        ${this.lookPreview(l)}
        <div class="look-name">${esc(l.name)}</div>
        <div class="look-fam">${esc(l.family)}${l.widget ? ' · ' + esc(l.widget) : ''}</div>
        <div class="look-sw">${['bg', 'border', 'accent', 'cap', 'text'].filter(k => l.style[k]).map(k => `<i style="background:${esc(l.style[k])}" title="${k} ${esc(l.style[k])}"></i>`).join('')}</div>
      </div>`).join('');
    el.querySelector('#look-grid').innerHTML = cards
      + (inGroup.length > this.lookLimit ? `<div class="lib-more"><button class="btn btn-secondary btn-sm" id="look-more">Show more</button></div>` : '');
    el.querySelectorAll('[data-look-group]').forEach(r => r.addEventListener('click', () => {
      this.lookGroup = r.dataset.lookGroup;
      this.lookQuery = '';
      el.querySelector('#look-search').value = '';
      this.lookLimit = 240;
      this.renderLookLibrary();
    }));
    el.querySelectorAll('.look-card').forEach(c => c.addEventListener('click', () => this.applyLook(this.lookFor(c.dataset.look))));
    el.querySelector('#look-more')?.addEventListener('click', () => { this.lookLimit += 240; this.renderLookLibrary(); });
  }

  setupPresetDropdown() {
    this.selectPreset.innerHTML = '';
    SCREEN_PRESETS.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      this.selectPreset.appendChild(opt);
    });
    this.selectPreset.value = this.panel.screenPreset;
  }

  setupPalette() {
    this.paletteEl.innerHTML = '';
    Object.values(CONTROL_DEFINITIONS).forEach(c => {
      const btn = document.createElement('div');
      btn.className = 'btn btn-secondary btn-sm';
      btn.style.display = 'flex';
      btn.style.alignItems = 'center';
      btn.style.gap = '6px';
      btn.style.cursor = 'pointer';
      btn.innerHTML = `<span>${c.icon}</span> <span>${c.name}</span>`;
      btn.addEventListener('click', () => {
        this.addWidget(c.type);
      });
      this.paletteEl.appendChild(btn);
    });
  }

  setupVerbFilters() {
    this.verbFiltersEl.innerHTML = '';
    VERBS.forEach(v => {
      const chip = document.createElement('span');
      chip.className = `verb-chip verb-${v} ${this.verbFilter.has(v) ? 'on' : ''}`;
      chip.textContent = VERB_LABEL[v];
      chip.title = {
        set: 'Set — write one value',
        do: 'Do — fire an action',
        rig: 'Rig — configure several at once',
        get: 'Get — read a value back (meters, readouts)',
      }[v];
      chip.addEventListener('click', () => {
        if (this.verbFilter.has(v)) this.verbFilter.delete(v); else this.verbFilter.add(v);
        chip.classList.toggle('on', this.verbFilter.has(v));
        this.varLimit = VAR_PAGE;
        this.renderVariables();
      });
      this.verbFiltersEl.appendChild(chip);
    });
  }

  attachEvents() {
    this.btnOpen?.addEventListener('click', () => this.promptOpen());
    document.getElementById('btn-link')?.addEventListener('click', () => this.copyLink());
    this.btnSave?.addEventListener('click', () => this.saveBlock());
    this.btnClose?.addEventListener('click', () => { if (this.host) this.host.close(); });
    this.btnSyncDiscovered?.addEventListener('click', () => this.toggleDiscovered());

    this.inputPanelName.addEventListener('input', (e) => {
      this.panel.name = e.target.value;
      this.changed();
    });

    this.selectPreset.addEventListener('change', (e) => {
      const p = SCREEN_PRESETS.find(pr => pr.id === e.target.value);
      if (p) {
        // The layout follows the glass: every control keeps its place and
        // proportion on the new resolution.
        const sx = p.w / this.panel.width;
        const sy = p.h / this.panel.height;
        this.panel.widgets.forEach(w => {
          w.x = Math.round(w.x * sx);
          w.y = Math.round(w.y * sy);
          w.w = Math.round(w.w * sx);
          w.h = Math.round(w.h * sy);
        });
        this.panel.screenPreset = p.id;
        this.panel.width = p.w;
        this.panel.height = p.h;
        this.render();
        this.changed();
      }
    });

    this.selectTheme?.addEventListener('change', (e) => {
      const v = e.target.value;
      if (v === '__browse') {
        this.setupThemeDropdown();
        this.openLookLibrary('theme');
        return;
      }
      if (v.startsWith('stock:')) {
        this.panel.theme = { preset: v.slice(6), style: {} };
      } else {
        const look = this.lookFor(v);
        if (look) this.panel.theme = { id: look.id, preset: look.name, base: { ...look.style }, style: {} };
      }
      this.render();
      this.changed();
    });

    this.lookLibEl = document.getElementById('look-lib');
    document.getElementById('btn-looks')?.addEventListener('click', () =>
      this.openLookLibrary(this.selectedWidgetId ? 'control' : 'theme'));
    this.lookLibEl?.querySelector('#look-close')?.addEventListener('click', () => { this.lookLibEl.hidden = true; });
    this.lookLibEl?.querySelector('#look-search')?.addEventListener('input', (e) => {
      this.lookQuery = e.target.value.trim();
      this.lookLimit = 240;
      this.renderLookLibrary();
    });
    this.lookLibEl?.querySelectorAll('[data-look-view]').forEach(b => b.addEventListener('click', () => {
      this.lookView = b.dataset.lookView;
      this.renderLookLibrary();
    }));
    this.lookLibEl?.querySelector('#look-file')?.addEventListener('change', (e) => {
      this.lookFile = e.target.value;
      this.postLiveFrame();
    });
    this.lookLibEl?.querySelectorAll('[name="look-target"]').forEach(r =>
      r.addEventListener('change', () => { this.lookTarget = r.value; }));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.lookLibEl && !this.lookLibEl.hidden) this.lookLibEl.hidden = true;
    });
    document.getElementById('btn-theme')?.addEventListener('click', () => this.setPopped(true, true));
    document.getElementById('btn-popout')?.addEventListener('click', () => this.setPopped(!this.gridPanel.classList.contains('popped')));
    document.getElementById('btn-expand-all')?.addEventListener('click', () => {
      const all = this.panel.widgets.every(w => this.expanded.has(w.id));
      this.expanded = all ? new Set() : new Set(this.panel.widgets.map(w => w.id));
      this.renderTable();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.gridPanel?.classList.contains('popped')) this.setPopped(false);
    });
    this.setupGridResize();
    this.themeEditor?.addEventListener('input', (e) => this.onFieldInput(e));
    this.tableBody?.addEventListener('input', (e) => this.onFieldInput(e));
    window.addEventListener('resize', () => this.fitGlass());

    this.btnAddWidget?.addEventListener('click', () => {
      this.addWidget('button');
    });

    this.devSearch.addEventListener('input', (e) => {
      this.devQuery = e.target.value.trim().toLowerCase();
      this.renderDevices();
    });

    this.varSearch.addEventListener('input', (e) => {
      this.varQuery = e.target.value.trim();
      this.varLimit = VAR_PAGE;
      this.renderVariables();
    });

    // Wires follow everything that moves.
    [this.devList, this.varList, this.stageEl].forEach(el =>
      el.addEventListener('scroll', () => this.scheduleWires(), { passive: true }));
    window.addEventListener('resize', () => this.scheduleWires());

    // Bare glass accepts a dropped variable: make a control for it.
    this.surfaceEl.addEventListener('dragover', (e) => {
      if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'link';
      this.markDropTarget(e.target.closest('.touch-widget') || this.surfaceEl);
    });
    this.surfaceEl.addEventListener('dragleave', (e) => {
      if (!this.surfaceEl.contains(e.relatedTarget)) this.markDropTarget(null);
    });
    this.surfaceEl.addEventListener('drop', (e) => {
      const vid = e.dataTransfer.getData(DRAG_MIME);
      this.markDropTarget(null);
      if (!vid) return;
      e.preventDefault();
      const v = this.varIndex.get(vid);
      if (!v) return;
      const wEl = e.target.closest('.touch-widget');
      if (wEl) {
        this.bindVariable(this.widgetById(wEl.dataset.wid), v);
      } else {
        const r = this.surfaceEl.getBoundingClientRect();
        this.createWidgetFor(v, Math.round((e.clientX - r.left) / this.glassScale), Math.round((e.clientY - r.top) / this.glassScale));
      }
    });

    this.surfaceEl.addEventListener('mousedown', (e) => {
      if (e.target === this.surfaceEl) {
        this.selectWidget(null);
      }
    });
  }

  // ------------------------------------------------------------------ library

  async loadLibrary() {
    this.devCount.textContent = 'loading…';
    await this.library.load();
    if (this.library.error && !this.library.totalModels) {
      this.devCount.textContent = 'offline';
      this.devList.innerHTML = `<div class="lib-empty">The instrument library did not answer
        (<code>/api/instrument/api</code>): ${esc(this.library.error.message)}.<br><br>
        It is served by WEB.OsApi from PODS/POD.THICK/INSTRUMENTS. Open this editor through the
        portal (:8080) so the route resolves.</div>`;
      this.renderVariables();
      window.APKSoftapp?.showProblem(this.library.error, {
        subject: 'Instrument library (/api/instrument/api)',
        fix: ['Open this editor through the portal (:8080) so /api/instrument/api resolves: WEB.OsApi serves it from PODS/POD.THICK/INSTRUMENTS.',
          'If the portal is up, bring WEB.OsApi up (up-stack.sh WEB.OsApi), then Retry.'],
        onRetry: () => { this.libraryReady = this.loadLibrary(); },
      });
      return;
    }

    // Start on what this panel is already wired to, else what is on the bench,
    // else the first model the library holds — never an empty right column.
    const bound = [...new Set(this.panel.widgets.flatMap(w =>
      (w.bindings || []).map(b => modelKey(b.family, b.model))))].filter(k => this.library.models.has(k));
    const bench = [...new Set(this.library.bench.map(d => modelKey(d.family, d.model)))]
      .filter(k => this.library.models.has(k));
    const first = this.library.families[0]?.models[0]?.key;
    this.selectedModels = bound.length ? bound : bench.length ? bench.slice(0, 3) : first ? [first] : [];
    // A model picked because a box of it is on the bench binds to that box.
    for (const d of this.library.bench) {
      const k = modelKey(d.family, d.model);
      if (!this.deviceFor.has(k)) this.deviceFor.set(k, d);
    }

    this.renderDevices();
    this.updateDeviceTabs();
    await this.loadSelectedVariables();
    // Liveness moves while you work: re-ask the bench every 30 s.
    if (!this.benchTimer) {
      this.benchTimer = setInterval(async () => {
        await this.library.refreshBench();
        this.renderDevices();
        this.updateDeviceTabs();
      }, 30000);
    }
  }

  async loadSelectedVariables() {
    this.renderVariables(true);
    const keys = [...this.selectedModels];
    await Promise.all(keys.map(async key => {
      if (this.varsByModel.has(key)) return;
      try {
        const vars = await this.library.variables(key);
        this.varsByModel.set(key, vars);
        vars.forEach(v => this.varIndex.set(v.id, v));
      } catch (err) {
        this.varsByModel.set(key, { error: err });
        window.APKSoftapp?.showProblem(err, {
          subject: `Variables of ${key}`,
          fix: [`The model's api.json is read from /api/instrument/api?model=…&family=… (WEB.OsApi). Check it is in PODS/POD.THICK/INSTRUMENTS and the image is current.`],
          onRetry: () => { this.varsByModel.delete(key); this.loadSelectedVariables(); },
        });
      }
    }));
    this.renderVariables();
  }

  selectModel(key, { additive = false, device = null } = {}) {
    if (device) this.deviceFor.set(key, device);
    if (additive) {
      const i = this.selectedModels.indexOf(key);
      if (i >= 0) this.selectedModels.splice(i, 1); else this.selectedModels.push(key);
    } else {
      this.selectedModels = [key];
    }
    this.varLimit = VAR_PAGE;
    this.renderDevices();
    this.loadSelectedVariables();
  }

  selectFamily(fam) {
    this.selectedModels = fam.models.map(m => m.key);
    this.varLimit = VAR_PAGE;
    this.renderDevices();
    this.loadSelectedVariables();
  }

  boundCountByModel() {
    const counts = new Map();
    this.panel.widgets.forEach(w => (w.bindings || []).forEach(b => {
      const k = modelKey(b.family, b.model);
      counts.set(k, (counts.get(k) || 0) + 1);
    }));
    return counts;
  }

  renderDevices() {
    const lib = this.library;
    const q = this.devQuery;
    const bound = this.boundCountByModel();
    const sel = new Set(this.selectedModels);
    const parts = [];

    this.devCount.textContent = `${lib.totalModels} devices · ${lib.totalVariables.toLocaleString()} variables`;

    // ONLINE / RECENT / UNKNOWN are pinned open at the top; offline boxes stay
    // listed (greyed) under them so bindings to a switched-off box survive.
    const benchRows = lib.bench.filter(d => !q || `${d.name} ${d.make} ${d.model} ${d.family} ${d.address}`.toLowerCase().includes(q));
    const nowSecs = Math.floor(Date.now() / 1000);
    const benchRow = (d) => {
      const i = lib.bench.indexOf(d);
      const k = d.known ? modelKey(d.family, d.model) : '';
      const label = [d.icon, d.make, d.model].filter(Boolean).join(' ') || d.name;
      return `<div class="lib-row bench ${d.liveness} ${k && sel.has(k) ? 'on' : ''}" ${k ? `data-mkey="${esc(k)}"` : ''} data-bench="${i}"
          title="${esc(d.name)} · ${esc(d.liveness)} · ${esc(agoText(d.lastSeen, nowSecs))}${d.address ? '\n' + esc(d.address) : ''}">
        <span class="dot ${d.liveness}"></span>
        <span class="main"><span>${esc(label)}</span><span class="sub">${esc(d.name)} · ${esc(d.liveness === 'unknown' ? 'status unknown' : agoText(d.lastSeen, nowSecs))}</span></span>
        ${k && bound.get(k) ? `<span class="bound">${bound.get(k)}⇄</span>` : ''}
        <span class="n">${d.known ? d.variables : '—'}</span></div>`;
    };
    const live = benchRows.filter(d => d.liveness !== 'offline');
    const off = benchRows.filter(d => d.liveness === 'offline');
    const counts = ['online', 'recent', 'unknown'].map(l => [l, live.filter(d => d.liveness === l).length]).filter(([, n]) => n);
    parts.push(`<div class="lib-group pinned"><span class="grow">Online &amp; recent</span>
      <span>${counts.map(([l, n]) => `<i class="dot ${l}"></i>${n}`).join(' ') || '0'}</span></div>`);
    parts.push(live.length ? live.map(benchRow).join('') : '<div class="lib-empty">Nothing online or seen recently.</div>');
    if (off.length) {
      const open = !this.collapsed.has('__offline') || q;
      parts.push(`<div class="lib-group" data-group="__offline"><span>${open ? '▾' : '▸'}</span>
        <span class="grow">Offline · kept for bindings</span><span>${off.length}</span></div>`);
      if (open) parts.push(off.map(benchRow).join(''));
    }

    lib.families.forEach(fam => {
      const models = fam.models.filter(m => !q ||
        `${m.model} ${m.manufacturer} ${m.notes} ${m.family}`.toLowerCase().includes(q));
      if (!models.length) return;
      const open = !this.collapsed.has(fam.family) || q;
      parts.push(`<div class="lib-group" data-group="${esc(fam.family)}"><span>${open ? '▾' : '▸'}</span>
        <span class="grow">${esc(fam.family)}</span>
        <span title="List every model's variables">${models.length} · ${fam.variables.toLocaleString()}</span>
        <button class="verb-chip" data-family-all="${esc(fam.family)}" title="List all ${models.length} models">all</button></div>`);
      if (!open) return;
      models.forEach(m => {
        parts.push(`<div class="lib-row ${sel.has(m.key) ? 'on' : ''}" data-mkey="${esc(m.key)}">
          <span class="main"><span>${esc(m.model)}</span><span class="sub">${esc(m.manufacturer)}${m.notes ? ' · ' + esc(m.notes) : ''}</span></span>
          ${bound.get(m.key) ? `<span class="bound" title="controls wired to it">${bound.get(m.key)}⇄</span>` : ''}
          <span class="n" title="controllable variables">${m.variables}</span></div>`);
      });
    });

    if (!parts.length) parts.push('<div class="lib-empty">No device matches.</div>');
    this.devList.innerHTML = parts.join('');

    this.devList.querySelectorAll('.lib-group').forEach(g => g.addEventListener('click', (e) => {
      const famAll = e.target.closest('[data-family-all]');
      if (famAll) {
        e.stopPropagation();
        const fam = lib.families.find(f => f.family === famAll.dataset.familyAll);
        if (fam) this.selectFamily(fam);
        return;
      }
      const k = g.dataset.group;
      if (this.collapsed.has(k)) this.collapsed.delete(k); else this.collapsed.add(k);
      this.renderDevices();
    }));
    this.devList.querySelectorAll('.lib-row').forEach(r => r.addEventListener('click', (e) => {
      const device = r.dataset.bench !== undefined ? lib.bench[Number(r.dataset.bench)] : null;
      if (!r.dataset.mkey) return; // a box the instrument library has no api for
      this.selectModel(r.dataset.mkey, { additive: e.shiftKey || e.ctrlKey || e.metaKey, device });
    }));
    this.scheduleWires();
  }

  renderVariables(loading = false) {
    const boundIds = new Set(this.panel.widgets.flatMap(w => (w.bindings || []).map(b => b.id)));
    const parts = [];
    let shown = 0;
    let matched = 0;
    let total = 0;
    let truncated = false;

    for (const key of this.selectedModels) {
      const vars = this.varsByModel.get(key);
      const m = this.library.models.get(key);
      const dev = this.deviceFor.get(key);
      const head = `${esc(m?.model || key)}${dev ? ' · ' + esc(dev.name) : ''}`;
      if (!vars) {
        parts.push(`<div class="lib-group"><span class="grow">${head}</span><span>loading…</span></div>`);
        continue;
      }
      if (vars.error) {
        parts.push(`<div class="lib-group"><span class="grow">${head}</span><span>failed</span></div>
          <div class="lib-empty">${esc(vars.error.message)}</div>`);
        continue;
      }
      total += vars.length;
      const rows = vars.filter(v => this.verbFilter.has(v.verb) && matchesQuery(v, this.varQuery));
      matched += rows.length;
      parts.push(`<div class="lib-group" data-mkey="${esc(key)}"><span class="grow">${head}</span>
        <span>${rows.length}${rows.length !== vars.length ? ' / ' + vars.length : ''}</span></div>`);
      for (const v of rows) {
        if (shown >= this.varLimit) { truncated = true; break; }
        shown += 1;
        const extra = [v.subsystem, v.scpi, v.values ? v.values.slice(0, 6).join('|') : v.kind !== 'none' ? v.kind : '']
          .filter(Boolean).join(' · ');
        parts.push(`<div class="lib-row var-row ${boundIds.has(v.id) ? 'bound' : ''}" draggable="true" data-vid="${esc(v.id)}"
            title="${esc(v.description)}\n${esc(v.scpi)}${v.topic ? '\n' + esc(v.topic) : ''}">
          <span class="port"></span>
          <span class="verb verb-${v.verb}">${VERB_LABEL[v.verb].toUpperCase()}</span>
          <span class="main"><span>${esc(v.command)}</span><span class="sub">${esc(extra)}</span></span>
          <button class="add" title="Wire to the selected control (or make one)">＋</button></div>`);
      }
      if (truncated) break;
    }

    if (truncated) {
      parts.push(`<div class="lib-more"><button class="btn btn-secondary btn-sm" id="var-more">Show ${VAR_PAGE} more</button></div>`);
    }
    if (!this.selectedModels.length) {
      parts.push('<div class="lib-empty">Pick a device on the left to list everything it can be told to do.</div>');
    }

    this.varCount.textContent = loading && !total ? 'loading…'
      : `${matched.toLocaleString()} of ${total.toLocaleString()} in ${this.selectedModels.length} device${this.selectedModels.length === 1 ? '' : 's'}`;
    this.varList.innerHTML = parts.join('');

    this.varList.querySelector('#var-more')?.addEventListener('click', () => {
      this.varLimit += VAR_PAGE;
      this.renderVariables();
    });

    this.varList.querySelectorAll('.var-row').forEach(row => {
      const v = this.varIndex.get(row.dataset.vid);
      row.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData(DRAG_MIME, v.id);
        e.dataTransfer.setData('text/plain', v.topic || v.id);
        e.dataTransfer.effectAllowed = 'link';
      });
      row.addEventListener('dragend', () => this.markDropTarget(null));
      row.querySelector('.add').addEventListener('click', (e) => {
        e.stopPropagation();
        const w = this.widgetById(this.selectedWidgetId);
        if (w) this.bindVariable(w, v); else this.createWidgetFor(v);
      });
      row.addEventListener('click', () => {
        // Select the first control already wired here, so the wire lights up.
        const w = this.panel.widgets.find(x => (x.bindings || []).some(b => b.id === v.id));
        if (w) this.selectWidget(w.id);
      });
    });
    this.scheduleWires();
  }

  // ------------------------------------------------------------------ binding

  widgetById(id) {
    return this.panel.widgets.find(w => w.id === id) || null;
  }

  bindVariable(w, v) {
    if (!w || !v) return;
    w.bindings = w.bindings || [];
    if (!w.bindings.some(b => b.id === v.id)) {
      w.bindings.push(bindingFor(v, this.deviceFor.get(modelKey(v.family, v.model))));
    }
    if (!w.address || /^\/control\/param_\d+$/.test(w.address)) {
      w.address = v.topic || `/${v.family}/${v.model}/${v.command}`;
    }
    this.selectedWidgetId = w.id;
    this.afterBindingChange();
  }

  unbind(w, bindingId) {
    if (!w) return;
    w.bindings = (w.bindings || []).filter(b => b.id !== bindingId);
    this.afterBindingChange();
  }

  afterBindingChange() {
    this.render();
    this.renderDevices();
    this.renderVariables();
    this.changed();
  }

  createWidgetFor(v, x = null, y = null) {
    const type = suggestWidgetType(v);
    const base = CONTROL_DEFINITIONS[type] || CONTROL_DEFINITIONS.button;
    // A rig / nab is as tall as its arguments: one row each.
    const multi = type === 'rig' || type === 'nab';
    const def = multi ? { ...base, h: rigHeight((v.args || []).length) } : base;
    const n = this.panel.widgets.length + 1;
    const widget = {
      id: `w_${Date.now()}_${n}`,
      type,
      label: humanLabel(v.command),
      ...(x != null
        ? { x: Math.max(0, x - Math.round((def.w || 100) / 2)), y: Math.max(0, y - Math.round((def.h || 60) / 2)) }
        : this.freeSpot(def.w || 100, def.h || 60)),
      w: def.w || 100,
      h: def.h || 60,
      address: '',
      channel: 1,
      bindings: [],
    };
    if (v.values && type === 'tile') widget.subtitle = v.values.slice(0, 4).join(' · ');
    if (multi) widget.behavior = { args: v.args || [] };
    this.panel.widgets.push(this.onPage(widget));
    this.bindVariable(widget, v);
  }

  // First gap on the glass a w×h control fits in, scanning rows top-left first.
  freeSpot(w, h) {
    const W = this.panel.width || 1280;
    const H = this.panel.height || 800;
    const gap = 10;
    const hits = (x, y) => this.panel.widgets.filter(o => this.isOnPage(o)).some(o =>
      x < o.x + o.w + gap && x + w + gap > o.x && y < o.y + o.h + gap && y + h + gap > o.y);
    for (let y = 20; y + h <= H - 10; y += 10) {
      for (let x = 20; x + w <= W - 10; x += 10) {
        if (!hits(x, y)) return { x, y };
      }
    }
    const n = this.panel.widgets.length;
    return { x: 30 + (n * 30) % 400, y: 40 + (n * 20) % 200 };
  }

  revealBinding(b) {
    const key = modelKey(b.family, b.model);
    const show = () => {
      const row = this.varList.querySelector(`[data-vid="${CSS.escape(b.id)}"]`);
      if (row) {
        row.scrollIntoView({ block: 'center' });
        row.classList.add('flash');
        setTimeout(() => row.classList.remove('flash'), 900);
      }
    };
    if (!this.selectedModels.includes(key) && this.library.models.has(key)) {
      this.selectedModels.push(key);
      this.renderDevices();
      this.loadSelectedVariables().then(show);
    } else {
      show();
    }
  }

  markDropTarget(el) {
    if (this.dropTarget === el) return;
    this.dropTarget?.classList.remove('drop-target');
    this.dropTarget = el;
    el?.classList.add('drop-target');
  }

  // ------------------------------------------------------------------ wires

  scheduleWires() {
    if (this.wireFrame) return;
    this.wireFrame = requestAnimationFrame(() => {
      this.wireFrame = 0;
      this.drawWires();
    });
  }

  drawWires(temp = null) {
    const svg = this.wireLayer;
    if (!svg || !this.workbenchEl) return;
    const base = this.workbenchEl.getBoundingClientRect();
    const varBox = this.varList.getBoundingClientRect();
    const devBox = this.devList.getBoundingClientRect();
    const clampY = (y, box) => Math.min(Math.max(y, box.top + 4), box.bottom - 4);
    const paths = [];

    for (const w of this.panel.widgets) {
      if (!w.bindings?.length) continue;
      const wEl = this.surfaceEl.querySelector(`[data-wid="${CSS.escape(w.id)}"]`);
      if (!wEl) continue;
      const wr = wEl.getBoundingClientRect();
      const sel = w.id === this.selectedWidgetId ? ' sel' : '';

      for (const b of w.bindings) {
        let x1 = wr.right + 6;
        const y1 = wr.top + wr.height / 2;
        let x2;
        let y2;
        let off = '';
        const row = this.varList.querySelector(`[data-vid="${CSS.escape(b.id)}"]`);
        if (row) {
          const rr = row.getBoundingClientRect();
          x2 = rr.left + 9;
          y2 = rr.top + rr.height / 2;
          if (y2 < varBox.top || y2 > varBox.bottom) { y2 = clampY(y2, varBox); off = ' off'; }
        } else {
          // Not listed on the right: run the wire to its device on the left.
          const dev = this.devList.querySelector(`[data-mkey="${CSS.escape(modelKey(b.family, b.model))}"]`);
          if (!dev) continue;
          const dr = dev.getBoundingClientRect();
          x1 = wr.left - 6;
          x2 = dr.right - 2;
          y2 = clampY(dr.top + dr.height / 2, devBox);
          off = ' off';
        }
        const d = this.curve(x1 - base.left, y1 - base.top, x2 - base.left, y2 - base.top);
        paths.push(`<path class="wire${sel}${off}" d="${d}"/>`);
        paths.push(`<path class="hit" d="${d}" data-wid="${esc(w.id)}" data-bid="${esc(b.id)}"><title>${esc(w.label)} ⇄ ${esc(b.model)} ${esc(b.command)}\nClick to show · double-click to disconnect</title></path>`);
      }
    }

    if (temp) {
      paths.push(`<path class="wire temp" d="${this.curve(temp.x1 - base.left, temp.y1 - base.top, temp.x2 - base.left, temp.y2 - base.top)}"/>`);
    }

    svg.innerHTML = paths.join('');
    svg.querySelectorAll('path.hit').forEach(p => {
      p.addEventListener('click', () => {
        const w = this.widgetById(p.dataset.wid);
        const b = w?.bindings?.find(x => x.id === p.dataset.bid);
        this.selectWidget(p.dataset.wid);
        if (b) this.revealBinding(b);
      });
      p.addEventListener('dblclick', () => this.unbind(this.widgetById(p.dataset.wid), p.dataset.bid));
    });
  }

  curve(x1, y1, x2, y2) {
    const dx = Math.max(40, Math.abs(x2 - x1) * 0.45) * (x2 >= x1 ? 1 : -1);
    return `M${x1.toFixed(1)},${y1.toFixed(1)} C${(x1 + dx).toFixed(1)},${y1.toFixed(1)} ${(x2 - dx).toFixed(1)},${y2.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}`;
  }

  startPortDrag(e, w) {
    e.preventDefault();
    e.stopPropagation();
    this.selectWidget(w.id);
    const port = e.currentTarget.getBoundingClientRect();
    const x1 = port.left + port.width / 2;
    const y1 = port.top + port.height / 2;

    const onMove = (me) => {
      this.drawWires({ x1, y1, x2: me.clientX, y2: me.clientY });
    };
    const onUp = (ue) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      const target = document.elementFromPoint(ue.clientX, ue.clientY);
      const row = target?.closest('.var-row');
      const dev = target?.closest('#dev-list .lib-row');
      if (row) {
        this.bindVariable(w, this.varIndex.get(row.dataset.vid));
      } else if (dev) {
        this.selectModel(dev.dataset.mkey, { additive: true });
      }
      this.drawWires();
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  // ------------------------------------------------------------------ panel

  loadInitialData() {
    this.loadSampleLayout();
  }

  /** The Discovered panel: what the bus knows (APKSoftapp.discovered); Bind ties this panel to one by MAC / serial. */
  async toggleDiscovered() {
    const panel = document.getElementById('discovered-panel');
    if (!panel) return;
    panel.hidden = !panel.hidden;
    if (panel.hidden || panel.dataset.started) return;
    panel.dataset.started = '1';
    const cfg = await loadDiscoveredConfig();
    await showDiscovered(document.getElementById('discovered-table'), {
      S: window.APKSoftapp, T: window.APKTable,
      statusEl: document.getElementById('discovered-status'),
      kinds: Array.isArray(cfg.kinds) ? cfg.kinds : [],
      tableId: 'touchpanel-discovered',
      pickLabel: 'Bind',
      onPick: (thing) => { if (bindPanelDevice(this.panel, thing)) this.changed(); },
    });
  }

  /* THE DEVICE'S OWN TOUCH PANEL (ROAD-3503). ?model=&family=&resource=&serial=
     names a box. Its presented panel (Gui/Panels/<key>, the Instruments tab's
     frames) is the starting panel; a model that presents none starts from its
     api.json, the same surface its plain GUI page draws. Nothing found is said
     on screen; the sample layout stays. */
  async openFromLink(asked = null) {
    const want = asked || linkQuery(typeof location !== 'undefined' ? location.search : '');
    if (!want.model) return;
    this.opening = true;
    const tag = document.getElementById('block-tag');
    const say = (t) => { if (tag) tag.textContent = t; };
    say(`LOOKING FOR ${want.model} ON THE BUS…`);
    const cfg = await loadDiscoveredConfig();
    const waitMs = Number(cfg.panel_wait_ms) || 0;
    const doc = await this.presentedPanel(want, waitMs);
    let p = doc ? panelFromPresented(doc, { placement: want.placement, width: this.panel.width, height: this.panel.height }) : null;
    if (!p) {
      await this.libraryReady;
      const key = modelKey(want.family, want.model);
      try {
        const vars = await this.library.variables(key);
        p = panelFromVariables(vars, { model: want.model, family: want.family,
          device: this.deviceFor.get(key) || null, width: this.panel.width, height: this.panel.height });
      } catch (_) { p = null; }
    }
    this.opening = false;
    if (!p) { say(`${want.model}: NO PANEL PRESENTED AND NO API.JSON — SAMPLE LAYOUT`); return; }
    this.handleBlockLoaded({ id: `tp_${(p.deviceId || want.model).replace(/[^A-Za-z0-9]/g, '_')}`,
      name: p.name, pages: p.pages, widgets: p.widgets });
    this.panel.deviceId = p.deviceId;
    this.link = {
      model: p.device.model || want.model, family: p.device.type || want.family,
      serial: want.serial || p.device.serial || '', resource: want.resource || p.device.resource || '',
      protocol: want.protocol, placement: want.placement,
    };
    const pageAsked = want.page && this.panel.pages.find(pg => pg.name.toUpperCase() === want.page.toUpperCase());
    this.setPage(pageAsked ? pageAsked.id : this.panel.pages[0].id);
    this.changed();
    say(`${p.name} · FROM ${String(p.placement).toUpperCase()}`
      + (p.placements.length > 1 ? ` · ALSO ${p.placements.slice(1).join(', ').toUpperCase()}` : ''));
    await this.libraryReady;
    const key = modelKey(p.device.type || want.family, p.device.model || want.model);
    if (this.library.models.has(key)) this.selectModel(key);
  }

  /** The retained Gui/Panels/<key> document for the linked box, or null after waitMs.
      The OS API reads it off the bus for us (a page on the portal has no /mqtt of
      its own); inside the OS shell the bus answers directly. */
  async presentedPanel(want, waitMs) {
    const q = `model=${encodeURIComponent(want.model)}`;
    for (const url of [`/api/instrument/panel?${q}`, `/api/os/instrument/panel?${q}`]) {
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) continue;
        const doc = ((await r.json()).panels || []).find(d => isPanelFor(d, want));
        if (doc) return doc;
        break;   // the API answered: nothing presented for this box
      } catch (_) { /* this spelling is not served here */ }
    }
    const S = window.APKSoftapp;
    const C = window.APKContracts;
    const link = S && C && C.Topics && C.Topics.guiPanelsWildcard ? await S.bus() : null;
    if (!link) return null;
    return new Promise((resolve) => {
      let off = null;
      const done = (doc) => { clearTimeout(timer); try { off && off(); } catch (_) { /* gone */ } resolve(doc); };
      const timer = setTimeout(() => done(null), waitMs);
      off = link.subscribe(C.Topics.guiPanelsWildcard(), (_topic, text) => {
        if (!text) return;
        let doc = null;
        try { doc = JSON.parse(text); } catch (_) { return; }
        if (isPanelFor(doc, want)) done(doc);
      });
    });
  }

  loadSampleLayout() {
    this.panel.widgets = [
      { id: 'w1', type: 'fader', label: 'MASTER VOL', x: 40, y: 50, w: 70, h: 220, address: '/dsp/master/level', channel: 1, bindings: [] },
      { id: 'w2', type: 'meter', label: 'L / R PEAK', x: 120, y: 50, w: 45, h: 220, address: '/dsp/master/meter', channel: 1, bindings: [] },
      { id: 'w3', type: 'button', label: 'SYSTEM MUTE', x: 180, y: 50, w: 120, h: 60, address: '/dsp/master/mute', channel: 1, bindings: [] },
      { id: 'w4', type: 'knob', label: 'ROOM GAIN', x: 180, y: 130, w: 90, h: 100, address: '/dsp/gain/main', channel: 1, bindings: [] },
      { id: 'w5', type: 'button', label: 'PROJECTOR ON', x: 320, y: 50, w: 140, h: 60, address: '/display/power/on', channel: 1, bindings: [] },
      { id: 'w6', type: 'button', label: 'SCREEN DOWN', x: 320, y: 130, w: 140, h: 60, address: '/screen/motor/down', channel: 1, bindings: [] },
    ];
    // Drawn for a 720 × 450 sketch; put it on the real glass.
    const k = this.panel.width / 720;
    this.panel.widgets.forEach(w => ['x', 'y', 'w', 'h'].forEach(f => { w[f] = Math.round(w[f] * k); }));
    this.render();
  }

  addWidget(type) {
    const def = CONTROL_DEFINITIONS[type] || CONTROL_DEFINITIONS.button;
    const nextIdx = this.panel.widgets.length + 1;
    const widget = {
      id: `w_${Date.now()}`,
      type,
      label: `${def.name.toUpperCase()} ${nextIdx}`,
      ...this.freeSpot(def.w || 100, def.h || 60),
      w: def.w || 100,
      h: def.h || 60,
      address: `/control/param_${nextIdx}`,
      channel: 1,
      bindings: [],
    };
    this.panel.widgets.push(this.onPage(widget));
    this.selectedWidgetId = widget.id;
    this.render();
    this.changed();
  }

  selectWidget(id) {
    if (this.selectedWidgetId === id) return;
    this.selectedWidgetId = id;
    this.surfaceEl.querySelectorAll('.touch-widget').forEach(el => {
      const on = el.dataset.wid === id;
      el.classList.toggle('selected', on);
      el.style.outline = on ? '2px solid var(--osc-accent-primary)' : '';
    });
    this.tableBody?.querySelectorAll('tr[data-wid]').forEach(tr => {
      tr.style.background = tr.dataset.wid === id ? 'var(--osc-bg-surface-hover)' : '';
    });
    this.scheduleWires();
  }

  handleBlockLoaded(block, meta = {}) {
    if (!block) return;
    this.panel.id = block.id || this.panel.id;
    this.panel.name = block.name || this.panel.name;
    this.panel.room = block.room || this.panel.room;
    this.panel.width = block.width || this.panel.width;
    this.panel.height = block.height || this.panel.height;
    this.panel.screenPreset = block.screenPreset || this.panel.screenPreset;
    if (block.theme && typeof block.theme === 'object') {
      this.panel.theme = {
        id: block.theme.id, preset: block.theme.preset || 'Deep Horizon',
        base: block.theme.base ? { ...block.theme.base } : undefined, style: { ...(block.theme.style || {}) },
      };
      this.panel.savedLooks = Array.isArray(block.savedLooks) ? block.savedLooks : [];
      this.setupThemeDropdown();
    }
    if (Array.isArray(block.pages) && block.pages.length) {
      this.panel.pages = block.pages.filter(p => p && p.id).map(p => ({ id: String(p.id), name: String(p.name || p.id) }));
    } else {
      this.panel.pages = [{ id: 'p1', name: 'Main' }];
    }
    this.currentPage = this.panel.pages[0].id;
    if (Array.isArray(block.widgets)) {
      this.panel.widgets = block.widgets.map(w => ({ bindings: [], ...w }));
    }
    this.inputPanelName.value = this.panel.name;
    this.selectPreset.value = this.panel.screenPreset;
    this.render();
    if (this.library.totalModels) {
      this.renderDevices();
      this.renderVariables();
    }
  }

  saveBlock() {
    if (!this.host) return '';
    const how = this.host.save(panelBlock(this.panel), panelMeta(this.panel));
    const tag = document.getElementById('block-tag');
    if (tag && how) tag.textContent = how === 'host' ? 'SAVED TO THE CAD' : 'DOWNLOADED .JSON';
    return how;
  }

  // ------------------------------------------------------------------ pages

  pageOf(w) {
    const ids = this.panel.pages.map(p => p.id);
    return ids.includes(w.page) ? w.page : ids[0];
  }

  isOnPage(w) {
    return this.pageOf(w) === this.currentPage;
  }

  onPage(w) {
    if (!w.page) w.page = this.currentPage;
    return w;
  }

  setPage(id) {
    if (!this.panel.pages.some(p => p.id === id)) id = this.panel.pages[0].id;
    this.currentPage = id;
    if (this.selectedWidgetId && !this.isOnPage(this.widgetById(this.selectedWidgetId) || {})) this.selectedWidgetId = null;
    this.render();
    this.syncLink();
  }

  /* DEVICE TABS. Every box online on the bench gets a tab as it comes online
     (each 30 s bench read). The first one opens by itself when no device panel
     is open yet; the rest wait, pulsing, for a click — opening one never throws
     away the panel being edited: each tab keeps its own copy. A box that goes
     offline keeps its tab, greyed. */
  updateDeviceTabs() {
    this.deviceTabs = this.deviceTabs || new Map();
    const bench = this.library.bench || [];
    const fresh = arrivals(bench, this.deviceTabs);
    for (const d of fresh) this.deviceTabs.set(d.key, { d, want: wantFor(d), fresh: true, saved: null });
    const online = new Set(bench.filter(d => d.liveness === 'online').map(d => d.key));
    for (const [k, t] of this.deviceTabs) t.gone = !online.has(k);
    if (!this.link && !this.opening && fresh.length && !linkQuery(location.search).model) this.openDevice(fresh[0].key);
    // A link opened by URL is its box's tab.
    if (this.link && !this.activeTab) {
      const mine = [...this.deviceTabs].find(([, t]) => t.want.model === this.link.model
        && (!this.link.serial || !t.want.serial || t.want.serial === this.link.serial));
      if (mine) this.activeTab = mine[0];
    }
    this.renderDeviceTabs();
  }

  renderDeviceTabs() {
    const el = document.getElementById('device-tabs');
    if (!el || !this.deviceTabs) return;
    el.innerHTML = [...this.deviceTabs].map(([k, t]) => `
      <div class="device-tab ${k === this.activeTab ? 'on' : ''} ${t.gone ? 'gone' : ''} ${t.fresh && k !== this.activeTab ? 'fresh' : ''}"
           data-key="${esc(k)}" title="${esc(t.d.name || k)}${t.gone ? ' · offline' : ' · online'}">
        <span class="dt-dot"></span>${esc(t.d.model)}${t.want.serial ? ` <span class="pt-n">${esc(t.want.serial)}</span>` : ''}
      </div>`).join('');
    el.querySelectorAll('.device-tab').forEach(t => t.addEventListener('click', () => this.openDevice(t.dataset.key)));
  }

  async openDevice(key) {
    const tab = this.deviceTabs && this.deviceTabs.get(key);
    if (!tab || key === this.activeTab) return;
    const was = this.activeTab && this.deviceTabs.get(this.activeTab);
    if (was) was.saved = { panel: JSON.parse(JSON.stringify(this.panel)), page: this.currentPage, link: this.link };
    this.activeTab = key;
    tab.fresh = false;
    if (tab.saved) {
      this.handleBlockLoaded(tab.saved.panel);
      this.panel.deviceId = tab.saved.panel.deviceId;
      this.link = tab.saved.link;
      this.setPage(tab.saved.page);
    } else {
      await this.openFromLink({ ...tab.want });
    }
    this.renderDeviceTabs();
  }

  /* THE ADDRESS BAR IS THE PANEL'S LINK. Once a device's panel is open, the
     URL names the box (model, family, serial, resource, placement) and the
     page showing, so it can be bookmarked or sent and reopens the same panel
     on the same page. replaceState, not push: changing pages is not history. */
  syncLink() {
    if (!this.link || typeof history === 'undefined' || !history.replaceState) return;
    const page = (this.panel.pages.find(p => p.id === this.currentPage) || {}).name || '';
    const search = linkSearch({ ...this.link, page }, location.search);
    if (search !== location.search) history.replaceState(history.state, '', `${location.pathname}${search}${location.hash}`);
    // The name a bookmark or home-screen icon takes.
    document.title = [this.link.model, this.link.serial, page].filter(Boolean).join(' · ') || 'Touch Panel Designer';
  }

  async copyLink() {
    this.syncLink();
    const href = location.href;
    try { await navigator.clipboard.writeText(href); } catch (_) { window.prompt('This panel\'s link', href); return; }
    const tag = document.getElementById('block-tag');
    if (tag) { const was = tag.textContent; tag.textContent = 'LINK COPIED'; setTimeout(() => { tag.textContent = was; }, 1500); }
  }

  addPage() {
    let n = this.panel.pages.length + 1;
    while (this.panel.pages.some(p => p.id === `p${n}`)) n += 1;
    const page = { id: `p${n}`, name: `Page ${n}` };
    this.panel.pages.push(page);
    this.setPage(page.id);
    this.changed();
  }

  renamePage(id) {
    const page = this.panel.pages.find(p => p.id === id);
    const tab = this.pageTabsEl?.querySelector(`[data-page="${CSS.escape(id)}"] .pt-name`);
    if (!page || !tab) return;
    const input = document.createElement('input');
    input.className = 'pt-edit';
    input.value = page.name;
    tab.replaceWith(input);
    input.focus();
    input.select();
    const done = (keep) => {
      if (keep && input.value.trim()) page.name = input.value.trim();
      this.renderPageTabs();
      this.renderTable();
      this.changed();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') done(true);
      if (e.key === 'Escape') done(false);
      e.stopPropagation();
    });
    input.addEventListener('blur', () => done(true));
  }

  deletePage(id) {
    if (this.panel.pages.length < 2) return;
    const page = this.panel.pages.find(p => p.id === id);
    const on = this.panel.widgets.filter(w => this.pageOf(w) === id);
    if (on.length && !confirm(`Delete page “${page.name}” and its ${on.length} control${on.length === 1 ? '' : 's'}?`)) return;
    this.panel.widgets = this.panel.widgets.filter(w => this.pageOf(w) !== id);
    const i = this.panel.pages.findIndex(p => p.id === id);
    this.panel.pages.splice(i, 1);
    this.setPage(this.panel.pages[Math.max(0, i - 1)].id);
    this.changed();
  }

  renderPageTabs() {
    const el = this.pageTabsEl || (this.pageTabsEl = document.getElementById('page-tabs'));
    if (!el) return;
    const count = (id) => this.panel.widgets.filter(w => this.pageOf(w) === id).length;
    el.innerHTML = this.panel.pages.map(p => `
      <div class="page-tab ${p.id === this.currentPage ? 'on' : ''}" data-page="${esc(p.id)}" draggable="true"
           title="Click to open · double-click to rename · drag to reorder">
        <span class="pt-name">${esc(p.name)}</span><span class="pt-n">${count(p.id)}</span>
        ${this.panel.pages.length > 1 ? '<span class="pt-x" title="Delete page">✕</span>' : ''}
      </div>`).join('') + '<button class="page-add" title="Add a page">＋</button>';
    el.querySelectorAll('.page-tab').forEach(t => {
      const id = t.dataset.page;
      t.addEventListener('click', (e) => {
        if (e.target.closest('.pt-x')) { this.deletePage(id); return; }
        if (e.target.closest('.pt-edit')) return;
        if (id !== this.currentPage) this.setPage(id);
      });
      t.addEventListener('dblclick', () => this.renamePage(id));
      t.addEventListener('dragstart', (e) => { e.dataTransfer.setData('application/x-apk-page', id); });
      t.addEventListener('dragover', (e) => {
        if (e.dataTransfer.types.includes('application/x-apk-page')) e.preventDefault();
      });
      t.addEventListener('drop', (e) => {
        const from = e.dataTransfer.getData('application/x-apk-page');
        if (!from || from === id) return;
        e.preventDefault();
        const pages = this.panel.pages;
        const moved = pages.splice(pages.findIndex(p => p.id === from), 1)[0];
        pages.splice(pages.findIndex(p => p.id === id), 0, moved);
        this.renderPageTabs();
        this.changed();
      });
    });
    el.querySelector('.page-add').addEventListener('click', () => this.addPage());
  }

  render() {
    this.renderSurface();
    this.renderTable();
    this.renderThemeEditor();
    this.scheduleWires();
  }

  // ------------------------------------------------------------------ theme & glass

  themeStyle() {
    const base = this.panel.theme.base || STYLE_PRESETS[this.panel.theme.preset] || {};
    return { ...base, ...this.panel.theme.style };
  }

  effectiveStyle(w) {
    return { ...this.themeStyle(), ...(w.style || {}) };
  }

  // The glass is drawn at its true resolution and scaled to fit the stage, so
  // what is placed here lands on the same pixel of the real panel.
  fitGlass() {
    if (!this.bezelEl || !this.stageEl) return;
    const bezel = 12;
    const outerW = this.panel.width + bezel * 2;
    const outerH = this.panel.height + bezel * 2;
    const availW = Math.max(100, this.stageEl.clientWidth - 32);
    const tabsH = this.pageTabsEl ? this.pageTabsEl.offsetHeight + 8 : 0;
    const availH = Math.max(100, this.stageEl.clientHeight - 48 - tabsH);
    const s = Math.min(availW / outerW, availH / outerH, 1.5);
    this.glassScale = s;
    this.bezelEl.style.transform = `scale(${s})`;
    this.glassFitEl.style.width = `${Math.floor(outerW * s)}px`;
    this.glassFitEl.style.height = `${Math.floor(outerH * s)}px`;
    if (this.glassScaleEl) {
      this.glassScaleEl.textContent = `${this.panel.width} × ${this.panel.height} px · shown at ${Math.round(s * 100)}%`;
    }
    this.scheduleWires();
  }

  setPopped(on, themeFirst = false) {
    if (!this.gridPanel) return;
    this.gridPanel.classList.toggle('popped', on);
    const btn = document.getElementById('btn-popout');
    if (btn) btn.textContent = on ? '⤡ Dock' : '⤢ Pop Out';
    if (on && themeFirst) this.themeEditor?.scrollIntoView({ block: 'start' });
    this.fitGlass();
  }

  setupGridResize() {
    const handle = document.getElementById('grid-resize');
    const container = document.querySelector('.touchpanel-container');
    if (!handle || !container) return;
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const startY = e.clientY;
      const startH = this.gridPanel.getBoundingClientRect().height;
      const move = (m) => {
        const h = Math.min(window.innerHeight - 200, Math.max(120, startH - (m.clientY - startY)));
        container.style.gridTemplateRows = `auto 1fr ${Math.round(h)}px`;
        this.fitGlass();
      };
      const up = () => {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });
  }

  fieldInput(f, value, inherited, attrs) {
    const v = value ?? '';
    const ph = inherited === undefined || inherited === '' ? '' : String(inherited);
    if (f.kind === 'color') {
      const hex = /^#[0-9a-f]{6}$/i.test(v) ? v : /^#[0-9a-f]{6}$/i.test(ph) ? ph : '#000000';
      return `<span class="fld-color"><input type="color" ${attrs} data-swatch="1" value="${hex}">`
        + `<input type="text" class="cell-input" ${attrs} value="${esc(v)}" placeholder="${esc(ph || 'stock')}"></span>`;
    }
    if (f.kind === 'select') {
      return `<select class="cell-input" ${attrs}><option value="">${ph ? `inherit (${esc(ph)})` : '— stock —'}</option>`
        + f.options.map(o => `<option ${String(o) === String(v) ? 'selected' : ''}>${esc(o)}</option>`).join('') + '</select>';
    }
    if (f.kind === 'range') {
      return `<span class="fld-range"><input type="range" ${attrs} min="${f.min}" max="${f.max}" step="${f.step}" value="${v === '' ? (ph || f.max) : v}"><b>${v === '' ? (ph || f.max) : v}</b></span>`;
    }
    return `<input type="${f.kind === 'number' ? 'number' : 'text'}" class="cell-input" ${attrs} value="${esc(v)}"
      placeholder="${esc(ph || (f.unit || ''))}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''}>`;
  }

  fieldGrid(group, idx, fields, values, inherited = {}) {
    return fields.map(f => `<label class="fld"><span>${esc(f.label)}${f.unit ? ` (${f.unit})` : ''}</span>
      ${this.fieldInput(f, values?.[f.key], inherited[f.key], `data-group="${group}" data-idx="${idx}" data-key="${f.key}"`)}</label>`).join('');
  }

  fieldTarget(group, idx) {
    if (group === 'theme') return this.panel.theme.style;
    const w = this.panel.widgets[Number(idx)];
    if (!w) return null;
    if (group === 'style') return (w.style = w.style || {});
    if (group === 'behavior') return (w.behavior = w.behavior || {});
    return null;
  }

  onFieldInput(e) {
    const t = e.target;
    const group = t.dataset.group;
    if (!group) return;
    if (group === 'lookPreset') {
      const w = this.panel.widgets[Number(t.dataset.idx)];
      if (t.value === '__keep') return;
      if (t.value === '__browse') {
        this.selectedWidgetId = w?.id || null;
        this.renderTable();
        this.openLookLibrary('control');
        return;
      }
      if (w) delete w.lookId;
      if (w) w.style = t.value ? { ...(STYLE_PRESETS[t.value] || {}) } : {};
      this.renderSurface();
      this.renderTable();
      this.changed();
      return;
    }
    const target = this.fieldTarget(group, t.dataset.idx);
    if (!target) return;
    const key = t.dataset.key;
    const f = [...STYLE_FIELDS, ...BEHAVIOR_FIELDS, ...THEME_FIELDS].find(x => x.key === key);
    let val = t.value;
    if (val === '') {
      delete target[key];
    } else {
      if (f && (f.kind === 'number' || f.kind === 'range')) val = Number(val);
      target[key] = val;
    }
    // Keep a colour's swatch and text in step; show a range's number.
    const wrap = t.closest('.fld-color, .fld-range');
    if (wrap) {
      wrap.querySelectorAll('input').forEach(o => { if (o !== t && !(o.type === 'color' && !/^#[0-9a-f]{6}$/i.test(t.value))) o.value = t.value; });
      const b = wrap.querySelector('b');
      if (b) b.textContent = t.value;
    }
    this.renderSurface();
    if (group === 'theme') this.refreshInheritedPlaceholders();
    this.changed();
  }

  refreshInheritedPlaceholders() {
    const theme = this.themeStyle();
    this.tableBody?.querySelectorAll('[data-group="style"]').forEach(el => {
      if (el.tagName === 'INPUT' && el.type === 'text') el.placeholder = theme[el.dataset.key] ?? 'stock';
    });
  }

  renderThemeEditor() {
    if (!this.themeEditor) return;
    const presetVals = this.panel.theme.base || STYLE_PRESETS[this.panel.theme.preset] || {};
    this.themeEditor.innerHTML = `
      <div class="ed-head"><b>🎨 Device Theme</b>
        <span class="muted-cell">${esc(this.panel.name)} · preset “${esc(this.panel.theme.preset)}” — every control wears this unless its own style overrides it</span></div>
      <div class="style-grid">${this.fieldGrid('theme', '', [...THEME_FIELDS, ...STYLE_FIELDS], this.panel.theme.style, presetVals)}</div>`;
  }

  renderSurface() {
    if (!this.surfaceEl) return;
    this.surfaceEl.innerHTML = '';

    // True glass resolution; fitGlass() scales the whole bezel to the stage.
    this.surfaceEl.style.width = `${this.panel.width}px`;
    this.surfaceEl.style.height = `${this.panel.height}px`;
    const theme = this.themeStyle();
    this.surfaceEl.style.background = theme.glassBg || '';
    if (this.bezelEl) this.bezelEl.style.borderColor = theme.bezel || '';

    this.renderPageTabs();
    this.panel.widgets.filter(w => this.isOnPage(w)).forEach(w => {
      const def = CONTROL_DEFINITIONS[w.type] || CONTROL_DEFINITIONS.button;
      const el = document.createElement('div');
      const isSelected = w.id === this.selectedWidgetId;
      const nBound = (w.bindings || []).length;
      el.className = `touch-widget ${isSelected ? 'selected' : ''}`;
      el.dataset.wid = w.id;
      el.style.position = 'absolute';
      el.style.left = `${w.x}px`;
      el.style.top = `${w.y}px`;
      el.style.width = `${w.w}px`;
      el.style.height = `${w.h}px`;
      el.style.cursor = 'move';
      Object.entries(widgetStyleVars({ style: this.effectiveStyle(w) }))
        .forEach(([k, v]) => el.style.setProperty(k, v));
      if (isSelected) {
        el.style.outline = '2px solid var(--osc-accent-primary)';
      }

      el.innerHTML = def.render({ ...w, label: esc(w.label), subtitle: esc(w.subtitle), style: this.effectiveStyle(w) })
        + `<span class="w-port ${nBound ? 'bound' : ''}" title="Drag onto a variable to wire this control"></span>`
        + (nBound ? `<span class="w-badge" title="${nBound} variable(s) wired">${nBound}</span>` : '');

      el.querySelector('.w-port').addEventListener('mousedown', (e) => this.startPortDrag(e, w));

      // Make widget draggable on surface
      el.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        this.selectWidget(w.id);
        let startX = e.clientX;
        let startY = e.clientY;
        let lastX = startX;
        let lastY = startY;
        // The control being dragged: this one, or its copy after a push-and-hold.
        let dw = w;
        let del = el;
        let origX = w.x;
        let origY = w.y;
        let copied = false;
        const pressedAt = Date.now();

        // PUSH AND HOLD: still for HOLD_MS → a copy with every binding; keep
        // holding and drag to place it (copyControl.js).
        const holdTimer = setTimeout(() => {
          if (!isHold(Date.now() - pressedAt, lastX - startX, lastY - startY)) return;
          const copy = cloneControl(w, {
            id: `w_${Date.now()}_${this.panel.widgets.length + 1}`,
            bounds: { width: this.panel.width, height: this.panel.height },
          });
          this.panel.widgets.push(copy);
          copied = true;
          this.selectedWidgetId = copy.id;
          this.render();
          dw = copy;
          del = this.surfaceEl.querySelector(`[data-wid="${CSS.escape(copy.id)}"]`) || el;
          origX = copy.x;
          origY = copy.y;
          startX = lastX;
          startY = lastY;
          this.changed();
        }, HOLD_MS);

        const onMove = (me) => {
          lastX = me.clientX;
          lastY = me.clientY;
          dw.x = Math.max(0, Math.round(origX + (me.clientX - startX) / this.glassScale));
          dw.y = Math.max(0, Math.round(origY + (me.clientY - startY) / this.glassScale));
          del.style.left = `${dw.x}px`;
          del.style.top = `${dw.y}px`;
          this.renderTableFieldsOnly();
          this.scheduleWires();
        };

        const onUp = () => {
          clearTimeout(holdTimer);
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
          if (copied || dw.x !== origX || dw.y !== origY) this.changed();
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });

      this.surfaceEl.appendChild(el);
    });
    this.fitGlass();
  }

  renderTable() {
    if (!this.tableBody) return;
    this.tableBody.innerHTML = '';

    const typeOptions = (sel) => Object.values(CONTROL_DEFINITIONS)
      .map(d => `<option value="${d.type}" ${sel === d.type ? 'selected' : ''}>${esc(d.name)}</option>`).join('');

    this.panel.widgets.forEach((w, idx) => {
      if (!this.isOnPage(w)) return;
      const tr = document.createElement('tr');
      tr.dataset.wid = w.id;
      if (w.id === this.selectedWidgetId) {
        tr.style.background = 'var(--osc-bg-surface-hover)';
      }
      const chips = (w.bindings || []).map(b => `<span class="bind-chip" data-idx="${idx}" data-bid="${esc(b.id)}"
          title="${esc(b.scpi)}${b.device ? '\n' + esc(b.device) : ''}"><b>${esc(b.model)}</b> ${esc(b.command)}
          <span class="x" data-unbind="1" title="Disconnect">✕</span></span>`).join('')
        || '<span class="muted-cell">— drag a variable here or onto the control —</span>';

      tr.innerHTML = `
        <td class="col-idx text-center"><button class="caret" data-caret="${idx}" title="Style & behaviour">${this.expanded.has(w.id) ? '▾' : '▸'}</button>${idx + 1}</td>
        <td><input type="text" class="cell-input" data-idx="${idx}" data-field="label" value="${esc(w.label)}"></td>
        <td><select class="cell-input" data-idx="${idx}" data-field="type">${typeOptions(w.type)}</select></td>
        <td><input type="text" class="cell-input" data-idx="${idx}" data-field="address" value="${esc(w.address)}"></td>
        <td class="bind-cell" data-idx="${idx}">${chips}</td>
        <td><input type="number" class="cell-input text-center" data-idx="${idx}" data-field="channel" value="${w.channel || 1}"></td>
        <td><input type="number" class="cell-input text-center" data-idx="${idx}" data-field="x" value="${w.x}"></td>
        <td><input type="number" class="cell-input text-center" data-idx="${idx}" data-field="y" value="${w.y}"></td>
        <td><input type="number" class="cell-input text-center" data-idx="${idx}" data-field="w" value="${w.w}"></td>
        <td><input type="number" class="cell-input text-center" data-idx="${idx}" data-field="h" value="${w.h}"></td>
        <td class="col-actions">
          <button class="btn-icon btn-del-widget" data-idx="${idx}" title="Delete">🗑</button>
        </td>
      `;
      tr.addEventListener('mousedown', () => this.selectWidget(w.id));
      this.tableBody.appendChild(tr);

      if (this.expanded.has(w.id)) {
        const own = w.style || {};
        const preset = Object.keys(STYLE_PRESETS).find(n => JSON.stringify(STYLE_PRESETS[n]) === JSON.stringify(own) && n !== 'Deep Horizon') || '';
        const detail = document.createElement('tr');
        detail.className = 'detail-row';
        detail.innerHTML = `<td></td><td colspan="10"><div class="detail">
          <div class="ed-head"><b>Look</b>
            <select class="cell-input" data-group="lookPreset" data-idx="${idx}" style="width:auto;">
              <option value="">Device theme (${esc(this.panel.theme.preset)})</option>
              ${Object.keys(STYLE_PRESETS).map(n => `<option ${n === preset ? 'selected' : ''}>${esc(n)}</option>`).join('')}
              ${w.lookId && this.lookFor(w.lookId) ? `<option value="__keep" selected>${esc(this.lookFor(w.lookId).name)}</option>` : ''}
              <option value="__browse">📚 Look library…</option>
            </select><span class="muted-cell">blank fields inherit the device theme</span></div>
          <div class="style-grid">${this.fieldGrid('style', idx, STYLE_FIELDS, own, this.themeStyle())}</div>
          <div class="ed-head"><b>Behaviour</b>
            <label class="muted-cell">Page
              <select class="cell-input" data-move-page="${idx}" style="width:auto;">
                ${this.panel.pages.map(pg => `<option value="${esc(pg.id)}" ${pg.id === this.pageOf(w) ? 'selected' : ''}>${esc(pg.name)}</option>`).join('')}
              </select></label></div>
          <div class="style-grid">${this.fieldGrid('behavior', idx, BEHAVIOR_FIELDS, w.behavior || {})}</div>
        </div></td>`;
        this.tableBody.appendChild(detail);
      }
    });

    this.tableBody.querySelectorAll('[data-move-page]').forEach(sel => sel.addEventListener('change', (e) => {
      const w = this.panel.widgets[Number(sel.dataset.movePage)];
      if (!w) return;
      w.page = e.target.value;
      this.render();
      this.changed();
    }));

    this.tableBody.querySelectorAll('[data-caret]').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const w = this.panel.widgets[Number(btn.dataset.caret)];
      if (this.expanded.has(w.id)) this.expanded.delete(w.id); else this.expanded.add(w.id);
      this.renderTable();
    }));

    this.tableBody.querySelectorAll('.cell-input[data-field]').forEach(input => {
      const ev = input.tagName === 'SELECT' ? 'change' : 'input';
      input.addEventListener(ev, (e) => {
        const i = parseInt(e.target.dataset.idx, 10);
        const f = e.target.dataset.field;
        let val = e.target.value;
        if (['x', 'y', 'w', 'h', 'channel'].includes(f)) {
          val = parseInt(val, 10) || 0;
        }
        this.panel.widgets[i][f] = val;
        this.renderSurface();
        this.scheduleWires();
        this.changed();
      });
    });

    this.tableBody.querySelectorAll('.bind-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const w = this.panel.widgets[Number(chip.dataset.idx)];
        const b = w?.bindings?.find(x => x.id === chip.dataset.bid);
        if (!b) return;
        if (e.target.closest('[data-unbind]')) this.unbind(w, b.id);
        else this.revealBinding(b);
      });
    });

    // A table row takes a dropped variable too.
    this.tableBody.querySelectorAll('.bind-cell').forEach(cell => {
      cell.addEventListener('dragover', (e) => {
        if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'link';
      });
      cell.addEventListener('drop', (e) => {
        const v = this.varIndex.get(e.dataTransfer.getData(DRAG_MIME));
        if (!v) return;
        e.preventDefault();
        this.bindVariable(this.panel.widgets[Number(cell.dataset.idx)], v);
      });
    });

    this.tableBody.querySelectorAll('.btn-del-widget').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.dataset.idx, 10);
        this.panel.widgets.splice(i, 1);
        this.afterBindingChange();
      });
    });
  }

  renderTableFieldsOnly() {
    this.panel.widgets.forEach((w) => {
      const row = this.tableBody?.querySelector(`tr[data-wid="${CSS.escape(w.id)}"]`);
      if (row) {
        const xInput = row.querySelector('[data-field="x"]');
        const yInput = row.querySelector('[data-field="y"]');
        if (xInput) xInput.value = w.x;
        if (yInput) yInput.value = w.y;
      }
    });
  }

  promptOpen() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      const again = () => this.promptOpen();
      reader.onload = (re) => {
        try {
          const parsed = JSON.parse(re.target.result);
          this.handleBlockLoaded(parsed, { title: file.name });
        } catch (err) {
          const S = window.APKSoftapp;
          if (!S) { alert('Invalid JSON touch panel block'); return; }
          S.showProblem(err instanceof SyntaxError ? 'bad_json' : err, {
            subject: file.name, detail: err.message, onRetry: again,
            fix: ['Open a .json saved by this editor (Save & Return when standalone downloads one).'],
          });
        }
      };
      reader.onerror = () => window.APKSoftapp?.showProblem('file_unreadable', { subject: file.name, detail: reader.error && reader.error.message, onRetry: again });
      reader.readAsText(file);
    };
    input.click();
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    window.touchPanelApp = new TouchPanelApp();
  });
}
