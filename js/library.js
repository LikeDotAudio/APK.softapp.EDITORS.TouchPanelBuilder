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

// Which verbs a panel control can drive. `nab` is the bulk-read twin of `get`
// (same commands, same SCPI), so it is folded away rather than listed twice.
export const VERBS = ['set', 'do', 'rig', 'get'];

export const VERB_LABEL = {
  set: 'Set',
  do: 'Do',
  rig: 'Rig',
  get: 'Get',
};

const CATALOGUE_URLS = ['/api/instrument/api', '/api/os/instrument/api'];
const DEVICES_URLS = ['/api/devices', '/api/os/devices'];

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
export function variableCount(summary = {}) {
  return VERBS.reduce((n, v) => n + (Number(summary[`${v}_count`]) || 0), 0);
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

// Discovered boxes that the library knows, so a binding can name the box.
export function benchDevices(devicesReply) {
  return (devicesReply?.devices || [])
    .filter(d => d && d.api && d.api.known)
    .map(d => ({
      key: d.prefix || `${d.api.family}/${d.api.model}/${d.key || d.name}`,
      prefix: d.prefix || '',
      name: d.key || d.name || d.api.model,
      model: d.api.model,
      family: d.api.family,
      status: d.status || 'unknown',
      address: d.address || d.resource || '',
      variables: variableCount(d.api.summary),
    }));
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
  if (v.verb === 'get') return 'readout';
  if (v.verb === 'do' || v.verb === 'rig') return 'button';
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
    .replace(/^(Set|Get|Do|Setup|Rig)_/i, '')
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
    try {
      this.bench = benchDevices(await firstJson(DEVICES_URLS, this.fetchFn));
    } catch (_) {
      this.bench = [];
    }
    return this;
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
