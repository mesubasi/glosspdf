// Çalıştır: node --test mobile/tests/search.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findInRuns, type TextRun } from '../src/annot/textRuns.ts';

// Yazı boyu 10, karakter genişliği 5
const run = (str: string, x: number, y: number): TextRun => ({
  str,
  start: { x, y },
  end: { x: x + str.length * 5, y },
  up: { x: 0, y: -10 }
});
const runs = [run('Sözleşme süresi', 0, 20), run('SÖZLEŞME eki', 0, 40)];

test('finds every case-insensitive match with its box', () => {
  const hits = findInRuns(runs, 'sözleşme', 'tr');
  assert.equal(hits.length, 2);
  const [x, , w] = hits[0][0];
  assert.equal(x, 0);
  assert.equal(w, 40);
  assert.equal(hits[1][0][0], 0, 'second line match starts at the run start');
});

test('finds repeated matches inside one run and ignores empty queries', () => {
  assert.equal(findInRuns([run('ana ana ana', 0, 10)], 'ana').length, 3);
  assert.equal(findInRuns(runs, '').length, 0);
  assert.equal(findInRuns(runs, 'yok').length, 0);
});
