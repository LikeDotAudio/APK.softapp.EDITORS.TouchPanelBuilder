// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/* TouchPanelApp, part: Opening and saving: the Discovered panel, a device link, placements, presented panels, the sample layout, adding/selecting a control, the CAD block load and Save.
   Mixed into TouchPanelApp.prototype by js/touchPanelApp.js (ROAD-3766). */

import { panelBlock, panelMeta, bindPanelDevice } from '../touchPanelHost.js';
import { deckOrder, linkQuery, linkSearch, isPanelFor, panelFromPresented, panelFromVariables, presentedFromPart, partUrl } from '../devicePanel.js';
import { savedIdentity, savedTopic, readSaved, writeSaved, savedDoc, benchBus } from '../savedPanel.js';
import { CONTROL_DEFINITIONS } from '../controls.js';
import { modelKey } from '../library.js';
import { touchPanelToIfc } from '../touchPanelIfc.js';
import { SCREEN_PRESETS } from './screens.js';
import { DISCOVERED_CONFIG, loadDiscoveredConfig, guiPrefixOf, esc } from './common.js';

export class TouchPanelOpenSave {
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
    if (!window.APKSoftapp?.discoveredPanel) return;
    await window.APKSoftapp.discoveredPanel(document.getElementById('discovered-table'), {
      id: 'touchpanel-discovered',
      status: document.getElementById('discovered-status'),
      configUrl: DISCOVERED_CONFIG,
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
    let want = asked || linkQuery(typeof location !== 'undefined' ? location.search : '');
    // ?bim=<part>: the part's own panel template, no unit (ROAD-3687, the library's
    // EDIT TOUCH PANEL) — the starting panel is the part's frames, never a box's.
    const part = want.bim ? await this.partFor(want.bim) : null;
    if (part) want = { ...want, model: want.model || String(part.model || ''), family: want.family || String((part.panel && part.panel.template) || '') };
    if (!want.model) return;
    this.opening = true;
    const tag = document.getElementById('block-tag');
    const say = (t) => { if (tag) tag.textContent = t; };
    say(part ? `${want.model} · THE PART'S PANEL TEMPLATE…` : `LOOKING FOR ${want.model} ON THE BUS…`);
    const cfg = await loadDiscoveredConfig();
    const waitMs = Number(cfg.panel_wait_ms) || 0;
    const doc = part ? presentedFromPart(part) : await this.presentedPanel(want, waitMs);
    let p = doc ? panelFromPresented(doc, { placement: want.placement, ...this.layoutSize() }) : null;
    if (!p) {
      await this.libraryReady;
      const key = modelKey(want.family, want.model);
      try {
        const vars = await this.library.variables(key);
        p = panelFromVariables(vars, { model: want.model, family: want.family,
          device: this.deviceFor.get(key) || null, ...this.layoutSize() });
      } catch (_) { p = null; }
    }
    // THE SAVED PANEL FIRST (ROAD-3503): what somebody edited and saved for
    // this box opens before anything generated, unless a placement was picked.
    this.bus = this.bus || await benchBus(window.APKSoftapp, cfg);
    const identity = savedIdentity(p, want);
    const topic = this.bus && window.APKContracts ? savedTopic(window.APKContracts.Topics.gui.topic, identity) : '';
    const saved = topic ? await readSaved(this.bus, topic, Number(cfg.saved_wait_ms) || 1500) : null;
    this.opening = false;
    if (!p && !saved) { say(`${want.model}: NO PANEL PRESENTED AND NO API.JSON — SAMPLE LAYOUT`); return; }
    const useSaved = !!saved && !want.placement;
    if (useSaved) {
      this.handleBlockLoaded(saved);
    } else {
      this.handleBlockLoaded({ id: `tp_${(p.deviceId || want.model).replace(/[^A-Za-z0-9]/g, '_')}`,
        name: p.name, pages: p.pages, widgets: p.widgets });
    }
    p = p || { name: saved.name, device: { model: want.model, type: want.family }, deviceId: identity, placement: 'saved', placements: [] };
    this.panel.deviceId = (useSaved && saved.deviceId) || p.deviceId;
    this.panel.sourcePlacement = (useSaved && saved.sourcePlacement) || p.placement || '';
    // The device's folder in its window's tree (bus-panels devicePanelTree):
    // with the placement and a page's frame path, where the window draws it —
    // the glass mirrors that address and Save writes to it (ROAD-3697).
    this.panel.sourceFolder = (useSaved && saved.sourceFolder) || (doc && (doc.folder || doc.key)) || '';
    this.savedTopicName = topic;
    this.fillPlacementPicker(p.placements, !!saved, useSaved ? '' : (want.placement || p.placement));
    this.link = {
      model: p.device.model || want.model, family: p.device.type || want.family,
      serial: want.serial || p.device.serial || '', resource: want.resource || p.device.resource || '',
      protocol: want.protocol, placement: want.placement, ...(part ? { bim: want.bim } : {}),
    };
    const pageAsked = want.page && this.panel.pages.find(pg => pg.name.toUpperCase() === want.page.toUpperCase());
    this.setPage(pageAsked ? pageAsked.id : this.panel.pages[0].id);
    // WHAT YOU SEE IS WHAT YOU EDIT: the glass draws every control as the running
    // panel does (run.html — the one renderer of a device panel everywhere, the OS
    // device windows included, owner 2026-11-12 "homogenize this"). ⚙ Engine glass
    // stays a toggle for checking how the frame engine would draw the export.
    this.changed();
    say(useSaved
      ? `${this.panel.name} · SAVED ${String(saved.saved_at || '').slice(0, 16).replace('T', ' ')}`
      : `${p.name} · FROM ${String(p.placement).toUpperCase()}`);
    await this.libraryReady;
    const key = modelKey(p.device.type || want.family, p.device.model || want.model);
    if (this.library.models.has(key)) this.selectModel(key);
  }

  /** A BIM part's whole record (its panel template with it), or null. */
  async partFor(id) {
    try {
      const r = await fetch(partUrl(id), { cache: 'no-store' });
      return r.ok ? await r.json() : null;
    } catch (_) { return null; }
  }

  /** The box's panels to pick from: its saved one (if any) and every placement it presents. */
  fillPlacementPicker(placements = [], hasSaved = false, current = '') {
    const sel = document.getElementById('placement-picker');
    if (!sel) return;
    const opts = [];
    if (hasSaved) opts.push(['', '💾 Saved panel']);
    for (const at of placements || []) opts.push([at, `⚙ ${at}`]);
    sel.innerHTML = opts.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('');
    sel.value = current && opts.some(([v]) => v === current) ? current : (opts[0] ? opts[0][0] : '');
    sel.hidden = opts.length < 2;
    if (!sel.dataset.wired) {
      sel.dataset.wired = '1';
      sel.addEventListener('change', () => {
        const want = { ...(this.link || linkQuery(location.search)), placement: sel.value };
        history.replaceState(null, '', linkSearch(want, location.search) || location.pathname);
        this.openFromLink(want);
      });
    }
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
      // A page keeps where it came from (the device frame it is saved back to).
      this.panel.pages = block.pages.filter(p => p && p.id).map(p => ({ id: String(p.id), name: String(p.name || p.id),
        ...(p.source && typeof p.source === 'object' ? { source: p.source } : {}) }));
    } else {
      this.panel.pages = [{ id: 'p1', name: 'Main' }];
    }
    // The deck: the GUI file's pages first, the added ones after (devicePanel deckOrder).
    this.panel.pages = deckOrder(this.panel).pages;
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

  async saveBlock() {
    // A panel opened for a box is also kept for that box, retained on the bus,
    // so its link and its touch pad open it next time (ROAD-3503).
    if (this.link && this.savedTopicName && writeSaved(this.bus, this.savedTopicName, savedDoc(this.panel, this.link, new Date(), { prefixOf: guiPrefixOf }))) {
      const tag = document.getElementById('block-tag');
      if (tag) tag.textContent = `SAVED FOR ${savedIdentity(this.panel, this.link)}`;
      this.fillPlacementPicker([...(document.getElementById('placement-picker')?.options || [])]
        .map(o => o.value).filter(Boolean), true, '');
      // Kept on the bus; outside the CAD there is no need to download a copy as well.
      if (!(this.host && this.host.embedded)) return 'bus';
    }
    if (!this.host) return '';
    // In the CAD: the block back to the drawing. Standalone: Save Model, the .json AND its .ifc twin, both or neither.
    const S = window.APKSoftapp;
    const block = panelBlock(this.panel);
    const meta = panelMeta(this.panel);
    const tag = document.getElementById('block-tag');
    if (this.host.embedded || !S || typeof S.saveModel !== 'function') {
      const how = this.host.save(block, meta);
      if (tag && how) tag.textContent = how === 'host' ? 'SAVED TO THE CAD' : 'DOWNLOADED .JSON';
      return how;
    }
    const r = await S.saveModel(block, {
      name: meta.filename,
      toIfc: (b) => touchPanelToIfc(b, { name: meta.filename, presets: SCREEN_PRESETS }),
    });
    if (r.ok && tag) tag.textContent = 'SAVED .JSON + .IFC';
    if (!r.ok && !r.cancelled) S.showProblem(r.problem || 'save_failed', { onRetry: () => this.saveBlock() });
    return r.ok ? 'model' : '';
  }
}
