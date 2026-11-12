import { MOODS, createMoodStore, localDateKey, dateFromKey, monthDays } from './mood-store.js';

export function setupMoodDiary() {
  const screen = document.querySelector('#umore-screen');
  if (!screen) return;
  const calendar = screen.querySelector('#mood-days');
  const monthTitle = screen.querySelector('#mood-month');
  const monthLabel = monthTitle.querySelector('.mood-month-label');
  const panel = screen.querySelector('#mood-panel');
  const feedback = screen.querySelector('#mood-feedback');
  const storageError = screen.querySelector('#mood-storage-error');
  const nextButton = screen.querySelector('#mood-next');
  const store = createMoodStore();
  const drafts = new Map(); // Ogni bozza rimane legata alla propria data anche cambiando mese.
  let feedbackTimer;
  let selected = localDateKey();
  let displayedMonth = dateFromKey(selected);
  const monthFormat = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });
  const dayFormat = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function animate(node, className) {
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
  }

  function showError(message) {
    storageError.textContent = message;
    storageError.hidden = !message;
  }

  function showFeedback(message, autoHide = false) {
    window.clearTimeout(feedbackTimer);
    feedback.classList.remove('is-fading-out');
    feedback.textContent = message;
    if (!autoHide) return;
    feedbackTimer = window.setTimeout(() => {
      feedback.classList.add('is-fading-out');
      feedbackTimer = window.setTimeout(() => {
        feedback.textContent = '';
        feedback.classList.remove('is-fading-out');
      }, 700);
    }, 2000);
  }

  function updateCalendarCell(button, key) {
    const date = dateFromKey(key);
    const record = drafts.get(key) || store.get(key);
    const mood = MOODS.find(item => item.id === record?.moodId);
    button.textContent = mood?.emoji || String(date.getDate());
    button.classList.toggle('has-mood', Boolean(mood));
    button.setAttribute('aria-label', `${dayFormat.format(date)}, ${mood ? mood.label : 'nessuna emozione selezionata'}${key === localDateKey() ? ', oggi' : ''}`);
  }

  function renderCalendar() {
    const today = localDateKey();
    monthLabel.textContent = monthFormat.format(displayedMonth);
    nextButton.disabled = displayedMonth.getFullYear() === new Date().getFullYear()
      && displayedMonth.getMonth() === new Date().getMonth();
    const fragment = document.createDocumentFragment();
    monthDays(displayedMonth.getFullYear(), displayedMonth.getMonth()).forEach(key => {
      if (!key) {
        fragment.append(element('div', 'mood-day-empty'));
        return;
      }
      const button = element('button', 'mood-day');
      button.type = 'button';
      button.dataset.date = key;
      button.disabled = key > today;
      button.classList.toggle('is-selected', key === selected);
      button.setAttribute('aria-pressed', String(key === selected));
      updateCalendarCell(button, key);
      if (key === today) button.setAttribute('aria-current', 'date');
      fragment.append(button);
    });
    calendar.replaceChildren(fragment);
  }

  function renderPanel() {
    panel.replaceChildren();
    const record = store.get(selected);
    const draft = drafts.get(selected);
    panel.classList.toggle('is-reading', Boolean(record && !draft));
    if (record && !draft) {
      panel.append(element('p', 'mood-date', dayFormat.format(dateFromKey(selected))));
      const mood = MOODS.find(item => item.id === record.moodId);
      const face = element('div', 'mood-saved-face', mood.emoji);
      face.setAttribute('aria-hidden', 'true');
      panel.append(face, element('h2', 'mood-panel-title', mood.label));
      if (record.note) panel.append(element('p', 'mood-saved-note', record.note));
      const edit = element('button', 'mood-button mood-button--secondary');
      const pencil = element('i', 'bi bi-pencil-fill');
      pencil.setAttribute('aria-hidden', 'true');
      edit.append(pencil, document.createTextNode('Modifica la giornata'));
      edit.type = 'button';
      edit.addEventListener('click', () => {
        drafts.set(selected, { moodId: record.moodId, note: record.note });
        renderPanel();
        panel.querySelector('[aria-pressed="true"]')?.focus({ preventScroll: true });
      });
      panel.append(edit);
    } else {
      renderForm(draft || { moodId: '', note: '' }, Boolean(record));
    }
    animate(panel, 'mood-panel-enter');
  }

  function renderForm(draft, isEditing) {
    const formDate = selected; // Le chiusure salvano sempre la giornata del modulo originale.
    panel.append(element('h2', 'mood-panel-title', formDate === localDateKey() ? 'Come ti senti oggi?' : 'Come ti sentivi quel giorno?'));
    panel.append(element('p', 'mood-date', dayFormat.format(dateFromKey(formDate))));
    const form = element('form', 'mood-form');
    const fieldset = element('fieldset', 'mood-options');
    const legend = element('legend', 'mood-sr-only', 'Scegli un’emozione');
    fieldset.append(legend);
    const save = element('button', 'mood-button', isEditing ? 'Salva modifiche' : 'Salva la giornata');
    save.type = 'submit';
    save.disabled = !draft.moodId || Boolean(store.error);
    const choices = [];
    MOODS.forEach(mood => {
      const choice = element('button', 'mood-option');
      choice.type = 'button';
      choice.setAttribute('aria-pressed', String(draft.moodId === mood.id));
      const emoji = element('span', 'mood-option__emoji', mood.emoji);
      emoji.setAttribute('aria-hidden', 'true');
      choice.append(emoji, element('span', 'mood-option__label', mood.label));
      choice.addEventListener('click', () => {
        const isSelected = draft.moodId !== mood.id;
        draft.moodId = isSelected ? mood.id : '';
        drafts.set(formDate, draft);
        choices.forEach(button => button.setAttribute('aria-pressed', String(isSelected && button === choice)));
        save.disabled = !draft.moodId || Boolean(store.error);
        const cell = calendar.querySelector(`[data-date="${formDate}"]`);
        if (cell) updateCalendarCell(cell, formDate);
        if (isSelected) animate(emoji, 'mood-emoji-selected');
        else emoji.classList.remove('mood-emoji-selected');
      });
      choices.push(choice);
      fieldset.append(choice);
    });
    const label = element('label', 'mood-note-label', 'Vuoi raccontare qualcosa?');
    label.htmlFor = 'mood-note';
    const note = element('textarea', 'mood-note');
    note.id = 'mood-note';
    note.rows = 4;
    note.placeholder = 'Scrivi qui i tuoi pensieri...';
    note.value = draft.note;
    note.addEventListener('input', () => {
      draft.note = note.value;
      drafts.set(formDate, draft);
    });
    form.append(fieldset, label, note, save);
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (selected !== formDate || !draft.moodId) return;
      try {
        store.save(formDate, draft.moodId, draft.note);
        drafts.delete(formDate);
        showError('');
        showFeedback(isEditing ? 'Modifiche salvate!' : 'La tua giornata è salvata ♡', isEditing);
        renderPanel();
        // Aggiorna soltanto la cella: il calendario resta al suo posto.
        const cell = calendar.querySelector(`[data-date="${formDate}"]`);
        if (cell) {
          updateCalendarCell(cell, formDate);
          animate(cell, 'mood-emoji-selected');
        }
        animate(panel, 'mood-save-confirmed');
        panel.querySelector('button')?.focus({ preventScroll: true });
      } catch (error) {
        showError(error.message);
      }
    });
    panel.append(form);
  }

  calendar.addEventListener('click', event => {
    const day = event.target.closest('button[data-date]');
    if (!day || day.disabled || day.dataset.date === selected) return;
    selected = day.dataset.date;
    calendar.querySelectorAll('button').forEach(button => {
      button.classList.toggle('is-selected', button === day);
      button.setAttribute('aria-pressed', String(button === day));
    });
    showFeedback('');
    renderPanel();
  });

  function changeMonth(direction) {
    const next = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + direction, 1, 12);
    const today = new Date();
    if (next > new Date(today.getFullYear(), today.getMonth(), 1, 12) || next.getFullYear() < 1900) return;
    const oldDay = dateFromKey(selected).getDate();
    const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0, 12).getDate();
    displayedMonth = next;
    selected = localDateKey(new Date(next.getFullYear(), next.getMonth(), Math.min(oldDay, maxDay), 12));
    if (selected > localDateKey()) selected = localDateKey();
    showFeedback('');
    renderCalendar();
    renderPanel();
    animate(calendar, 'mood-month-enter');
  }

  screen.querySelector('#mood-prev').addEventListener('click', () => changeMonth(-1));
  nextButton.addEventListener('click', () => changeMonth(1));
  showError(store.error);
  renderCalendar();
  renderPanel();
}
