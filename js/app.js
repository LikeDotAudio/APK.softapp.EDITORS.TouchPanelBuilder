// Part of APK.audio - Touch Panel Builder Application
import { CONTROL_DEFINITIONS } from './controls.js';

export class TouchPanelApp {
  constructor() {
    this.controls = [];
    this.selectedId = null;
    this.nextId = 1;
    this.initElements();
    this.populatePalette();
    this.bindEvents();
    this.render();
  }

  initElements() {
    this.paletteEl = document.getElementById('palette-items');
    this.surfaceEl = document.getElementById('touchpanel-surface');
    this.inspectorEl = document.getElementById('inspector-content');
    this.btnExport = document.getElementById('btn-export');
    this.btnClear = document.getElementById('btn-clear');
  }

  populatePalette() {
    this.paletteEl.innerHTML = '';
    for (const [key, def] of Object.entries(CONTROL_DEFINITIONS)) {
      const item = document.createElement('div');
      item.className = 'control-item';
      item.draggable = true;
      item.innerHTML = `<span>${def.icon}</span> <span>${def.name}</span>`;
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', key);
      });
      this.paletteEl.appendChild(item);
    }
  }

  bindEvents() {
    this.surfaceEl.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    this.surfaceEl.addEventListener('drop', (e) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('text/plain');
      if (!type || !CONTROL_DEFINITIONS[type]) return;

      const rect = this.surfaceEl.getBoundingClientRect();
      const x = Math.max(0, Math.min(rect.width - 60, e.clientX - rect.left - 30));
      const y = Math.max(0, Math.min(rect.height - 60, e.clientY - rect.top - 30));

      this.addControl(type, x, y);
    });

    this.btnExport?.addEventListener('click', () => {
      const json = JSON.stringify({ panel: 'TouchPanel-1', controls: this.controls }, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'touchpanel-layout.json';
      a.click();
      URL.revokeObjectURL(url);
    });

    this.btnClear?.addEventListener('click', () => {
      if (confirm('Clear touch panel surface?')) {
        this.controls = [];
        this.selectedId = null;
        this.render();
      }
    });
  }

  addControl(type, x, y) {
    const def = CONTROL_DEFINITIONS[type];
    const control = {
      id: this.nextId++,
      type,
      x: Math.round(x),
      y: Math.round(y),
      w: def.w,
      h: def.h,
      label: def.name,
      value: type === 'fader' ? '-6 dB' : type === 'readout' ? '1000 Hz' : undefined
    };
    this.controls.push(control);
    this.selectedId = control.id;
    this.render();
  }

  selectControl(id) {
    this.selectedId = id;
    this.render();
  }

  deleteSelected() {
    if (!this.selectedId) return;
    this.controls = this.controls.filter(c => c.id !== this.selectedId);
    this.selectedId = null;
    this.render();
  }

  render() {
    this.renderSurface();
    this.renderInspector();
  }

  renderSurface() {
    this.surfaceEl.innerHTML = '';
    for (const c of this.controls) {
      const def = CONTROL_DEFINITIONS[c.type];
      const el = document.createElement('div');
      el.className = `placed-control ${c.id === this.selectedId ? 'selected' : ''}`;
      el.style.left = `${c.x}px`;
      el.style.top = `${c.y}px`;
      el.style.width = `${c.w}px`;
      el.style.height = `${c.h}px`;
      el.innerHTML = def.render(c);

      el.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        this.selectControl(c.id);

        let startX = e.clientX;
        let startY = e.clientY;
        const initialX = c.x;
        const initialY = c.y;

        const onMouseMove = (moveEvent) => {
          c.x = Math.max(0, initialX + (moveEvent.clientX - startX));
          c.y = Math.max(0, initialY + (moveEvent.clientY - startY));
          el.style.left = `${c.x}px`;
          el.style.top = `${c.y}px`;
          this.renderInspector();
        };

        const onMouseUp = () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', onMouseUp);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
      });

      this.surfaceEl.appendChild(el);
    }
  }

  renderInspector() {
    const selected = this.controls.find(c => c.id === this.selectedId);
    if (!selected) {
      this.inspectorEl.innerHTML = `<div style="font-size:0.85rem; color:#64748b; padding:20px 0; text-align:center;">Select a control to edit properties</div>`;
      return;
    }

    this.inspectorEl.innerHTML = `
      <div class="prop-group">
        <label>Type</label>
        <input type="text" value="${selected.type}" disabled />
      </div>
      <div class="prop-group">
        <label>Label</label>
        <input type="text" id="prop-label" value="${selected.label || ''}" />
      </div>
      <div class="prop-group" style="display:flex; gap:10px;">
        <div style="flex:1;">
          <label>X (px)</label>
          <input type="number" id="prop-x" value="${selected.x}" />
        </div>
        <div style="flex:1;">
          <label>Y (px)</label>
          <input type="number" id="prop-y" value="${selected.y}" />
        </div>
      </div>
      <div class="prop-group" style="display:flex; gap:10px;">
        <div style="flex:1;">
          <label>Width</label>
          <input type="number" id="prop-w" value="${selected.w}" />
        </div>
        <div style="flex:1;">
          <label>Height</label>
          <input type="number" id="prop-h" value="${selected.h}" />
        </div>
      </div>
      <button id="btn-delete-prop" style="width:100%; margin-top:20px; border-color:#ef4444; color:#ef4444;">Delete Control</button>
    `;

    document.getElementById('prop-label')?.addEventListener('input', (e) => {
      selected.label = e.target.value;
      this.renderSurface();
    });
    document.getElementById('prop-x')?.addEventListener('change', (e) => {
      selected.x = parseInt(e.target.value, 10) || 0;
      this.renderSurface();
    });
    document.getElementById('prop-y')?.addEventListener('change', (e) => {
      selected.y = parseInt(e.target.value, 10) || 0;
      this.renderSurface();
    });
    document.getElementById('prop-w')?.addEventListener('change', (e) => {
      selected.w = parseInt(e.target.value, 10) || 10;
      this.renderSurface();
    });
    document.getElementById('prop-h')?.addEventListener('change', (e) => {
      selected.h = parseInt(e.target.value, 10) || 10;
      this.renderSurface();
    });
    document.getElementById('btn-delete-prop')?.addEventListener('click', () => {
      this.deleteSelected();
    });
  }
}
