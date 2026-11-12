// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/* TouchPanelApp, part: The control schedule table, the frame export, the engine preview and Open.
   Mixed into TouchPanelApp.prototype by js/touchPanelApp.js (ROAD-3766). */

import { CONTROL_DEFINITIONS, STYLE_FIELDS, BEHAVIOR_FIELDS, STYLE_PRESETS } from '../controls.js';
import { panelToFrame, frameToPanel } from '../frameExport.js';
import { touchPanelFromIfc } from '../touchPanelIfc.js';
import { isFrame, DRAG_MIME, esc } from './common.js';

export class TouchPanelTableFrame {
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
          title="${esc(b.scpi)}${b.device ? '\n' + esc(b.device) : ''}${Array.isArray(b.elements) && b.elements.length ? '\n' + b.elements.map(e => `${esc(e.label)} = ${esc(e.value)}`).join('\n') : ''}"><b>${esc(b.model)}</b> ${esc(b.command)}${Array.isArray(b.elements) && b.elements.length ? ` <span class="el-count">×${b.elements.length}</span>` : ''}
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
        const wInput = row.querySelector('[data-field="w"]');
        const hInput = row.querySelector('[data-field="h"]');
        if (wInput) wInput.value = w.w;
        if (hInput) hInput.value = w.h;
      }
    });
  }

  // THE PANEL AS A FRAME the OS runs (frameExport.js): one OcaBlock per page,
  // one field per control, drawn by the real widget engine.
  currentFrame() {
    return panelToFrame(this.panel, (w) => this.effectiveStyle(w));
  }

  exportFrame() {
    const frame = this.currentFrame();
    const name = String(this.panel.name || 'touch_panel').replace(/[^A-Za-z0-9._-]+/g, '_');
    const url = URL.createObjectURL(new Blob([JSON.stringify(frame, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.frame.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // The whole panel drawn by the real widget engine (FrontEnd/apkos-frame-host.html).
  // Like a real touch panel: Home (every device on the bench) is the top; each device's panel is a branch.
  // The Home bar stays pinned at the top of the preview, on Home and inside every branch.
  openEnginePreview(view = 'home') {
    const box = document.getElementById('engine-preview');
    const host = document.getElementById('engine-host');
    if (!box || !host) return;
    box.hidden = false;
    this.engineView = view;
    this.renderEngineNav();
    if (view === 'home') return;
    const post = () => frame.contentWindow?.postMessage({
      type: 'apkos:render-frame', layoutJson: this.currentFrame(), filePath: `TouchPanels/${this.panel.name || 'panel'}.json`,
    }, '*');
    let frame = host.querySelector('iframe');
    if (!frame) {
      host.innerHTML = '<iframe title="Engine preview" src="/FrontEnd/apkos-frame-host.html"></iframe>';
      frame = host.querySelector('iframe');
      window.addEventListener('message', (e) => {
        if (e.data?.type === 'apkos:frame-host-ready' && e.source === frame.contentWindow) post();
      });
    } else {
      post();
    }
  }

  renderEngineNav() {
    const nav = document.getElementById('engine-nav');
    const home = document.getElementById('engine-home');
    const host = document.getElementById('engine-host');
    if (!nav || !home || !host) return;
    const tabs = [...(this.deviceTabs || new Map())];
    const atHome = this.engineView === 'home';
    const active = this.activeTab && this.deviceTabs?.get(this.activeTab);
    const here = active ? active.d.model : (this.panel.name || 'This panel');
    nav.innerHTML = `<button class="btn btn-secondary btn-sm home-btn ${atHome ? 'on' : ''}" data-home>⌂ Home</button>`
      + (atHome ? '' : `<span class="crumb">› ${esc(here)}</span>`);
    nav.querySelector('[data-home]').addEventListener('click', () => this.openEnginePreview('home'));
    home.hidden = !atHome;
    host.hidden = atHome;
    if (!atHome) return;
    const tiles = tabs.length ? tabs.map(([k, t]) => `
      <div class="home-tile ${k === this.activeTab ? 'on' : ''} ${t.gone ? 'gone' : ''}" data-key="${esc(k)}">
        <b>${esc(t.d.model)}</b><span>${esc(t.d.name || '')}${t.want.serial ? ` · ${esc(t.want.serial)}` : ''}${t.gone ? ' · offline' : ''}</span>
      </div>`)
      : [`<div class="home-tile on" data-key=""><b>${esc(this.panel.name || 'This panel')}</b><span>The panel open in the designer</span></div>`,
        '<div class="home-empty">No device on the bench yet — each one gets a tile here as it comes online.</div>'];
    home.innerHTML = tiles.join('');
    home.querySelectorAll('.home-tile').forEach(el => el.addEventListener('click', async () => {
      if (el.dataset.key) await this.openDevice(el.dataset.key);
      this.openEnginePreview('device');
    }));
  }

  /** Open: this editor's block .json, a Gui_Frames frame, or the .ifc twin (APKSoftapp.openModel). The .ifc
      carries the panel but not its layout (that stays the .json's): it opens the panel with no controls and
      says which .json holds them. */
  async promptOpen() {
    const S = window.APKSoftapp;
    let fromIfc = null;
    const o = await S.openModel({
      fromIfc: (text) => { fromIfc = touchPanelFromIfc(text); return fromIfc.block; },
      // A Gui_Frames frame (an exported panel, or any library frame) opens as a panel; anything else is this editor's own block.
      fromJson: (parsed) => (isFrame(parsed) ? frameToPanel(parsed) : null) || parsed,
    });
    if (!o.ok) {
      if (!o.cancelled && o.problem) {
        S.showProblem(o.problem, {
          onRetry: () => this.promptOpen(),
          fix: ['Open a .json saved by this editor, its .ifc twin, or a Gui_Frames frame (Save Model when standalone writes the .json and the .ifc).'],
        });
      }
      return;
    }
    try {
      if (!o.model || typeof o.model !== 'object') throw new TypeError('this file holds no touch panel block');
      this.panel.deviceId = o.model.deviceId || this.panel.deviceId;
      this.handleBlockLoaded(o.model, { title: o.name });
    } catch (err) {
      S.showProblem('bad_input', {
        subject: o.name, detail: err.message, onRetry: () => this.promptOpen(),
        fix: ['Open a .json saved by this editor, its .ifc twin, or a Gui_Frames frame.'],
      });
      return;
    }
    const tag = document.getElementById('block-tag');
    if (fromIfc && tag) {
      tag.textContent = fromIfc.controls
        ? `OPENED .IFC: ITS ${fromIfc.controls} CONTROLS ARE IN ${fromIfc.layout || 'THE .JSON TWIN'}`
        : 'OPENED .IFC';
    }
  }
}
