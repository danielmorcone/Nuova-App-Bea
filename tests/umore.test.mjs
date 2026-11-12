// Esegui con: node --test tests/umore.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const code = await readFile(new URL('../assets/js/modules/mood-store.js', import.meta.url), 'utf8');
const { createMoodStore, monthDays, dateFromKey, localDateKey, STORAGE_KEY } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const memory = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};
test('Calendario: lunedì iniziale, bisestili, mesi di 28/29/30/31 giorni', () => {
  assert.equal(monthDays(2024, 0)[0], '2024-01-01');
  for (const [year, month, count] of [[2024, 1, 29], [2025, 1, 28], [2026, 3, 30], [2026, 0, 31], [2000, 1, 29], [1900, 1, 28]]) {
    assert.equal(monthDays(year, month).filter(Boolean).length, count);
  }
});
test('Date locali: invalidi rifiutati, cambio anno e ora legale', () => {
  assert.equal(dateFromKey('2025-02-29'), null);
  assert.equal(dateFromKey('2026-13-01'), null);
  assert.equal(localDateKey(new Date(2025, 11, 31, 23, 59)), '2025-12-31');
  assert.equal(localDateKey(new Date(2026, 0, 1, 0, 1)), '2026-01-01');
  assert.equal(localDateKey(new Date(2026, 2, 29, 0, 1)), '2026-03-29');
});
test('Salvataggio senza nota e persistenza in una nuova istanza', () => {
  const storage = memory();
  createMoodStore(() => storage).save('2020-02-29', 'bene');
  assert.equal(createMoodStore(() => storage).get('2020-02-29').note, '');
});
test('Modifica: una sola registrazione, creazione mantenuta, nota multilinea e testo letterale', () => {
  const storage = memory();
  const store = createMoodStore(() => storage);
  const before = store.save('2020-01-01', 'bene', 'Prima nota');
  const note = '<script>non eseguire</script>\nSeconda riga ♡ ' + 'a'.repeat(10000);
  store.save('2020-01-01', 'normale', note);
  const after = createMoodStore(() => storage).get('2020-01-01');
  assert.equal(after.moodId, 'normale');
  assert.equal(after.note, note);
  assert.equal(after.createdAt, before.createdAt);
  assert.equal(Object.keys(JSON.parse(storage.getItem(STORAGE_KEY)).entries).length, 1);
});
test('Vietati futuro ed emozioni mancanti', () => {
  const store = createMoodStore(memory);
  assert.throws(() => store.save('2999-01-01', 'bene'));
  assert.throws(() => store.save('2020-01-01', ''));
});
test('JSON corrotto o struttura invalida: non sovrascrivere i dati', () => {
  for (const value of ['{rotto', '{"version":2,"entries":{}}', '{"version":1,"entries":{"2020-01-01":{}}}']) {
    const storage = memory();
    storage.setItem(STORAGE_KEY, value);
    const store = createMoodStore(() => storage);
    assert.ok(store.error);
    assert.throws(() => store.save('2020-01-01', 'bene'));
    assert.equal(storage.getItem(STORAGE_KEY), value);
  }
});
test('Storage bloccato o pieno: errore gestito senza falso salvataggio', () => {
  assert.ok(createMoodStore(() => { throw new Error('Bloccato'); }).error);
  const store = createMoodStore(() => ({ getItem: () => null, setItem: () => { throw new Error('Pieno'); } }));
  assert.throws(() => store.save('2020-01-01', 'bene'));
  assert.equal(store.get('2020-01-01'), null);
});
