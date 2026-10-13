import assert from 'node:assert/strict';
import test from 'node:test';
import { patchSearch } from '../src/hooks/useHistoryParam.ts';

test('opening a view adds its key and keeps the others', () => {
  assert.equal(patchSearch('?firm=apex', { playbook: 'orb' }), 'firm=apex&playbook=orb');
});

test('closing a view removes only its key', () => {
  assert.equal(patchSearch('?playbook=orb&section=toolkit', { playbook: null }), 'section=toolkit');
  assert.equal(patchSearch('?playbook=orb', { playbook: null }), '');
});

test('key order does not make two equal URLs look different', () => {
  assert.equal(patchSearch('?b=2&a=1', {}), patchSearch('?a=1&b=2', {}));
});
