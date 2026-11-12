// Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
// MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.

// The header device picker that replaced the cloud of device tabs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deviceOptions, wantFor } from '../js/devicePanel.js';

const tab = (d, extra = {}) => [d.key, { d, want: wantFor(d), fresh: false, saved: null, ...extra }];
const tabs = new Map([
  tab({ key: 'usb:BGA5b2A8J14', model: '34401A', name: 'HP 34401A' }),
  tab({ key: 'mac:00:30:d3:05:70:7e', model: 'E5810', name: 'Agilent E5810' }, { gone: true }),
  tab({ key: 'TCPIP0/44.44.44.222', model: '6060B' }, { fresh: true }),
]);

test('one option per device, labelled as its tab was, online and offline marked', () => {
  const { options, selected } = deviceOptions(tabs, 'usb:BGA5b2A8J14');
  assert.equal(selected, 'usb:BGA5b2A8J14');
  assert.deepEqual(options.map(o => o.label), [
    '● 34401A usb:BGA5b2A8J14',
    '○ E5810 mac:00:30:d3:05:70:7e · offline',
    '● 6060B',
  ]);
  assert.equal(options[1].gone, true);
  assert.equal(options[0].title, 'HP 34401A · online');
  assert.deepEqual(options.filter(o => o.fresh).map(o => o.value), ['TCPIP0/44.44.44.222']);
});

test('the open device is never flagged fresh', () => {
  const { options } = deviceOptions(tabs, 'TCPIP0/44.44.44.222');
  assert.equal(options.some(o => o.fresh), false);
});

test('with no device open the picker leads with a blank choose option', () => {
  const { options, selected } = deviceOptions(tabs, '');
  assert.equal(selected, '');
  assert.equal(options[0].value, '');
  assert.match(options[0].label, /Choose a device \(3\)/);
  assert.equal(options.length, 4);
});

test('no tabs, no options', () => {
  assert.deepEqual(deviceOptions(new Map(), ''), { options: [], selected: '' });
  assert.deepEqual(deviceOptions(undefined), { options: [], selected: '' });
});
