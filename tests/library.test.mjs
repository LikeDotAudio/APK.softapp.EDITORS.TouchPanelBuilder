// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ControlLibrary, groupCatalogue, variablesFromApi, suggestWidgetType,
  humanLabel, bindingFor, benchDevices, benchFromBim, livenessOf, variableCount, matchesQuery,
} from '../js/library.js';

const CATALOGUE = {
  count: 2,
  devices: [
    { model: '34401A', family: 'DMM', manufacturer: 'HP', notes: '6.5 digit',
      summary: { get_count: 2, set_count: 1, nab_count: 2, rig_count: 1, do_count: 1 },
      api_url: '/api/instrument/api?model=34401A&family=DMM' },
    { model: '33220A', family: 'Generator', manufacturer: 'Agilent',
      summary: { get_count: 0, set_count: 3, nab_count: 0, rig_count: 0, do_count: 0 } },
  ],
};

const API = {
  model: '34401A',
  family: 'DMM',
  endpoints: {
    get: { Get_Volt: { command: 'Get_Volt', scpi: 'MEAS:VOLT?', arg: { kind: 'none' }, returns: { type: 'NR3' } } },
    nab: { Get_Volt: { command: 'Get_Volt', scpi: 'MEAS:VOLT?', arg: { kind: 'none' } },
      Nab_Stats: { command: 'Nab_Stats', scpi: 'CALC:AVER:ALL?', arg: { kind: 'none' }, returns: { type: 'list', fields: ['min', 'max', 'avg'] } } },
    set: { Set_Range: { command: 'Set_Range', scpi: 'VOLT:RANG <v>', subsystem: 'SENSe', arg: { kind: 'numeric' },
      mqtt: { topic: 'APK.audio/Gui/Komands/DMM/Set_Range' } } },
    rig: { Setup_Limits: { command: 'Setup_Limits', args: ['lower', 'upper'], arg: { kind: 'numeric', unit: 'V' } } },
    do: { Clear_Status: { command: 'Clear_Status', scpi: '*CLS', arg: { kind: 'none' } } },
  },
};

test('catalogue counts nabs only beyond their get twins', () => {
  const fams = groupCatalogue(CATALOGUE);
  assert.deepEqual(fams.map(f => f.family), ['DMM', 'Generator']);
  assert.equal(fams[0].models[0].variables, 5);
  assert.equal(variableCount({ nab_count: 99 }), 99);
  assert.equal(variableCount({ get_count: 5, nab_count: 7 }), 7);
  assert.match(fams[1].models[0].apiUrl, /model=33220A&family=Generator/);
});

test('api.json flattens to one variable per controllable command', () => {
  const vars = variablesFromApi(API);
  assert.equal(vars.length, 5, 'a nab twin of a get is folded into it; a multi-value nab stays');
  const rig = vars.find(v => v.verb === 'rig');
  assert.equal(suggestWidgetType(rig), 'rig');
  assert.deepEqual(rig.args.map(a => [a.name, a.unit]), [['lower', 'V'], ['upper', '']]);
  const nab = vars.find(v => v.verb === 'nab');
  assert.equal(nab.command, 'Nab_Stats');
  assert.equal(suggestWidgetType(nab), 'nab');
  assert.deepEqual(nab.args.map(a => a.name), ['min', 'max', 'avg']);
  const set = vars.find(v => v.verb === 'set');
  assert.equal(set.id, 'DMM/34401A/set/Set_Range');
  assert.equal(set.topic, 'APK.audio/Gui/Komands/DMM/Set_Range');
  assert.equal(suggestWidgetType(set), 'fader');
  assert.equal(suggestWidgetType(vars.find(v => v.verb === 'do')), 'button');
  assert.equal(suggestWidgetType(vars.find(v => v.verb === 'get')), 'readout');
  assert.equal(suggestWidgetType({ verb: 'set', kind: 'enum' }), 'tile');
  assert.ok(matchesQuery(set, 'rang sense'));
  assert.ok(!matchesQuery(set, 'trigger'));
});

