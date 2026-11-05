// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
// Device palettes: Set/Do/Rig/Get -> sub-category trees, grab bags, the default
// whole-device drop and a device's ins/outs, against fixtures and real api.json.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { variablesFromApi } from '../js/library.js';
import {
  PALETTE_VERBS, paletteOf, grabBag, paletteFilter, deviceIO,
  subsystemKey, subsystemNames, isCommonCommand,
} from '../js/palettes.js';

const here = path.dirname(fileURLToPath(import.meta.url));

// The instrument library lives in POD.THICK; walk up to the repo root to find it.
function instruments() {
  let dir = here;
  for (let i = 0; i < 10; i++) {
    const p = path.join(dir, 'PODS', 'POD.THICK', 'INSTRUMENTS');
    if (fs.existsSync(p)) return p;
    dir = path.dirname(dir);
  }
  return null;
}

function realVars(rel) {
  const root = instruments();
  const file = root && path.join(root, rel);
  if (!file || !fs.existsSync(file)) return null;
  return variablesFromApi(JSON.parse(fs.readFileSync(file, 'utf8')));
}

const REAL = [
  'INSTRUMENT.DMM/34401A/34401A.api.json',
  'INSTRUMENT.Generator/33220A/33220A.api.json',
];

function ep(scpi, subsystem, arg = { kind: 'none' }, extra = {}) {
  return { scpi, subsystem, group: subsystem, arg, mqtt: { topic: 't' }, ...extra };
}

const FIXTURE = variablesFromApi({
  family: 'Fix',
  model: 'F1',
  endpoints: {
    set: {
      Set_Ese: ep('*ESE <value>', 'Common', { kind: 'integer' }),
      Set_Range: ep(':SENSe:VOLTage:DC:RANGe <value>', 'SENSe', { kind: 'numeric' }),
      Set_Nplc: ep('SENS:VOLT:NPLC <value>', 'SENS', { kind: 'numeric' }),
      Set_Beep: ep('SYSTem:BEEPer:STATe <value>', 'SYSTem', { kind: 'bool', values: ['0', '1'] }),
      Set_Wave: ep('DATA:DAC VOLATILE, <block>', 'DATA', { kind: 'block' }),
      Set_Cal: ep('CAL:VAL <value>', 'CAL', { kind: 'numeric' }),
    },
    do: {
      Do_Cls: ep('*CLS', 'Common'),
      Reset_Device: ep('*RST', 'System'),
      Do_Init: ep('INITiate', 'TRIGger'),
    },
    rig: {
      Rig_Conf: ep('CONFigure:VOLTage:DC <range>,<res>', 'CONFigure', { kind: 'multi', parameters: { range: {}, res: {} } }),
    },
    get: {
      Get_Range: ep(':SENSe:VOLTage:DC:RANGe?', 'SENSe', { kind: 'none' }, { mqtt: { topic: 't', reading_topic: 'r' } }),
      Read_Next: ep(':READ?', 'MEASure', { kind: 'none' }, { mqtt: { topic: 't', reading_topic: 'r' } }),
      Read_IDN: ep('*IDN?', 'Common', { kind: 'none' }, { mqtt: { topic: 't', reading_topic: 'r' } }),
      Get_Calc: ep('CALCulate:AVERage:AVERage?', 'CALCulate'),
      Get_Err: ep('SYST:ERR?', 'System'),
    },
    nab: {
      Get_Stats: ep(':CALC:AVER:MIN?;:CALC:AVER:MAX?', 'CALC', { kind: 'none' }, { returns: { fields: ['min', 'max'] } }),
    },
  },
});

const cmds = list => list.map(v => v.command).sort();

