// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/* TouchPanelApp, part: The device theme dropdown, the look library (shelves, live view, previews) and the screen-preset dropdown.
   Mixed into TouchPanelApp.prototype by js/touchPanelApp.js (ROAD-3766). */

import { CONTROL_DEFINITIONS, STYLE_PRESETS, widgetStyleVars } from '../controls.js';
import { VINTAGE_LOOKS, groupLooks, lookFromField } from '../lookLibrary.js';
import { SCREEN_PRESETS } from './screens.js';
import { esc } from './common.js';

export class TouchPanelLooks {
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
      // A library element keeps its whole config: the engine draws the control
      // from it (frameExport uses `field` as the base), not from five colours.
      if (look.field) w.field = JSON.parse(JSON.stringify(look.field)); else delete w.field;
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
}
