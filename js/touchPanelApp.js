// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import { BlockBridge } from './blockBridge.js';
import { CONTROL_DEFINITIONS } from './controls.js';

export const SCREEN_PRESETS = [
  { id: '10in', name: '10.1″ Touch Panel (1280 × 800)', w: 1280, h: 800 },
  { id: '7in', name: '7.0″ Tabletop Panel (1024 × 600)', w: 1024, h: 600 },
  { id: '15in', name: '15.6″ Wall Mount (1920 × 1080)', w: 1920, h: 1080 },
  { id: '22in', name: '21.5″ Main Console (1920 × 1080)', w: 1920, h: 1080 },
];

export class TouchPanelApp {
  constructor() {
    this.panel = {
      id: 'tp_01',
      name: 'TP-STAGE-01',
      room: 'MAIN AUDITORIUM',
      screenPreset: '10in',
      width: 1280,
      height: 800,
      widgets: [],
    };

    this.selectedWidgetId = null;

    this.bridge = new BlockBridge({
      name: 'Touch Panel Builder',
      type: 'touch_panel',
      onBlockLoaded: (block, meta) => this.handleBlockLoaded(block, meta),
      onBlockChanged: () => {},
    });

    this.initElements();
    this.attachEvents();
    this.loadInitialData();
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

    this.setupPresetDropdown();
    this.setupPalette();
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

  attachEvents() {
    this.btnOpen?.addEventListener('click', () => this.promptOpen());
    this.btnSave?.addEventListener('click', () => this.saveBlock());
    this.btnClose?.addEventListener('click', () => this.bridge.close());
    this.btnSyncDiscovered?.addEventListener('click', () => this.loadFromDiscoveredProject());

    this.inputPanelName.addEventListener('input', (e) => {
      this.panel.name = e.target.value;
      this.bridge.notifyChanged();
    });

    this.selectPreset.addEventListener('change', (e) => {
      const p = SCREEN_PRESETS.find(pr => pr.id === e.target.value);
      if (p) {
        this.panel.screenPreset = p.id;
        this.panel.width = p.w;
        this.panel.height = p.h;
        this.renderSurface();
        this.bridge.notifyChanged();
      }
    });

    this.btnAddWidget?.addEventListener('click', () => {
      this.addWidget('button');
    });
  }

  loadInitialData() {
    this.loadFromDiscoveredProject().catch(() => {
      this.loadSampleLayout();
    });
  }

  async loadFromDiscoveredProject() {
    try {
      const data = await this.bridge.fetchDiscoveredProject();
      if (data && (data.touchPanels || data.surfaces || data.controlPanels)) {
        const raw = data.touchPanels || data.surfaces || data.controlPanels;
        if (Array.isArray(raw) && raw.length > 0) {
          this.handleBlockLoaded(raw[0], { title: raw[0].name });
          return;
        }
      }
    } catch (_) {}
    this.loadSampleLayout();
  }

  loadSampleLayout() {
    this.panel.widgets = [
      { id: 'w1', type: 'fader', label: 'MASTER VOL', x: 40, y: 50, w: 70, h: 220, address: '/dsp/master/level', channel: 1 },
      { id: 'w2', type: 'meter', label: 'L / R PEAK', x: 120, y: 50, w: 45, h: 220, address: '/dsp/master/meter', channel: 1 },
      { id: 'w3', type: 'button', label: 'SYSTEM MUTE', x: 180, y: 50, w: 120, h: 60, address: '/dsp/master/mute', channel: 1 },
      { id: 'w4', type: 'knob', label: 'ROOM GAIN', x: 180, y: 130, w: 90, h: 100, address: '/dsp/gain/main', channel: 1 },
      { id: 'w5', type: 'button', label: 'PROJECTOR ON', x: 320, y: 50, w: 140, h: 60, address: '/display/power/on', channel: 1 },
      { id: 'w6', type: 'button', label: 'SCREEN DOWN', x: 320, y: 130, w: 140, h: 60, address: '/screen/motor/down', channel: 1 },
    ];
    this.render();
  }

  addWidget(type) {
    const def = CONTROL_DEFINITIONS[type] || CONTROL_DEFINITIONS.button;
    const nextIdx = this.panel.widgets.length + 1;
    const widget = {
      id: `w_${Date.now()}`,
      type,
      label: `${def.name.toUpperCase()} ${nextIdx}`,
      x: 30 + (nextIdx * 30) % 400,
      y: 40 + (nextIdx * 20) % 200,
      w: def.w || 100,
      h: def.h || 60,
      address: `/control/param_${nextIdx}`,
      channel: 1,
    };
    this.panel.widgets.push(widget);
    this.selectedWidgetId = widget.id;
    this.render();
    this.bridge.notifyChanged();
  }

  handleBlockLoaded(block, meta = {}) {
    if (!block) return;
    this.panel.id = block.id || this.panel.id;
    this.panel.name = block.name || this.panel.name;
    this.panel.room = block.room || this.panel.room;
    this.panel.width = block.width || this.panel.width;
    this.panel.height = block.height || this.panel.height;
    this.panel.screenPreset = block.screenPreset || this.panel.screenPreset;
    if (Array.isArray(block.widgets)) {
      this.panel.widgets = block.widgets;
    }
    this.inputPanelName.value = this.panel.name;
    this.selectPreset.value = this.panel.screenPreset;
    this.render();
  }

  saveBlock() {
    const block = {
      type: 'touch_panel',
      id: this.panel.id,
      name: this.panel.name,
      room: this.panel.room,
      screenPreset: this.panel.screenPreset,
      width: this.panel.width,
      height: this.panel.height,
      widgets: this.panel.widgets,
      timestamp: new Date().toISOString(),
    };
    this.bridge.saveBlock(block, {
      title: `${this.panel.name} (${this.panel.widgets.length} Widgets)`,
      filename: `touchpanel_${this.panel.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    });
  }

  render() {
    this.renderSurface();
    this.renderTable();
  }

  renderSurface() {
    if (!this.surfaceEl) return;
    this.surfaceEl.innerHTML = '';

    // Aspect ratio styling
    const aspect = this.panel.width / this.panel.height;
    this.surfaceEl.style.aspectRatio = `${aspect}`;

    this.panel.widgets.forEach(w => {
      const def = CONTROL_DEFINITIONS[w.type] || CONTROL_DEFINITIONS.button;
      const el = document.createElement('div');
      const isSelected = w.id === this.selectedWidgetId;
      el.className = `touch-widget ${isSelected ? 'selected' : ''}`;
      el.style.position = 'absolute';
      el.style.left = `${w.x}px`;
      el.style.top = `${w.y}px`;
      el.style.width = `${w.w}px`;
      el.style.height = `${w.h}px`;
      el.style.cursor = 'move';
      if (isSelected) {
        el.style.outline = '2px solid var(--osc-accent-primary)';
      }

      el.innerHTML = def.render(w);

      // Make widget draggable on surface
      let startX, startY, origX, origY;
      el.addEventListener('mousedown', (e) => {
        this.selectedWidgetId = w.id;
        this.render();
        startX = e.clientX;
        startY = e.clientY;
        origX = w.x;
        origY = w.y;

        const onMove = (me) => {
          w.x = Math.max(0, origX + (me.clientX - startX));
          w.y = Math.max(0, origY + (me.clientY - startY));
          el.style.left = `${w.x}px`;
          el.style.top = `${w.y}px`;
          this.renderTableFieldsOnly();
        };

        const onUp = () => {
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
          this.bridge.notifyChanged();
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });

      this.surfaceEl.appendChild(el);
    });
  }

  renderTable() {
    if (!this.tableBody) return;
    this.tableBody.innerHTML = '';

    this.panel.widgets.forEach((w, idx) => {
      const tr = document.createElement('tr');
      if (w.id === this.selectedWidgetId) {
        tr.style.background = 'var(--osc-bg-surface-hover)';
      }

      tr.innerHTML = `
        <td class="col-idx text-center">${idx + 1}</td>
        <td><input type="text" class="cell-input" data-idx="${idx}" data-field="label" value="${w.label}"></td>
        <td>
          <select class="cell-input" data-idx="${idx}" data-field="type">
            <option value="fader" ${w.type === 'fader' ? 'selected' : ''}>Fader</option>
            <option value="knob" ${w.type === 'knob' ? 'selected' : ''}>Rotary Knob</option>
            <option value="button" ${w.type === 'button' ? 'selected' : ''}>Push Button</option>
            <option value="meter" ${w.type === 'meter' ? 'selected' : ''}>Peak Meter</option>
          </select>
        </td>
        <td><input type="text" class="cell-input" data-idx="${idx}" data-field="address" value="${w.address}"></td>
        <td><input type="number" class="cell-input text-center" data-idx="${idx}" data-field="channel" value="${w.channel || 1}"></td>
        <td><input type="number" class="cell-input text-center" data-idx="${idx}" data-field="x" value="${w.x}"></td>
        <td><input type="number" class="cell-input text-center" data-idx="${idx}" data-field="y" value="${w.y}"></td>
        <td><input type="number" class="cell-input text-center" data-idx="${idx}" data-field="w" value="${w.w}"></td>
        <td><input type="number" class="cell-input text-center" data-idx="${idx}" data-field="h" value="${w.h}"></td>
        <td class="col-actions">
          <button class="btn-icon btn-del-widget" data-idx="${idx}" title="Delete">🗑</button>
        </td>
      `;
      this.tableBody.appendChild(tr);
    });

    this.tableBody.querySelectorAll('.cell-input').forEach(input => {
      input.addEventListener('input', (e) => {
        const i = parseInt(e.target.dataset.idx, 10);
        const f = e.target.dataset.field;
        let val = e.target.value;
        if (['x', 'y', 'w', 'h', 'channel'].includes(f)) {
          val = parseInt(val, 10) || 0;
        }
        this.panel.widgets[i][f] = val;
        this.renderSurface();
        this.bridge.notifyChanged();
      });
    });

    this.tableBody.querySelectorAll('.btn-del-widget').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const i = parseInt(e.target.dataset.idx, 10);
        this.panel.widgets.splice(i, 1);
        this.render();
        this.bridge.notifyChanged();
      });
    });
  }

  renderTableFieldsOnly() {
    this.panel.widgets.forEach((w, idx) => {
      const row = this.tableBody?.children[idx];
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
      reader.onload = (re) => {
        try {
          const parsed = JSON.parse(re.target.result);
          this.handleBlockLoaded(parsed, { title: file.name });
        } catch (err) {
          alert('Invalid JSON touch panel block');
        }
      };
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
