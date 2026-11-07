// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

// THE CONTROL LIBRARY — what a touch panel can be wired to.
//
// The devices and their variables are not listed here. They are read from the
// instrument library (PODS/POD.THICK/INSTRUMENTS, every <Model>.api.json) as
// WEB.OsApi serves it:
//   GET /api/instrument/api                  -> the catalogue, one line per model
//   GET /api/instrument/api?model=X&family=Y -> that model's whole command surface
//   GET /api/devices                         -> the boxes discovery has seen,
//                                               each with the api block it answers
// The shell spells every OsApi route a second way under /api/os/, so both are
// tried. Nothing in this file names a model.

// Which verbs a panel control can drive. `rig` is a multi-argument setup (2–4
// inputs sent as one command) and `nab` a read that returns more than one
// thing; each gets its own control and its own section of a panel.
export const VERBS = ['set', 'do', 'rig', 'get', 'nab'];

export const VERB_LABEL = {
  set: 'Set',
  do: 'Do',
  rig: 'Rig',
  get: 'Get',
  nab: 'Nab',
};

/** The arguments of a rig (or the fields of a nab), each with what the api.json
    says about it: [{ name, kind, unit, values, min, max }]. */
export function argsOf(ep) {
  if (!ep || typeof ep !== 'object') return [];
  const arg = ep.arg || {};
  const params = arg.kind === 'multi' && arg.parameters && typeof arg.parameters === 'object' ? arg.parameters : {};
  let names = Array.isArray(ep.args) ? ep.args : Object.keys(params);
  if (!names.length && ep.returns && Array.isArray(ep.returns.fields)) names = ep.returns.fields;
  // A single-kind arg on a multi-name command (APPLy:SIN freq, amp, offset
  // with arg {unit: Hz}) describes the first name only.
  return names.map((name, i) => {
    const p = params[name] || (i === 0 && arg.kind !== 'multi' ? arg : {});
    return {
      name: String(name),
      kind: p.kind || (arg.kind !== 'multi' ? arg.kind : '') || 'numeric',
      unit: p.unit || '',
      values: Array.isArray(p.values) ? p.values : null,
      min: p.min ?? null,
      max: p.max ?? null,
    };
  });
}

const CATALOGUE_URLS = ['/api/instrument/api', '/api/os/instrument/api'];
const DEVICES_URLS = ['/api/devices', '/api/os/devices'];
const BIM_URLS = ['/api/bim/instances?state=online,graveyard,remembered'];

