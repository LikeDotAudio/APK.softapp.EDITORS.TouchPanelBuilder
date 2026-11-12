// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/* TouchPanelApp, part: The instrument library: models, bench devices, the variable column, grab bags and default GUIs.
   Mixed into TouchPanelApp.prototype by js/touchPanelApp.js (ROAD-3766). */

import { panelFromVariables, elementConnections } from '../devicePanel.js';
import { paletteOf, grabBag, paletteFilter, deviceIO } from '../palettes.js';
import { VERB_LABEL, modelKey, matchesQuery, agoText, modelKeyForPart } from '../library.js';
import { bimFields } from '../bimLibrary.js';
import { VAR_PAGE, DRAG_MIME, GRAB_MIME, esc } from './common.js';

export class TouchPanelVariables {
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

  /** A part picked from the BIM library: the instrument model it is, selected, with its BIM reference. */
  async pickFromLibrary(item) {
    if (!item) return;
    let part = item.bim;
    const url = item.ref && item.ref.url;
    if (!(part.panel && part.panel.template) && url && /\/api\/bim\/parts\//.test(url)) {
      try { const r = await fetch(url); if (r.ok) part = Object.assign({}, part, await r.json()); } catch (_) { /* the block view only */ }
    }
    const key = modelKeyForPart(part, this.library.models);
    if (!key) {
      this.devCount.textContent = `${part.name || part.id}: no command surface in the instrument library`;
      return;
    }
    this.bimFor.set(key, bimFields(item));
    this.selectModel(key);
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
      return `<div class="lib-row bench ${d.liveness} ${k && sel.has(k) ? 'on' : ''}" ${k ? `data-mkey="${esc(k)}" draggable="true" data-grab="${esc(k)}"` : ''} data-bench="${i}"
          title="${esc(d.name)} · ${esc(d.liveness)} · ${esc(agoText(d.lastSeen, nowSecs))}${d.address ? '\n' + esc(d.address) : ''}">
        <span class="dot ${d.liveness}"></span>
        <span class="main"><span>${esc(label)}</span><span class="sub">${esc(d.name)} · ${esc(d.liveness === 'unknown' ? 'status unknown' : agoText(d.lastSeen, nowSecs))}</span></span>
        ${k && bound.get(k) ? `<span class="bound">${bound.get(k)}⇄</span>` : ''}
        ${(d.panel?.prefix) ? `<button class="verb-chip gui" data-gui="${i}" title="Open its own panel in the OS">▣</button>` : ''}
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
        parts.push(`<div class="lib-row ${sel.has(m.key) ? 'on' : ''}" data-mkey="${esc(m.key)}" draggable="true" data-grab="${esc(m.key)}" title="Click to list its variables · drag onto the glass to bring its whole palette">
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
    // Drag a device onto the glass: its whole palette comes with it.
    this.devList.querySelectorAll('[data-grab]').forEach(r => r.addEventListener('dragstart', (e) => {
      const device = r.dataset.bench !== undefined ? lib.bench[Number(r.dataset.bench)] : null;
      if (device) this.deviceFor.set(r.dataset.grab, device);
      e.dataTransfer.setData(GRAB_MIME, JSON.stringify({ key: r.dataset.grab }));
      e.dataTransfer.effectAllowed = 'copy';
    }));
    this.devList.querySelectorAll('[data-gui]').forEach(b => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const d = lib.bench[Number(b.dataset.gui)];
      if (!this.openDefaultGui(d)) {
        const tag = document.getElementById('block-tag');
        if (tag) tag.textContent = 'OPEN THE DESIGNER FROM THE OS TO OPEN A DEVICE PANEL';
      }
    }));
    this.devList.querySelectorAll('.lib-row').forEach(r => r.addEventListener('click', (e) => {
      const device = r.dataset.bench !== undefined ? lib.bench[Number(r.dataset.bench)] : null;
      if (!r.dataset.mkey) return; // a box the instrument library has no api for
      this.selectModel(r.dataset.mkey, { additive: e.shiftKey || e.ctrlKey || e.metaKey, device });
    }));
    this.scheduleWires();
  }

  varRowHtml(v, boundIds) {
    const extra = [v.subsystem, v.scpi, v.values ? v.values.slice(0, 6).join('|') : v.kind !== 'none' ? v.kind : '']
      .filter(Boolean).join(' · ');
    const verb = (VERB_LABEL[v.verb] || v.verb).toUpperCase();
    // Every element wired to this variable, across every control: countable,
    // and listed one by one under the row (collapsed until opened).
    const els = elementConnections(this.panel.widgets, v.id);
    const count = els.length ? `<span class="el-count" title="${els.length} element(s) wired to this command">×${els.length}</span>` : '';
    const list = els.length ? `<details class="var-elements" data-vid-els="${esc(v.id)}"${this.openElementLists?.has(v.id) ? ' open' : ''}>
        <summary>${els.length} element${els.length === 1 ? '' : 's'} wired</summary>
        <ol>${els.map(e => `<li data-wid="${esc(e.widget.id)}">${esc(e.widget.label)} · ${esc(e.label)} <code>${esc(e.value)}</code></li>`).join('')}</ol></details>` : '';
    return `<div class="lib-row var-row ${boundIds.has(v.id) ? 'bound' : ''}" draggable="true" data-vid="${esc(v.id)}"
        title="${esc(v.description)}\n${esc(v.scpi)}${v.topic ? '\n' + esc(v.topic) : ''}">
      <span class="port"></span>
      <span class="verb verb-${esc(v.verb)}">${esc(verb)}</span>
      <span class="main"><span>${esc(v.command)}${count}</span><span class="sub">${esc(extra)}</span></span>
      <button class="add" title="Wire to the selected control (or make one)">＋</button></div>${list}`;
  }

  // GRAB BAGS — a whole device, verb or sub-category dropped as controls. They
  // go onto new pages (named after the device and the bag) laid out by
  // devicePanel.panelFromVariables, so nothing already on the glass moves.
  grabSpec(el) {
    return { key: el.dataset.grab, verb: el.dataset.grabVerb || '', sub: el.dataset.grabSub || '' };
  }

  async dropGrabBag({ key, verb = '', sub = '' }) {
    let vars = this.varsByModel.get(key);
    if (!Array.isArray(vars)) {
      try { vars = await this.library.variables(key); } catch (_) { return; }
      this.varsByModel.set(key, vars);
      vars.forEach(v => this.varIndex.set(v.id, v));
    }
    const pick = verb || sub ? grabBag(vars, { verb: verb || undefined, subsystem: sub || undefined }) : paletteFilter(vars);
    if (!pick.length) return;
    const m = this.library.models.get(key);
    const device = this.deviceFor.get(key) || null;
    const built = panelFromVariables(pick, {
      model: m?.model || key.split('/')[1] || '', family: m?.family || key.split('/')[0] || '',
      device, ...this.layoutSize(),
    });
    if (!built || !built.widgets?.length) return;
    const title = [m?.model || key, sub || (verb ? VERB_LABEL[verb] || verb : '')].filter(Boolean).join(' · ');
    const stamp = Date.now();
    const pageId = new Map();
    let n = this.panel.pages.length;
    for (const pg of built.pages || []) {
      while (this.panel.pages.some(p => p.id === `p${n}`)) n += 1;
      const id = `p${n}`;
      this.panel.pages.push({ id, name: built.pages.length > 1 ? `${title} · ${pg.name}` : title });
      pageId.set(pg.id, id);
    }
    const first = [...pageId.values()][0] || this.currentPage;
    built.widgets.forEach((w, i) => {
      this.panel.widgets.push({ ...w, id: `w_${stamp}_${i}`, page: pageId.get(w.page) || first });
    });
    this.setPage(first);
    this.renderVariables();
    this.changed();
  }

  // A device's own default panel (its retained Gui/Panels panel), opened in
  // the OS shell the way DATABASE.server.BIM's picker does it.
  openDefaultGui(d) {
    const prefix = d?.panel?.prefix || d?.prefix;
    const shell = window.top !== window ? window.top : (window.opener || null);
    if (!prefix || !shell) return false;
    shell.postMessage({ apkos: 'device', action: 'open-console', prefix, label: d.name || d.model }, '*');
    return true;
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
      const io = deviceIO(vars);
      parts.push(`<div class="lib-group" data-mkey="${esc(key)}"><span class="grow">${head}</span>
        <span title="its own ins and outs">${esc(io.text)}</span>
        <button class="verb-chip grab" data-grab="${esc(key)}" title="Grab bag: the device's whole palette onto new pages">⊞ all</button></div>`);
      // Set / Do / Rig / Get, each split into its sub-categories. Every level is
      // a grab bag (⊞): click it, or drag it onto the glass, to bring all of it.
      for (const vb of paletteOf(rows, { keepEmpty: false }).verbs) {
        parts.push(`<div class="lib-sub verb-head verb-${esc(vb.verb)}" draggable="true" data-grab="${esc(key)}" data-grab-verb="${esc(vb.verb)}">
          <span class="grow">${esc(vb.label)}</span><span>${vb.count}</span>
          <button class="verb-chip grab" title="Grab bag: every ${esc(vb.label)} command">⊞</button></div>`);
        for (const sc of vb.subcategories) {
          const ck = `${key}|${vb.verb}|${sc.key}`;
          const open = !this.collapsedSub.has(ck) || !!this.varQuery;
          parts.push(`<div class="lib-sub sub-head" draggable="true" data-sub="${esc(ck)}" data-grab="${esc(key)}" data-grab-verb="${esc(vb.verb)}" data-grab-sub="${esc(sc.key)}">
            <span>${open ? '▾' : '▸'}</span><span class="grow">${esc(sc.label)}</span><span>${sc.count}</span>
            <button class="verb-chip grab" title="Grab bag: ${esc(sc.label)}">⊞</button></div>`);
          if (!open) continue;
          for (const v of sc.variables) {
            if (shown >= this.varLimit) { truncated = true; break; }
            shown += 1;
            parts.push(this.varRowHtml(v, boundIds));
          }
          if (truncated) break;
        }
        if (truncated) break;
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
    this.openElementLists = this.openElementLists || new Set();
    this.varList.querySelectorAll('details.var-elements').forEach(d => d.addEventListener('toggle', () => {
      if (d.open) this.openElementLists.add(d.dataset.vidEls); else this.openElementLists.delete(d.dataset.vidEls);
      this.scheduleWires();
    }));
    this.varList.querySelectorAll('details.var-elements li[data-wid]').forEach(li => li.addEventListener('click', () => {
      const w = this.widgetById(li.dataset.wid);
      if (w && w.page && w.page !== this.currentPage) this.setPage(w.page);
      this.selectWidget(li.dataset.wid);
    }));

    this.varList.querySelector('#var-more')?.addEventListener('click', () => {
      this.varLimit += VAR_PAGE;
      this.renderVariables();
    });

    this.varList.querySelectorAll('[data-grab]').forEach(el => {
      const btn = el.matches('button') ? el : el.querySelector('button.grab');
      btn?.addEventListener('click', (e) => { e.stopPropagation(); this.dropGrabBag(this.grabSpec(el)); });
      if (el.draggable) {
        el.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData(GRAB_MIME, JSON.stringify(this.grabSpec(el)));
          e.dataTransfer.effectAllowed = 'copy';
        });
      }
    });
    this.varList.querySelectorAll('[data-sub]').forEach(el => el.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const k = el.dataset.sub;
      if (this.collapsedSub.has(k)) this.collapsedSub.delete(k); else this.collapsedSub.add(k);
      this.renderVariables();
    }));

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
}
