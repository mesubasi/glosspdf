// Çalıştır: node --test mobile/tests/ranges.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expandRanges, parseRanges } from '../src/lib/ranges.ts';

test('parseRanges accepts singles, ranges and spaces', () => {
  assert.deepEqual(parseRanges('1-3, 5 ,7-9', 10), [
    { start: 1, end: 3 },
    { start: 5, end: 5 },
    { start: 7, end: 9 }
  ]);
});

test('parseRanges rejects bad input', () => {
  for (const bad of ['', ',', '1,', 'a', '0', '3-2', '1-11', '1--2', '-3', '1 2']) {
    assert.equal(parseRanges(bad, 10), null, `should reject "${bad}"`);
  }
});

test('expandRanges flattens in order', () => {
  assert.deepEqual(expandRanges([{ start: 2, end: 4 }, { start: 1, end: 1 }]), [2, 3, 4, 1]);
});