test('subsystem keys: SCPI long and short forms meet, CAL stays apart from CALC', () => {
  assert.equal(subsystemKey('SENSe'), 'SENS');
  assert.equal(subsystemKey('SENS'), 'SENS');
  assert.equal(subsystemKey('System'), 'SYSTEM');
  const names = subsystemNames(FIXTURE);
  assert.equal(names.get('SENSe').key, names.get('SENS').key);
  assert.equal(names.get('SENS').label, 'SENSe');
  assert.equal(names.get('System').key, names.get('SYSTem').key, 'System folds into SYST');
  assert.equal(names.get('System').label, 'SYSTem');
  assert.equal(names.get('CALCulate').key, names.get('CALC').key);
  assert.notEqual(names.get('CAL').key, names.get('CALC').key, 'calibration is not calculate');
});

test('paletteOf: Set, Do, Rig, Get in order, nabs under Get, counts add up', () => {
  const p = paletteOf(FIXTURE);
  assert.deepEqual(p.verbs.map(v => v.label), ['Set', 'Do', 'Rig', 'Get']);
  assert.equal(p.count, FIXTURE.length);
  assert.deepEqual(p.verbs.map(v => v.count), [6, 3, 1, 6]);
  for (const v of p.verbs) {
    assert.equal(v.count, v.subcategories.reduce((n, s) => n + s.count, 0));
    for (const s of v.subcategories) assert.equal(s.count, s.variables.length);
  }
  const set = p.verbs[0].subcategories;
  assert.equal(set.find(s => s.label === 'SENSe').count, 2, 'SENSe + SENS merged');
  assert.equal(set.at(-1).key, 'COMMON', 'housekeeping last');
  const get = p.verbs[3].subcategories;
  assert.ok(get.find(s => s.label === 'CALCulate').variables.some(v => v.verb === 'nab'));
});

test('paletteOf: empty verbs kept by default, dropped on request', () => {
  const onlySets = FIXTURE.filter(v => v.verb === 'set');
  assert.deepEqual(paletteOf(onlySets).verbs.map(v => v.count), [6, 0, 0, 0]);
  assert.deepEqual(paletteOf(onlySets, { keepEmpty: false }).verbs.map(v => v.verb), ['set']);
  assert.equal(paletteOf([]).count, 0);
  assert.equal(paletteOf(null).verbs.length, 4);
});

test('grabBag: a verb, a sub-category, both, everything', () => {
  assert.equal(grabBag(FIXTURE).length, FIXTURE.length);
  assert.deepEqual(cmds(grabBag(FIXTURE, { verb: 'do' })), ['Do_Cls', 'Do_Init', 'Reset_Device']);
  assert.deepEqual(cmds(grabBag(FIXTURE, { verb: 'get' })), ['Get_Calc', 'Get_Err', 'Get_Range', 'Get_Stats', 'Read_IDN', 'Read_Next']);
  // Any spelling of a sub-category finds the merged one, across verbs.
  for (const name of ['SENSe', 'SENS', 'sens']) {
    assert.deepEqual(cmds(grabBag(FIXTURE, { subsystem: name })), ['Get_Range', 'Set_Nplc', 'Set_Range'], name);
  }
  assert.deepEqual(cmds(grabBag(FIXTURE, { verb: 'set', subsystem: 'SENS' })), ['Set_Nplc', 'Set_Range']);
  assert.deepEqual(cmds(grabBag(FIXTURE, { subsystem: 'SYSTEM' })), ['Get_Err', 'Reset_Device', 'Set_Beep']);
  assert.deepEqual(grabBag(FIXTURE, { subsystem: 'NOPE' }), []);
});

test('paletteFilter: whole-device drop skips common, readbacks and blocks unless asked', () => {
  const f = cmds(paletteFilter(FIXTURE));
  assert.deepEqual(f, ['Do_Init', 'Get_Calc', 'Get_Err', 'Get_Stats', 'Read_Next', 'Rig_Conf', 'Set_Beep', 'Set_Cal', 'Set_Nplc', 'Set_Range']);
  assert.ok(cmds(paletteFilter(FIXTURE, { includeCommon: true })).includes('Set_Ese'));
  assert.ok(cmds(paletteFilter(FIXTURE, { includeCommon: true })).includes('Reset_Device'), '*RST is common by its SCPI');
  assert.ok(cmds(paletteFilter(FIXTURE, { includeReadbacks: true })).includes('Get_Range'));
  assert.ok(cmds(paletteFilter(FIXTURE, { includeBlocks: true })).includes('Set_Wave'));
  assert.deepEqual(cmds(paletteFilter(FIXTURE, { verbs: ['get'] })), ['Get_Calc', 'Get_Err', 'Get_Stats', 'Read_Next']);
  const all = paletteFilter(FIXTURE, { includeCommon: true, includeReadbacks: true, includeBlocks: true });
  assert.equal(all.length, FIXTURE.length);
  assert.ok(isCommonCommand(FIXTURE.find(v => v.command === 'Do_Cls')));
});

