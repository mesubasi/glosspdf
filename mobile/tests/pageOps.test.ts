// Çalıştır: node --test mobile/tests/pageOps.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  deleteSelected,
  initialItems,
  insertBlank,
  isChanged,
  moveItem,
  moveSelected,
  rotateSelected
} from '../src/lib/pageOps.ts';

const sources = (items: { source: number }[]) => items.map((i) => i.source);

test('moveItem moves forward and backward', () => {
  const items = initialItems(5);
  assert.deepEqual(sources(moveItem(items, 0, 3)), [2, 3, 4, 1, 5]);
  assert.deepEqual(sources(moveItem(items, 4, 1)), [1, 5, 2, 3, 4]);
  assert.equal(moveItem(items, 2, 9), items);
});

test('moveSelected shifts blocks and stops at edges', () => {
  const items = initialItems(6);
  const sel = new Set([items[0].key, items[2].key, items[3].key]); // 1, 3, 4
  assert.deepEqual(sources(moveSelected(items, sel, -1)), [1, 3, 4, 2, 5, 6]);
  assert.deepEqual(sources(moveSelected(items, sel, 1)), [2, 1, 5, 3, 4, 6]);
});

test('rotateSelected wraps at 360', () => {
  let items = initialItems(2);
  const sel = new Set([items[1].key]);
  for (let i = 0; i < 4; i++) items = rotateSelected(items, sel);
  assert.deepEqual(items.map((i) => i.rotation), [0, 0]);
  assert.equal(rotateSelected(items, sel)[1].rotation, 90);
});

test('deleteSelected refuses to empty the document', () => {
  const items = initialItems(3);
  assert.equal(deleteSelected(items, new Set(items.map((i) => i.key))), null);
  assert.deepEqual(sources(deleteSelected(items, new Set([items[1].key]))!), [1, 3]);
});

test('insertBlank goes after the last selected page, else at the end', () => {
  const items = initialItems(3);
  assert.deepEqual(sources(insertBlank(items, new Set([items[0].key]), [595, 842])), [1, 0, 2, 3]);
  assert.deepEqual(sources(insertBlank(items, new Set(), [595, 842])), [1, 2, 3, 0]);
});

test('isChanged detects order, rotation and count', () => {
  const items = initialItems(3);
  assert.equal(isChanged(items, 3), false);
  assert.equal(isChanged(moveItem(items, 0, 1), 3), true);
  assert.equal(isChanged(rotateSelected(items, new Set([items[0].key])), 3), true);
  assert.equal(isChanged(items, 4), true);
});
