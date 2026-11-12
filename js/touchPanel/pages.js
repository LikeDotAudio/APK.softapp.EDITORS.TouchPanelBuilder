// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

/* TouchPanelApp, part: Pages and device tabs: which page a control is on, the tab strips, the shareable link.
   Mixed into TouchPanelApp.prototype by js/touchPanelApp.js (ROAD-3766). */

import { linkQuery, linkSearch, wantFor, arrivals, deviceOptions } from '../devicePanel.js';
import { esc } from './common.js';

export class TouchPanelPages {
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
    if (!this.link && !this.opening && fresh.length && !linkQuery(location.search).model && !linkQuery(location.search).bim) this.openDevice(fresh[0].key);
    // A link opened by URL is its box's tab.
    if (this.link && !this.activeTab) {
      const mine = [...this.deviceTabs].find(([, t]) => t.want.model === this.link.model
        && (!this.link.serial || !t.want.serial || t.want.serial === this.link.serial));
      if (mine) this.activeTab = mine[0];
    }
    this.renderDeviceTabs();
    if (this.engineView === 'home' && !document.getElementById('engine-preview')?.hidden) this.renderEngineNav();
  }

  /* The device tabs show as ONE picker in the header (owner 2026-11-12: the
     cloud of chips above the page tabs ate a third of the glass). Same list,
     same labels, ● online / ○ offline; picking one does what clicking its tab
     did (openDevice). A fresh arrival not yet opened makes the picker pulse. */
  renderDeviceTabs() {
    const sel = document.getElementById('device-picker');
    if (!sel || !this.deviceTabs) return;
    const { options, selected } = deviceOptions(this.deviceTabs, this.activeTab);
    sel.innerHTML = options.map(o => `<option value="${esc(o.value)}" title="${esc(o.title)}"${o.gone ? ' class="gone"' : ''}>${esc(o.label)}</option>`).join('');
    sel.value = selected;
    sel.hidden = !options.length;
    const cur = options.find(o => o.value === selected);
    sel.title = cur && cur.value ? cur.title : 'Every device online on the bench: each joins this list as it comes online';
    sel.classList.toggle('gone', !!(cur && cur.gone));
    sel.classList.toggle('fresh', options.some(o => o.fresh));
    if (!sel.dataset.wired) {
      sel.dataset.wired = '1';
      sel.addEventListener('change', () => { if (sel.value) this.openDevice(sel.value); });
    }
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
}
