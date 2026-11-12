// Questo modulo gestisce solo dati e date. L'interfaccia non dipende da localStorage:
// un futuro archivio cloud potrà esporre gli stessi metodi get() e save().
export const MOODS = [
  { id: 'male', emoji: '😞', label: 'Male' },
  { id: 'cosi-cosi', emoji: '😕', label: 'Così così' },
  { id: 'normale', emoji: '😐', label: 'Normale' },
  { id: 'bene', emoji: '🙂', label: 'Bene' },
  { id: 'benissimo', emoji: '🥰', label: 'Benissimo' }
];

export const STORAGE_KEY = 'respira-mood-diary-v1';

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dateFromKey(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [year, month, day] = key.split('-').map(Number);
  // Mezzogiorno locale evita anche i cambi d'ora legale a mezzanotte.
  const date = new Date(year, month - 1, day, 12);
  return localDateKey(date) === key ? date : null;
}

export function monthDays(year, month) {
  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() + 6) % 7; // Lunedì è la prima colonna.
  const count = new Date(year, month + 1, 0, 12).getDate();
  return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => localDateKey(new Date(year, month, i + 1, 12)))];
}

export function createMoodStore(storageProvider = () => window.localStorage) {
  let entries = {};
  let storage;
  let error = '';
  try {
    storage = storageProvider();
    const raw = storage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const document = JSON.parse(raw);
      if (document?.version !== 1 || !document.entries || typeof document.entries !== 'object' || Array.isArray(document.entries)) {
        throw new Error('Formato non valido');
      }
      for (const [key, entry] of Object.entries(document.entries)) {
        if (!dateFromKey(key) || entry?.date !== key || !MOODS.some(mood => mood.id === entry.moodId)
          || typeof entry.note !== 'string' || typeof entry.createdAt !== 'string' || typeof entry.updatedAt !== 'string') {
          throw new Error('Registrazione non valida');
        }
      }
      entries = document.entries;
    }
  } catch {
    // Non sovrascrivere un archivio danneggiato o non leggibile.
    error = 'Non riesco a leggere il diario su questo dispositivo. I dati esistenti non sono stati modificati; il salvataggio è sospeso.';
  }

  return {
    get error() { return error; },
    get(date) { return entries[date] ? { ...entries[date] } : null; },
    save(date, moodId, note = '') {
      if (error) throw new Error(error);
      if (!dateFromKey(date) || date > localDateKey() || !MOODS.some(mood => mood.id === moodId) || typeof note !== 'string') {
        throw new Error('Scegli una data passata o quella di oggi e un’emozione.');
      }
      const timestamp = new Date().toISOString(); // UTC soltanto per i timestamp, mai per la giornata.
      const entry = { date, moodId, note, createdAt: entries[date]?.createdAt || timestamp, updatedAt: timestamp };
      const next = { ...entries, [date]: entry };
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries: next }));
      } catch {
        throw new Error('Non riesco a salvare sul dispositivo. La tua bozza resta qui: riprova senza chiudere l’app.');
      }
      entries = next; // Lo stato cambia solo dopo una scrittura riuscita.
      return { ...entry };
    }
  };
}
