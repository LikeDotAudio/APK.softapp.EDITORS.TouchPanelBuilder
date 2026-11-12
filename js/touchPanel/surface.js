// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/* TouchPanelApp, part: The glass: layout and fit, the popped grid, style field editors, the surface render (drag, fader send on release) and resize handles.
   Mixed into TouchPanelApp.prototype by js/touchPanelApp.js (ROAD-3766). */

import { connectionCount } from '../devicePanel.js';
import { CONTROL_DEFINITIONS, STYLE_FIELDS, BEHAVIOR_FIELDS, STYLE_PRESETS, widgetStyleVars } from '../controls.js';
import { cloneControl, isHold, HOLD_MS } from '../copyControl.js';
import { RESIZE_EDGES, resizeBox, fitPageSize, SCREEN_PRESETS } from './screens.js';
import { THEME_FIELDS, esc } from './common.js';

export class TouchPanelSurface {
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

  /* The glass a generated panel is laid out on. A fit-the-window page is as
     wide as the window and grows downward, so it is packed at least 800 px
     tall: a short window scrolls, it does not cut the device into pages. */
  layoutSize() {
    if (this.isFitScreen()) this.fitGlass();
    return { width: this.panel.width, height: this.isFitScreen() ? Math.max(800, this.panel.height) : this.panel.height };
  }

  isFitScreen() {
    return !!SCREEN_PRESETS.find(p => p.id === this.panel.screenPreset)?.fit;
  }

  /* The room the stage has for the bezel, in screen px: its inner box less
     the tabs and buttons stacked above the glass. */
  stageRoom() {
    const cs = getComputedStyle(this.stageEl);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const gap = parseFloat(cs.rowGap) || 0;
    let above = 0;
    for (const c of this.stageEl.children) {
      if (c === this.glassFitEl || c.hidden || getComputedStyle(c).position === 'absolute') continue;
      if (!c.offsetHeight) continue;
      const m = getComputedStyle(c);
      above += c.offsetHeight + parseFloat(m.marginTop) + parseFloat(m.marginBottom) + gap;
    }
    // The scale note sits on the stage's bottom edge; 2 px spare so rounding
    // never tips the stage into scroll bars.
    const note = this.glassScaleEl ? this.glassScaleEl.offsetHeight + 4 : 0;
    return { w: Math.max(100, this.stageEl.clientWidth - padX - 2), h: Math.max(100, this.stageEl.clientHeight - padY - above - note - 2) };
  }

  // The glass is drawn at its true resolution and scaled to fit the stage, so
  // what is placed here lands on the same pixel of the real panel. A
  // fit-the-window panel is the other way round: its page IS the stage, at
  // 100 %, and it follows every resize.
  fitGlass() {
    if (!this.bezelEl || !this.stageEl) return;
    const bezel = 12;
    const room = this.stageRoom();
    if (this.isFitScreen()) {
      const size = fitPageSize(room.w - bezel * 2, room.h - bezel * 2, this.panel.widgets);
      if (size.width !== this.panel.width || size.height !== this.panel.height) {
        this.panel.width = size.width;
        this.panel.height = size.height;
        this.surfaceEl.style.width = `${size.width}px`;
        this.surfaceEl.style.height = `${size.height}px`;
        this.scheduleEngineGlass();
      }
    }
    const outerW = this.panel.width + bezel * 2;
    const outerH = this.panel.height + bezel * 2;
    const s = this.isFitScreen() ? 1 : Math.min(room.w / outerW, room.h / outerH, 1.5);
    this.glassScale = s;
    this.bezelEl.style.transform = `scale(${s})`;
    this.glassFitEl.style.width = `${Math.floor(outerW * s)}px`;
    this.glassFitEl.style.height = `${Math.floor(outerH * s)}px`;
    if (this.glassScaleEl) {
      this.glassScaleEl.textContent = this.isFitScreen()
        ? `${this.panel.width} × ${this.panel.height} px · fits the window`
        : `${this.panel.width} × ${this.panel.height} px · shown at ${Math.round(s * 100)}%`;
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
      // Connections, counted per element: a row of 8 crosspoints is 8 wires.
      const nBound = connectionCount(w);
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
        + (nBound ? `<span class="w-badge" title="${nBound} connection(s) wired — every element of an array counts">${nBound}</span>` : '')
        + RESIZE_EDGES.map(d => `<span class="w-size" data-edge="${d}" title="Drag to resize"></span>`).join('');

      el.querySelector('.w-port').addEventListener('mousedown', (e) => this.startPortDrag(e, w));
      // Every control is scaled the same way, whatever draws it: the handles
      // belong to the stand-in, which is the control's box on the glass.
      el.querySelectorAll('.w-size').forEach(hd => hd.addEventListener('mousedown', (e) => this.startResize(e, w, el, hd.dataset.edge)));

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
          if (copied || dw.x !== origX || dw.y !== origY) {
            this.changed();
            if (this.isFitScreen()) this.fitGlass();
          }
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });

      this.surfaceEl.appendChild(el);
    });
    this.fitGlass();
    this.scheduleEngineGlass();
  }

  /* Drag one of a control's handles: n / s / e / w edges and the corners. The
     box is the control's geometry (x, y, w, h), saved like a move. */
  startResize(e, w, el, edge) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    this.selectWidget(w.id);
    const start = { x: e.clientX, y: e.clientY, wx: w.x, wy: w.y, ww: w.w, wh: w.h };
    const onMove = (me) => {
      const g = resizeBox(start, edge, (me.clientX - start.x) / this.glassScale, (me.clientY - start.y) / this.glassScale);
      Object.assign(w, g);
      el.style.left = `${w.x}px`;
      el.style.top = `${w.y}px`;
      el.style.width = `${w.w}px`;
      el.style.height = `${w.h}px`;
      this.renderTableFieldsOnly();
      this.scheduleWires();
      this.scheduleEngineGlass();
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (w.x !== start.wx || w.y !== start.wy || w.w !== start.ww || w.h !== start.wh) {
        this.changed();
        if (this.isFitScreen()) this.fitGlass();
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }
}
