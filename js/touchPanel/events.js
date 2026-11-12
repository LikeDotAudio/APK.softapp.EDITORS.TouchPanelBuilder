// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/* TouchPanelApp, part: The palette, the verb filters and every event the editor listens to (attachEvents).
   Mixed into TouchPanelApp.prototype by js/touchPanelApp.js (ROAD-3766). */

import { CONTROL_DEFINITIONS } from '../controls.js';
import { VERBS, VERB_LABEL } from '../library.js';
import { libraryButton } from '../bimLibrary.js';
import { SCREEN_PRESETS } from './screens.js';
import { VAR_PAGE, DRAG_MIME, GRAB_MIME } from './common.js';

export class TouchPanelEvents {
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
    document.getElementById('btn-export-frame')?.addEventListener('click', () => this.exportFrame());
    document.getElementById('btn-engine-preview')?.addEventListener('click', () => this.openEnginePreview());
    document.getElementById('btn-engine-glass')?.addEventListener('click', () => this.setEngineGlass(!this.engineGlass));
    document.getElementById('engine-close')?.addEventListener('click', () => { document.getElementById('engine-preview').hidden = true; });
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
      if (p && p.fit) {
        // Every control keeps its pixels; the page takes the window.
        this.panel.screenPreset = p.id;
        this.render();
        this.changed();
      } else if (p) {
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
    // The stage also changes size without the window (the schedule's resize
    // bar, a column): the glass follows it.
    if (typeof ResizeObserver === 'function' && this.stageEl) {
      let frame = 0;
      new ResizeObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => this.fitGlass()); }).observe(this.stageEl);
    }

    this.btnAddWidget?.addEventListener('click', () => {
      this.addWidget('button');
    });

    // 📚 Library (ROAD-3572): pick the device as a BIM part; its command surface lists its variables
    this.devSearch.before(libraryButton((items) => this.pickFromLibrary(items[0]), {
      className: 'btn btn-secondary btn-sm', title: 'Choose a device from the BIM library' }));

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
      if (e.dataTransfer.types.includes(GRAB_MIME)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        this.markDropTarget(this.surfaceEl);
        return;
      }
      if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'link';
      this.markDropTarget(e.target.closest('.touch-widget') || this.surfaceEl);
    });
    this.surfaceEl.addEventListener('dragleave', (e) => {
      if (!this.surfaceEl.contains(e.relatedTarget)) this.markDropTarget(null);
    });
    this.surfaceEl.addEventListener('drop', (e) => {
      const grab = e.dataTransfer.getData(GRAB_MIME);
      if (grab) {
        e.preventDefault();
        this.markDropTarget(null);
        try { this.dropGrabBag(JSON.parse(grab)); } catch (_) {}
        return;
      }
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
}