test('labels and bindings', () => {
  assert.equal(humanLabel('Set_Volt_Range'), 'VOLT RANGE');
  const [v] = variablesFromApi(API).filter(x => x.verb === 'set');
  const b = bindingFor(v, { prefix: 'APK.audio/System/Protocols/visa/Device/DMM/34401A/Dev0' });
  assert.equal(b.device, 'APK.audio/System/Protocols/visa/Device/DMM/34401A/Dev0');
  assert.equal(b.command, 'Set_Range');
});

test('bench lists every box, online first, then recent, unknown (orange), offline last', () => {
  const now = 2_000_000_000;
  const iso = (secsAgo) => new Date((now - secsAgo) * 1000).toISOString();
  const bench = benchDevices({ devices: [
    { prefix: 'p/off', key: 'OFF/Dev0', status: 'offline', last_seen: iso(86400 * 30),
      api: { known: true, model: '34401A', family: 'DMM', summary: { set_count: 4 } } },
    { prefix: 'p/unk', key: 'UNK/Dev0' },
    { prefix: 'p/recent', key: 'REC/Dev0', status: 'offline', last_seen: iso(120) },
    { prefix: 'p/on', key: 'ON/Dev0', status: 'online',
      api: { known: true, model: '34401A', family: 'DMM', summary: { set_count: 4 } } },
  ] }, now);
  assert.deepEqual(bench.map(d => d.liveness), ['online', 'recent', 'unknown', 'offline']);
  assert.equal(bench[0].variables, 4);
  assert.equal(bench[2].known, false, 'a box the library has no api for is still listed');
  assert.equal(livenessOf('remembered', null, now), 'unknown');
  assert.equal(livenessOf('online', iso(86400 * 3), now), 'unknown', 'an online nobody has re-checked in days is unknown (orange)');
});

test('the BIM registry is read when it answers: graveyard is offline unless seen within its window', () => {
  const now = 2_000_000_000;
  const models = new Map([['DMM/34401A', { model: '34401A', family: 'DMM', variables: 155 }]]);
  const bench = benchFromBim({ recent_secs: 600, items: [
    { key: 'MY123', make: 'HP', model: '34401A', state: 'graveyard', last_seen: now - 300 },
    { key: 'MY999', make: 'HP', model: '34401A', state: 'graveyard', last_seen: now - 6000 },
    { key: 'USB-1', make: 'Rigol', model: 'DS1104Z', state: 'online', icon: '📈', panel: { prefix: 'p/scope' } },
  ] }, models, now);
  assert.deepEqual(bench.map(d => [d.key, d.liveness]), [['USB-1', 'online'], ['MY123', 'recent'], ['MY999', 'offline']]);
  assert.equal(bench[1].variables, 155);
  assert.equal(bench[0].prefix, 'p/scope');
});

test('ControlLibrary loads catalogue then a model, falling back to /api/os/', async () => {
  const asked = [];
  const fake = async (url) => {
    asked.push(url);
    if (url === '/api/instrument/api') return { ok: false, status: 404 };
    if (url === '/api/os/instrument/api') return { ok: true, json: async () => CATALOGUE };
    if (url.startsWith('/api/instrument/api?model=34401A')) return { ok: true, json: async () => API };
    return { ok: false, status: 404 };
  };
  const lib = await new ControlLibrary(fake).load();
  assert.equal(lib.totalModels, 2);
  assert.equal(lib.totalVariables, 8);
  const vars = await lib.variables('DMM/34401A');
  assert.equal(vars.length, 5);
  assert.ok(asked.includes('/api/os/instrument/api'));
});

import { modelKeyForPart } from '../js/library.js';
test('a BIM part finds its instrument model: its panel template, else the one model of that name (ROAD-3572)', () => {
  const models = new Map([
    ['DMM/34401A', { key: 'DMM/34401A', model: '34401A', family: 'DMM', manufacturer: 'Keysight' }],
    ['FG/33220A', { key: 'FG/33220A', model: '33220A', family: 'FG', manufacturer: 'Agilent' }],
  ]);
  assert.equal(modelKeyForPart({ model: '34401A', panel: { template: 'DMM' } }, models), 'DMM/34401A');
  assert.equal(modelKeyForPart({ model: '33220a', manufacturer: 'Keysight' }, models), 'FG/33220A');
  assert.equal(modelKeyForPart({ model: 'MXA920' }, models), '');
});
