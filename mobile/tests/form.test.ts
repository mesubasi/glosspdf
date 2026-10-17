// Çalıştır: node --test mobile/tests/form.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseWidgets } from '../src/lib/form.ts';
import { imagePlacement } from '../src/lib/imagePage.ts';

const rect = (): [number, number, number, number] => [0, 0, 0.5, 0.1];

test('parseWidgets reads text, checkbox, radio and choice fields', () => {
  const fields = parseWidgets(
    [
      { subtype: 'Widget', fieldType: 'Tx', fieldName: 'name', fieldValue: 'Ada', rect: [0, 0, 1, 1], maxLen: 20 },
      { subtype: 'Widget', fieldType: 'Btn', checkBox: true, fieldName: 'agree', fieldValue: 'Off', rect: [0, 0, 1, 1] },
      { subtype: 'Widget', fieldType: 'Btn', radioButton: true, buttonValue: 'b', fieldName: 'pick', fieldValue: 'b', rect: [0, 0, 1, 1] },
      {
        subtype: 'Widget',
        fieldType: 'Ch',
        fieldName: 'city',
        fieldValue: ['ank'],
        options: [
          { exportValue: 'ist', displayValue: 'İstanbul' },
          { exportValue: 'ank', displayValue: 'Ankara' }
        ],
        rect: [0, 0, 1, 1]
      }
    ],
    rect
  );
  assert.deepEqual(
    fields.map((f) => [f.kind, f.name, f.value]),
    [
      ['text', 'name', 'Ada'],
      ['check', 'agree', false],
      ['radio', 'pick', 'b'],
      ['choice', 'city', 'Ankara']
    ]
  );
  assert.equal(fields[0].kind === 'text' && fields[0].maxLen, 20);
});

test('parseWidgets skips hidden, push button, signature and non-widget annotations', () => {
  const fields = parseWidgets(
    [
      { subtype: 'Widget', fieldType: 'Tx', fieldName: 'hidden', annotationFlags: 2, rect: [0, 0, 1, 1] },
      { subtype: 'Widget', fieldType: 'Btn', pushButton: true, fieldName: 'submit', rect: [0, 0, 1, 1] },
      { subtype: 'Widget', fieldType: 'Sig', fieldName: 'sig', rect: [0, 0, 1, 1] },
      { subtype: 'Text', fieldName: 'note', rect: [0, 0, 1, 1] }
    ],
    rect
  );
  assert.equal(fields.length, 0);
});

test('imagePlacement centers photos on an A4 page in their own orientation', () => {
  const portrait = imagePlacement(1000, 2000, 'a4');
  assert.deepEqual(portrait.page, [595.28, 841.89]);
  assert.ok(Math.abs(portrait.y - 24) < 1e-9 && portrait.x > 24);

  const landscape = imagePlacement(2000, 1000, 'a4');
  assert.deepEqual(landscape.page, [841.89, 595.28]);
  assert.ok(Math.abs(landscape.w / landscape.h - 2) < 1e-9);

  const fit = imagePlacement(1500, 1000, 'fit');
  assert.deepEqual([fit.x, fit.y, fit.w, fit.h], [0, 0, fit.page[0], fit.page[1]]);
});
