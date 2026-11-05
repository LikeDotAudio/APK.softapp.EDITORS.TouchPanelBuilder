// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ControlLibrary, groupCatalogue, variablesFromApi, suggestWidgetType,
  humanLabel, bindingFor, benchDevices, variableCount, matchesQuery,
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
    nab: { Get_Volt: { command: 'Get_Volt', scpi: 'MEAS:VOLT?', arg: { kind: 'none' } } },
    set: { Set_Range: { command: 'Set_Range', scpi: 'VOLT:RANG <v>', subsystem: 'SENSe', arg: { kind: 'numeric' },
      mqtt: { topic: 'APK.audio/Gui/Komands/DMM/Set_Range' } } },
    rig: { Setup_Limits: { command: 'Setup_Limits', arg: { kind: 'numeric' } } },
    do: { Clear_Status: { command: 'Clear_Status', scpi: '*CLS', arg: { kind: 'none' } } },
  },
};

test('catalogue groups by family and counts variables without nab twins', () => {
  const fams = groupCatalogue(CATALOGUE);
  assert.deepEqual(fams.map(f => f.family), ['DMM', 'Generator']);
  assert.equal(fams[0].models[0].variables, 5);
  assert.equal(variableCount({ nab_count: 99 }), 0);
  assert.match(fams[1].models[0].apiUrl, /model=33220A&family=Generator/);
});

test('api.json flattens to one variable per controllable command', () => {
  const vars = variablesFromApi(API);
  assert.equal(vars.length, 4, 'nab is folded into get');
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

test('bench keeps only boxes the library knows', () => {
  const bench = benchDevices({ devices: [
    { prefix: 'p/DMM/34401A/Dev0', key: '34401A/Dev0', status: 'online',
      api: { known: true, model: '34401A', family: 'DMM', summary: { set_count: 4 } } },
    { prefix: 'p/x', api: { known: false } },
  ] });
  assert.equal(bench.length, 1);
  assert.equal(bench[0].variables, 4);
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
  assert.equal(vars.length, 4);
  assert.ok(asked.includes('/api/os/instrument/api'));
});
