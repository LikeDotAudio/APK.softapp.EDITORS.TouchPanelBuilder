// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/* TouchPanelApp, part: Binding variables to controls and the wires drawn between them (port drags, curves).
   Mixed into TouchPanelApp.prototype by js/touchPanelApp.js (ROAD-3766). */

import { CONTROL_DEFINITIONS, rigHeight } from '../controls.js';
import { modelKey, suggestWidgetType, sourceFeeds, humanLabel, bindingFor } from '../library.js';
import { esc } from './common.js';

export class TouchPanelWires {
  // ------------------------------------------------------------------ binding
  widgetById(id) {
    return this.panel.widgets.find(w => w.id === id) || null;
  }

  bindVariable(w, v) {
    if (!w || !v) return;
    w.bindings = w.bindings || [];
    if (!w.bindings.some(b => b.id === v.id)) {
      const b = bindingFor(v, this.deviceFor.get(modelKey(v.family, v.model)));
      const bim = this.bimFor.get(modelKey(v.family, v.model));   // picked from the BIM library: its part and reference
      if (bim && bim.bimId) Object.assign(b, { bimId: bim.bimId }, bim.bimRef ? { bimRef: bim.bimRef } : {});
      w.bindings.push(b);
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

      // Several commands can each give this control its information: draw every
      // one as a source feeding it from the left, one labelled feed per command.
      const feeds = sourceFeeds(w.bindings);
      const feedIds = new Set(feeds.map(b => b.id));
      const cy = wr.top + wr.height / 2;
      feeds.forEach((b, i) => {
        const n = feeds.length;
        const px = wr.left - 6;
        const py = wr.top + (wr.height * (i + 1)) / (n + 1);
        const fx = Math.max(base.left + 8, wr.left - 170);
        const fy = cy + (i - (n - 1) / 2) * 20;
        const d = this.curve(fx - base.left, fy - base.top, px - base.left, py - base.top);
        const name = b.command.length > 24 ? `${b.command.slice(0, 23)}…` : b.command;
        const tip = `${esc(b.model)} ${esc(b.command)}${b.scpi ? ` · ${esc(b.scpi)}` : ''} → ${esc(w.label)}\nSource ${i + 1} of ${n} · click to show · double-click to disconnect`;
        paths.push(`<path class="wire feed${sel}" d="${d}"/>`);
        paths.push(`<circle class="feed-src" cx="${(fx - base.left).toFixed(1)}" cy="${(fy - base.top).toFixed(1)}" r="3"/>`);
        paths.push(`<circle class="feed-port" cx="${(px - base.left).toFixed(1)}" cy="${(py - base.top).toFixed(1)}" r="4.5"/>`);
        paths.push(`<text class="feed-label" x="${(fx - base.left + 6).toFixed(1)}" y="${(fy - base.top - 4).toFixed(1)}" data-wid="${esc(w.id)}" data-bid="${esc(b.id)}">${esc(name)}<title>${tip}</title></text>`);
        paths.push(`<path class="hit" d="${d}" data-wid="${esc(w.id)}" data-bid="${esc(b.id)}"><title>${tip}</title></path>`);
      });

      for (const b of w.bindings) {
        if (feedIds.has(b.id)) continue;
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
        // AN ARRAY CONNECTION IS ONE WIRE PER ELEMENT (owner, 2026-11-11): each
        // crosspoint button / matrix cell runs its own wire from where it sits
        // on the control, carrying its own value into the command's argument.
        const els = Array.isArray(b.elements) ? b.elements : [];
        if (els.length) {
          const arg = (w.komand && w.komand.input_name) || 'value';
          els.forEach((e, i) => {
            const cell = wEl.querySelector(`[data-el="${CSS.escape(String(e.value))}"]`);
            const cr = cell ? cell.getBoundingClientRect() : null;
            const ex = cr ? Math.min(cr.right - 3, wr.right) : wr.right;   // a cell scrolled past the box leaves from its edge
            const ey = cr ? cr.top + cr.height / 2 : wr.top + (wr.height * (i + 1)) / (els.length + 1);
            const d = this.curve(ex - base.left, ey - base.top, x2 - base.left, y2 - base.top);
            const tip = `${esc(w.label)} · ${esc(e.label)} (${esc(e.value)}) → ${esc(b.model)} ${esc(b.command)} ${esc(arg)}=${esc(e.value)}\nElement ${i + 1} of ${els.length} · click to show · double-click to disconnect the whole array`;
            paths.push(`<path class="wire el${sel}${off}" d="${d}"/>`);
            paths.push(`<circle class="el-port" cx="${(ex - base.left).toFixed(1)}" cy="${(ey - base.top).toFixed(1)}" r="2"/>`);
            paths.push(`<path class="hit" d="${d}" data-wid="${esc(w.id)}" data-bid="${esc(b.id)}"><title>${tip}</title></path>`);
          });
          continue;
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
    svg.querySelectorAll('path.hit, text.feed-label').forEach(p => {
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
}
