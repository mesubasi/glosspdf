// Çalıştır: node --test mobile/tests/textRuns.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { locate, spanRects, type TextRun } from '../src/annot/textRuns.ts';

// İki satır, ikinci satır iki parçalı. Yazı boyu 10, karakter genişliği 5.
const run = (str: string, x: number, y: number): TextRun => ({
  str,
  start: { x, y },
  end: { x: x + str.length * 5, y },
  up: { x: 0, y: -10 }
});
const runs = [run('Hello world', 0, 20), run('second', 0, 40), run('line', 35, 40)];

test('locate finds run and nearest char boundary', () => {
  assert.deepEqual(locate(runs, { x: 12, y: 15 }), { run: 0, k: 2 });
  assert.deepEqual(locate(runs, { x: 50, y: 37 }), { run: 2, k: 3 });
  assert.equal(locate(runs, { x: 300, y: 300 }), null);
});

test('spanRects covers a partial range on one line', () => {
  const { rects, text } = spanRects(runs, { run: 0, k: 6 }, { run: 0, k: 11 });
  assert.equal(text, 'world');
  assert.equal(rects.length, 1);
  const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);
  const [x, y, w, h] = rects[0];
  near(x, 30);
  near(w, 25);
  near(y, 10.5);
  near(h, 12);
});

test('spanRects spans lines, merges same-line runs and accepts reversed ends', () => {
  const { rects, text } = spanRects(runs, { run: 2, k: 4 }, { run: 0, k: 6 });
  assert.equal(text, 'world second line');
  assert.equal(rects.length, 2, 'line 2 runs merge into one box');
  assert.equal(rects[1][0], 0);
  assert.equal(rects[1][2], 55);
});

test('a tap selects the word under the finger', () => {
  assert.equal(spanRects(runs, { run: 0, k: 8 }, { run: 0, k: 8 }).text, 'world');
  assert.equal(spanRects(runs, { run: 0, k: 5 }, { run: 0, k: 5 }).text, 'Hello');
});
