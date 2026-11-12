// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Everything, sdkIndex, queryKey, stackParts, engineering, stickyDecade, toneOf, TONES,
  timeToFrac, fracToTime, askerName } from '../js/everything.js';

// A slice of the 34401A's own SDK (INSTRUMENT.DMM/34401A/34401A.api.json), as the bench serves it.
const api = { endpoints: {
  get: {
    MEASure_Resistance: { command: 'MEASure_Resistance', description: 'MEASure Resistance', scpi: 'MEASure:RESistance?', returns: { count: 1 } },
    MEASure_Voltage_DC: { command: 'MEASure_Voltage_DC', description: 'MEASure Voltage DC', scpi: 'MEASure:VOLTage:DC?', returns: { count: 1, type: 'NR3', unit: 'V' } },
    Measure_DC_Current: { command: 'Measure_DC_Current', description: 'Measure DC Current', scpi: ':MEASure:CURRent:DC? <range>,<resolution>', returns: { count: 1 } },
    Get_Func: { command: 'Get_Func', description: 'Which measurement function is selected', scpi: 'FUNCtion?', returns: { count: 1, type: 'CRD' } },
  },
  nab: {
    meter_reading: { command: 'meter_reading', description: 'What the meter is measuring, and the measurement, together.', scpi: 'FUNCtion?;:READ?',
      returns: { count: 2, separator: ';', fields: [{ name: 'function', type: 'CRD' }, { name: 'value', type: 'NR3' }] } },
  },
} };

test('one spelling per question, as gui_certificate.py query_key', () => {
  assert.equal(queryKey(':MEASure:VOLTage:DC?'), 'MEAS:VOLT:DC?');
  assert.equal(queryKey('MEAS:VOLT:DC?'), 'MEAS:VOLT:DC?');
  assert.equal(queryKey('PERiod:APERture?'), 'PER:APER?');
});

test('a stack is cut one answer per question; a relative part is left out', () => {
  assert.deepEqual(stackParts('FUNCtion?;:READ?', '"FRES";-6.89E-04').map(p => [p.key, p.said]), [['FUNC?', '"FRES"'], ['READ?', '-6.89E-04']]);
  assert.deepEqual(stackParts('MEAS:VOLT?;CURR?', '1;2').map(p => p.key), ['MEAS:VOLT?']);
  assert.deepEqual(stackParts('A?;B?', '1'), [], 'answers that do not line up prove nothing');
});

test('engineering prefixes, and a meter range that does not flick', () => {
  assert.equal(engineering(310352.8, 'Ω'), '310.35 kΩ');
  assert.equal(engineering(1.5529524, 'V'), '1.5530 V');
  assert.equal(engineering(0.0142776, 'V'), '14.278 mV');
  const d = stickyDecade(undefined, 9.8);
  assert.equal(d, 0);
  assert.equal(stickyDecade(d, 10.2), 1, 'off the scale: the next decade');
  assert.equal(stickyDecade(1, 9.8), 1, 'back under: the range holds');
});

test('every answered query is a named data point; a stack is one point per part', () => {
  const e = new Everything({ model: '34401A', sdk: sdkIndex(api) });
  e.hear({ command: 'MEASure:RESistance?', raw: '+3.10322910E+05', correlation_id: 'komand:refresh' }, 1000);
  e.hear({ command: 'MEASure:VOLTage:DC?', raw: '+1.55295240E+00', correlation_id: 'panel-live:x' }, 1001);
  e.hear({ command: 'FUNCtion?;:READ?', raw: '"FRES";-6.89E-04' }, 1002);
  e.hear({ command: 'SYST:REM', done: true }, 1003);
  e.hear({ command: 'MEAS:CURR:DC?', error: 'timeout' }, 1004);
  const pts = e.points();
  const by = (scpi) => pts.find(p => p.scpi === scpi);
  assert.equal(by('MEASure:RESistance?').label, 'MEASure Resistance', 'the SDK names it, not the SCPI');
  assert.equal(by('MEASure:VOLTage:DC?').unit, 'V');
  e.hear({ command: ':MEAS:CURR:DC?', raw: '+6.39E-08' }, 1005);
  assert.equal(e.points().find(p => p.scpi === 'MEAS:CURR:DC?').label, 'Measure DC Current', 'asked bare, an argument-taking command still names it');
  assert.equal(e.unitOf(by('READ?')), 'Ω', 'a READ is in the unit of the function the meter said it was in');
  assert.equal(by('FUNCtion?').raw, 'FRES');
  assert.equal(by('FUNCtion?').value, null, 'a word is not a number: a text tile');
  assert.equal(pts.length, 4, 'a set and an error prove no point');
  assert.ok(pts.findIndex(p => p.scpi === 'FUNCtion?') > pts.findIndex(p => p.scpi === 'READ?'), 'measured first, settings after');
  assert.equal(askerName(by('MEASure:VOLTage:DC?').asker), 'panel ask');
  assert.ok(e.fresh(by('READ?'), 1002 + 60000));
  assert.ok(!e.fresh(by('READ?'), 1002 + 5 * 60000 + 1), 'nothing unverified for 5 min is trusted');
});