async function firstJson(urls, fetchFn) {
  let lastError = null;
  for (const url of urls) {
    try {
      const res = await fetchFn(url);
      if (res.ok) return await res.json();
      lastError = new Error(`${url} answered ${res.status}`);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('no library route answered');
}

// Count of controllable variables a catalogue line promises, from its summary.
// Every get is also listed as a nab, so only the nabs beyond the gets are their own.
export function variableCount(summary = {}) {
  const n = v => Number(summary[`${v}_count`]) || 0;
  return n('set') + n('do') + n('rig') + n('get') + Math.max(0, n('nab') - n('get'));
}

// The catalogue as families -> models, sorted, with variable counts.
export function groupCatalogue(catalogue) {
  const families = new Map();
  for (const d of catalogue?.devices || []) {
    if (!d || !d.model) continue;
    const fam = d.family || 'Other';
    if (!families.has(fam)) families.set(fam, []);
    families.get(fam).push({
      key: modelKey(d.family, d.model),
      model: d.model,
      family: fam,
      manufacturer: d.manufacturer || '',
      notes: d.notes || '',
      variables: variableCount(d.summary),
      apiUrl: d.api_url || `/api/instrument/api?model=${encodeURIComponent(d.model)}&family=${encodeURIComponent(fam)}`,
    });
  }
  return [...families.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([family, models]) => ({
      family,
      models: models.sort((a, b) => a.model.localeCompare(b.model, undefined, { numeric: true })),
      variables: models.reduce((n, m) => n + m.variables, 0),
    }));
}

export function modelKey(family, model) {
  return `${family || ''}/${model || ''}`;
}

/**
 * 📚 The instrument model a BIM part is (ROAD-3572): the part's own panel template is
 * its family (part.panel.template), else the one catalogue line whose model is the
 * part's. '' when the instrument library has no command surface for it.
 */
export function modelKeyForPart(part, models) {
  if (!part || !models) return '';
  const model = String(part.model || '').toLowerCase();
  if (!model) return '';
  const fam = part.panel && part.panel.template;
  if (fam) {
    const k = modelKey(fam, part.model);
    if (models.has(k)) return k;
  }
  const same = [...models.values()].filter((m) => String(m.model).toLowerCase() === model);
  const maker = String(part.manufacturer || '').toLowerCase();
  const pick = same.length > 1 && maker ? same.find((m) => String(m.manufacturer).toLowerCase() === maker) : same[0];
  return (pick || same[0] || {}).key || '';
}

// LIVENESS — where a bench device sits in the left column. Online first, then
// recently online, then UNKNOWN (orange: nobody has said either way), then
// offline. Offline devices stay listed, greyed, so a panel's bindings to them
// survive a box being switched off. Identity is the device's own key (serial,
// MAC, USB id, bus prefix), never its IP.
export const LIVENESS_ORDER = { online: 0, recent: 1, unknown: 2, offline: 3 };

// The window "recently online" covers when the source does not state its own
// (DATABASE.server.BIM sends `recent_secs`; /api/devices does not).
export const DEFAULT_RECENT_SECS = 15 * 60;
// A source's "online" is believed only this long after the box was last heard
// (DATABASE.server.BIM sends `trust_secs`): an old "online" is unknown, not live.
export const DEFAULT_TRUST_SECS = 5 * 60;

function secondsOf(t) {
  if (t === undefined || t === null || t === '') return null;
  if (typeof t === 'number') return t > 1e12 ? Math.floor(t / 1000) : t;
  const ms = Date.parse(String(t).replace(' ', 'T'));
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

export function livenessOf(state, lastSeen, nowSecs, recentSecs = DEFAULT_RECENT_SECS, trustSecs = DEFAULT_TRUST_SECS) {
  const st = String(state || '').toLowerCase();
  const seen = secondsOf(lastSeen);
  if (st === 'online' || st === 'up' || st === 'alive') {
    return seen === null || nowSecs - seen <= trustSecs ? 'online' : 'unknown';
  }
  if (seen !== null && nowSecs - seen <= recentSecs) return 'recent';
  if (!st || st === 'unknown' || st === 'remembered' || seen === null) return 'unknown';
  return 'offline';
}

export function sortBench(rows) {
  return rows.sort((a, b) => (LIVENESS_ORDER[a.liveness] - LIVENESS_ORDER[b.liveness])
    || ((b.lastSeen || 0) - (a.lastSeen || 0))
    || String(a.name).localeCompare(String(b.name), undefined, { numeric: true }));
}

// /api/devices (WEB.OsApi): every discovered box, with the api block it answers.
export function benchDevices(devicesReply, nowSecs = Math.floor(Date.now() / 1000), recentSecs = DEFAULT_RECENT_SECS) {
  return sortBench((devicesReply?.devices || [])
    .filter(d => d && (d.prefix || d.key || d.name))
    .map(d => {
      const api = d.api && d.api.known ? d.api : null;
      return {
        key: d.prefix || d.key || d.name,
        prefix: d.prefix || '',
        name: d.key || d.name || api?.model || '',
        make: d.manufacturer || api?.manufacturer || '',
        model: api?.model || d.model || '',
        family: api?.family || d.category || '',
        icon: '',
        known: !!api,
        status: d.status || 'unknown',
        liveness: livenessOf(d.status, d.last_seen, nowSecs, recentSecs),
        lastSeen: secondsOf(d.last_seen),
        address: d.address || d.resource || '',
        panel: d.panel && typeof d.panel === 'object' ? d.panel : null,
        variables: api ? variableCount(api.summary) : 0,
      };
    }));
}

// /api/bim/instances (DATABASE.server.BIM): the bench keyed by serial / USB id /
// MAC, each with make, model, icon, its part and its default panel.
export function benchFromBim(reply, catalogueModels = new Map(), nowSecs = Math.floor(Date.now() / 1000)) {
  const recent = Number(reply?.recent_secs) || DEFAULT_RECENT_SECS;
  const trust = Number(reply?.trust_secs) || DEFAULT_TRUST_SECS;
  const byModel = new Map();
  for (const m of catalogueModels.values()) byModel.set(String(m.model).toUpperCase(), m);
  return sortBench((reply?.items || []).filter(r => r && r.key).map(r => {
    const lib = byModel.get(String(r.model || '').toUpperCase());
    const state = r.state === 'graveyard' ? 'offline' : r.state;
    return {
      key: r.key,
      prefix: r.panel?.prefix || r.prefix || '',
      name: r.name || [r.make, r.model].filter(Boolean).join(' ') || r.key,
      make: r.make || '',
      model: lib?.model || r.model || '',
      family: lib?.family || '',
      icon: r.icon || '',
      part: r.part || '',
      known: !!lib,
      status: r.state || 'unknown',
      liveness: livenessOf(state, r.last_seen, nowSecs, recent, trust),
      lastSeen: secondsOf(r.last_seen),
      address: '',
      panel: r.panel || null,
      variables: lib ? lib.variables : 0,
    };
  }));
}

export function agoText(lastSeen, nowSecs = Math.floor(Date.now() / 1000)) {
  if (!lastSeen) return 'never seen';
  const d = Math.max(0, nowSecs - lastSeen);
  if (d < 90) return 'seen just now';
  if (d < 3600) return `seen ${Math.round(d / 60)} min ago`;
  if (d < 86400 * 2) return `seen ${Math.round(d / 3600)} h ago`;
  return `seen ${Math.round(d / 86400)} days ago`;
}

// One flat row per controllable variable of one model's api.json.
export function variablesFromApi(api) {
  if (!api || typeof api !== 'object') return [];
  const family = api.family || '';
  const model = api.model || '';
  const out = [];
  for (const verb of VERBS) {
    const eps = api.endpoints?.[verb];
    if (!eps || typeof eps !== 'object') continue;
    for (const [name, ep] of Object.entries(eps)) {
      const command = ep?.command || name;
      // A nab that is a get's twin (same command) is that get, not a second control.
      if (verb === 'nab' && api.endpoints?.get && (api.endpoints.get[name] || api.endpoints.get[command])) continue;
      const arg = ep?.arg || {};
      out.push({
        id: variableId(family, model, verb, command),
        family,
        model,
        verb,
        command,
        description: ep?.description || '',
        scpi: ep?.scpi || '',
        subsystem: ep?.subsystem || ep?.group || 'General',
        group: ep?.group || ep?.subsystem || 'General',
        kind: arg.kind || 'none',
        values: Array.isArray(arg.values) ? arg.values : null,
        unit: arg.unit || '',
        returns: ep?.returns?.type || '',
        args: argsOf(ep),
        topic: ep?.mqtt?.topic || '',
        readingTopic: ep?.mqtt?.reading_topic || '',
      });
    }
  }
  return out;
}

export function variableId(family, model, verb, command) {
  return `${family}/${model}/${verb}/${command}`;
}

// The widget a variable asks for when it is dropped on bare glass.
export function suggestWidgetType(v) {
  if (!v) return 'button';
  if (v.verb === 'rig') return 'rig';
  if (v.verb === 'nab') return 'nab';
  if (v.verb === 'get') return 'readout';
  if (v.verb === 'do') return 'button';
  switch (v.kind) {
    case 'numeric':
    case 'integer':
    case 'unknown':
      return 'fader';
    case 'enum':
      return 'tile';
    case 'bool':
    case 'none':
      return 'button';
    default:
      return 'readout';
  }
}

// "Set_Volt_Range" -> "VOLT RANGE"
export function humanLabel(command) {
  return String(command || '')
    .replace(/^(Set|Get|Do|Rig|Nab)_/i, '')
    .replace(/_/g, ' ')
    .trim()
    .toUpperCase() || String(command || '').toUpperCase();
}

// The binding a widget stores: enough to address the variable without the library.
export function bindingFor(v, device = null) {
  return {
    id: v.id,
    family: v.family,
    model: v.model,
    verb: v.verb,
    command: v.command,
    scpi: v.scpi,
    topic: v.topic,
    device: device ? device.prefix || device.key : '',
  };
}

/** The verbs that bring information back from a device (a reading, a settings snapshot). */
export const SOURCE_VERBS = new Set(['get', 'nab']);

/**
 * When a control can take its information from more than one command, each of
 * those commands is a source feeding it and is drawn entering from the left,
 * one feed per command. A control with one source (or none) keeps its single
 * wire out of its right-hand port. Returns the source bindings, or [].
 */
export function sourceFeeds(bindings = []) {
  const sources = (bindings || []).filter(b => SOURCE_VERBS.has(b?.verb));
  return sources.length > 1 ? sources : [];
}

export function matchesQuery(v, q) {
  if (!q) return true;
  const hay = `${v.command} ${v.description} ${v.scpi} ${v.subsystem} ${v.model} ${v.family}`.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(t => hay.includes(t));
}

export class ControlLibrary {
  constructor(fetchFn = (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null)) {
    this.fetchFn = fetchFn;
    this.families = [];
    this.bench = [];
    this.models = new Map();      // key -> catalogue line
    this.apis = new Map();        // key -> Promise<variables[]>
    this.error = null;
  }

  async load() {
    try {
      const catalogue = await firstJson(CATALOGUE_URLS, this.fetchFn);
      this.families = groupCatalogue(catalogue);
      for (const f of this.families) for (const m of f.models) this.models.set(m.key, m);
    } catch (err) {
      this.error = err;
      this.families = [];
    }
    await this.refreshBench();
    return this;
  }

  // The bench, from the BIM instance registry when it answers, else OsApi's
  // device list. Called again on a timer: liveness changes while you work.
  async refreshBench() {
    try {
      const bim = await firstJson(BIM_URLS, this.fetchFn);
      if (bim && Array.isArray(bim.items) && bim.source_ok !== false) {
        this.bench = benchFromBim(bim, this.models);
        this.benchSource = 'bim';
        return this.bench;
      }
    } catch (_) {}
    try {
      this.bench = benchDevices(await firstJson(DEVICES_URLS, this.fetchFn));
      this.benchSource = 'devices';
    } catch (_) {
      this.bench = this.bench || [];
    }
    return this.bench;
  }

  get totalModels() {
    return this.models.size;
  }

  get totalVariables() {
    let n = 0;
    for (const m of this.models.values()) n += m.variables;
    return n;
  }

  variables(key) {
    if (!this.apis.has(key)) {
      const m = this.models.get(key);
      const [family, model] = key.split('/');
      const url = m?.apiUrl || `/api/instrument/api?model=${encodeURIComponent(model)}&family=${encodeURIComponent(family)}`;
      const urls = [url, url.replace(/^\/api\//, '/api/os/')];
      const p = firstJson(urls, this.fetchFn)
        .then(api => variablesFromApi(api))
        .catch(err => {
          this.apis.delete(key);
          throw err;
        });
      this.apis.set(key, p);
    }
    return this.apis.get(key);
  }
}