test('deviceIO: ins are set/do/rig, outs are get/nab', () => {
  const io = deviceIO(FIXTURE);
  assert.equal(io.model, 'F1');
  assert.deepEqual(io.inputs.byVerb, { set: 6, do: 3, rig: 1 });
  assert.deepEqual(io.outputs.byVerb, { get: 5, nab: 1 });
  assert.equal(io.inputs.count + io.outputs.count, io.total);
  assert.equal(io.outputs.readingTopics, 3);
  assert.equal(io.common, 4);
  assert.equal(io.text, '10 in · 6 out');
  for (const side of [io.inputs, io.outputs]) {
    assert.equal(side.count, side.bySubcategory.reduce((n, s) => n + s.count, 0));
  }
});

for (const rel of REAL) {
  const vars = realVars(rel);
  test(`real ${rel}`, { skip: !vars && 'instrument library not in this tree' }, () => {
    assert.ok(vars.length > 50);
    const p = paletteOf(vars);
    assert.deepEqual(p.verbs.map(v => v.verb), PALETTE_VERBS);
    assert.equal(p.count, vars.length, 'every variable in exactly one place');
    const seen = new Set();
    for (const v of p.verbs) for (const s of v.subcategories) for (const x of s.variables) {
      assert.ok(!seen.has(x.id), `${x.id} twice`);
      seen.add(x.id);
    }
    // No duplicate sub-category labels within a verb once spellings merge.
    for (const v of p.verbs) {
      const keys = v.subcategories.map(s => s.key);
      assert.equal(new Set(keys).size, keys.length);
    }
    // Grab bags match the palette nodes.
    for (const v of p.verbs) {
      assert.equal(grabBag(vars, { verb: v.verb }).length, v.count);
      for (const s of v.subcategories) {
        assert.deepEqual(grabBag(vars, { verb: v.verb, subsystem: s.label }).map(x => x.id), s.variables.map(x => x.id));
      }
    }
    // The default drop: no common commands, a strict subset, every input not common kept.
    const drop = paletteFilter(vars);
    assert.ok(drop.length > 0 && drop.length < vars.length);
    assert.ok(drop.every(v => !String(v.scpi).trim().startsWith('*')));
    assert.ok(drop.every(v => v.kind !== 'block'));
    assert.ok(drop.some(v => v.verb === 'get' || v.verb === 'nab'), 'main readouts included');
    const io = deviceIO(vars);
    assert.equal(io.inputs.count + io.outputs.count, vars.length);
    assert.equal(io.inputs.count, p.verbs[0].count + p.verbs[1].count + p.verbs[2].count);
    assert.equal(io.outputs.count, p.verbs[3].count);
  });
}

test('real 34401A: measurements stay in the drop, range readbacks go', { skip: !realVars(REAL[0]) && 'no library' }, () => {
  const vars = realVars(REAL[0]);
  const drop = new Set(paletteFilter(vars).map(v => v.command));
  assert.ok(drop.has('Read_Next'));
  assert.ok(drop.has('Measure_DC_Voltage'));
  assert.ok(!drop.has('Read_IDN'));
  assert.ok(!drop.has('Get_Ese'));
  assert.ok(!drop.has('Get_Trigger_Count'), 'TRIGger:COUNt? reads back Set TRIGger:COUNt');
  assert.ok(paletteFilter(vars, { includeReadbacks: true }).some(v => v.command === 'Get_Trigger_Count'));
});
