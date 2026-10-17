import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tr } from '../src/locales/tr.ts';
import { en } from '../src/locales/en.ts';
import { de } from '../src/locales/de.ts';
import { fr } from '../src/locales/fr.ts';
import { es } from '../src/locales/es.ts';
import { ar } from '../src/locales/ar.ts';
import { zh } from '../src/locales/zh.ts';

const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');

test('every locale has the same keys and placeholders as tr', () => {
  for (const [code, dict] of Object.entries({ en, de, fr, es, ar, zh })) {
    assert.deepEqual(Object.keys(dict).sort(), Object.keys(tr).sort(), `${code} keys`);
    for (const [key, text] of Object.entries(tr)) {
      const other = (dict as Record<string, string>)[key];
      assert.ok(other.trim(), `${code}.${key} is empty`);
      assert.equal(placeholders(other), placeholders(text), `${code}.${key} placeholders`);
    }
  }
});