test('the recorder seeds history from named readings and /Reply envelopes, never bare Write → Read pairs', () => {
  const e = new Everything({ model: '34401A', sdk: sdkIndex(api) });
  e.seed([
    { ts: 2, leaf: 'Reading/RoundRobin/RES', value: '{"value":310311.36,"unit":"Ω","command":":MEAS:RES?"}' },
    { ts: 1, leaf: 'Write', value: ':MEAS:VOLT:DC?' },
    { ts: 1.5, leaf: 'Read', value: '+4.5E+06' },
    { ts: 3, leaf: 'Reply', value: '{"command":"MEASure:VOLTage:DC?","raw":"+1.5","correlation_id":"komand:refresh"}' },
    { ts: 4, leaf: 'Reading/meter_reading/function', value: '{"value":"FRES"}' },
    { ts: 4, leaf: 'Reading/meter_reading/value', value: '{"value":"-6.89E-04"}' },
  ]);
  const rows = e.seriesRows().map(r => [r.point, r.value, r.unit]);
  assert.deepEqual(rows, [
    ['MEASure Resistance', 310311.36, 'Ω'],
    ['MEASure Voltage DC', 1.5, 'V'],
    ['What the meter is measuring, and the measurement, together. · value', -0.000689, 'Ω'],
  ], 'the unpaired Read (4.5 MV on the volts) is not believed; a stack\'s field is its part');
});

test('a colour per data point, from its identity, never its arrival', () => {
  assert.ok(TONES.includes(toneOf('34401A|MEASure_Resistance|0')));
  assert.equal(toneOf('34401A|MEASure_Resistance|0'), toneOf('34401A|MEASure_Resistance|0'));
});

test('log time is the house warp: now wide, the past compressed, and it inverts', () => {
  assert.equal(timeToFrac(100, 0, 100, true), 1);
  assert.ok(timeToFrac(50, 0, 100, true) < 0.5, 'half the span ago is packed into the left: now is wide');
  assert.ok(Math.abs(fracToTime(timeToFrac(37, 0, 100, true), 0, 100, true) - 37) < 1e-9);
  assert.equal(timeToFrac(25, 0, 100, false), 0.25);
});

test('a recorder NULL is a gap: the line breaks across it, and the meter rests offline', () => {
  const e = new Everything({ model: '34401A', sdk: sdkIndex(api) });
  e.seed([
    { ts: 2, leaf: 'Reply', value: '{"command":"MEASure:VOLTage:DC?","raw":"+1.5"}' },
    { ts: 2.5, leaf: 'Write', value: null },
    { ts: 3, leaf: 'Reading/RoundRobin/VOLT_DC', value: null },
    { ts: 5, leaf: 'Reply', value: '{"command":"MEASure:VOLTage:DC?","raw":"+1.6"}' },
  ]);
  const p = e.points()[0];
  assert.deepEqual(Everything.runs(p.history).map(r => r.map(h => h.v)), [[1.5], [1.6]], 'two runs: the NULL breaks the line');
  e.gap(9000);
  assert.equal(p.value, null, 'offline: no stale value');
  assert.ok(!e.fresh(p, 9001));
  e.hear({ command: 'MEASure:VOLTage:DC?', raw: '+1.7' }, 9500);
  assert.ok(e.fresh(p, 9600), 'the unit\'s next proven reply brings it back');
});

test('live: a named reading and its /Reply are one proof', () => {
  const e = new Everything({ model: '34401A', sdk: sdkIndex(api) });
  e.takeReading('Reading/MEASure_Voltage_DC', '{"ts":"2026-11-12T07:20:00.000Z","value":"+1.55"}', 0);
  const v = e.points()[0];
  assert.equal(v.value, 1.55);
  e.hear({ command: 'MEASure:VOLTage:DC?', raw: '+1.55', correlation_id: 'komand:refresh' }, Date.parse('2026-11-12T07:20:00.500Z'));
  assert.equal(v.history.length, 1, 'one answer, one point');
  assert.equal(v.asker, 'komand:refresh', 'and it says who asked');
  e.takeReading('Reading/MEASure_Voltage_DC', '{"value":null}', Date.parse('2026-11-12T07:21:00Z'));
  assert.equal(v.value, null, 'a NULL reading: offline');
});
