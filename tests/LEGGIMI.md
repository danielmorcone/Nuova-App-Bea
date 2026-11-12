# Prove della sezione Umore

Avvia il progetto con `Avvia-App-Bea.bat`, quindi apri la scheda Umore dalla navbar.
La versione della cache PWA è indicata in `sw.js`. Le prove automatiche non aggiungono dipendenze.

## Modifiche grafiche dal vivo

Usa il server `Avvia-App-Bea.bat`. Al primo utilizzo del live reload, ricarica una volta
la pagina per caricare il nuovo client di sviluppo. Dopo Ctrl+S, i CSS si aggiornano
entro circa un secondo senza ricaricare la pagina: scheda, scroll e campi compilati restano aperti.
HTML e JavaScript provocano invece un ricaricamento; le modifiche non salvate nei moduli
possono quindi andare perse. L'aggiornamento automatico funziona anche sul telefono
collegato al server locale, ma non aprendo gli HTML direttamente con doppio clic.
Se vuoi aggiornare appena smetti di scrivere, abilita il salvataggio automatico nell'editor.

## Test automatici

`node --test tests/umore.test.mjs`

Verifica calendario, date locali, bisestili, persistenza tra istanze, modifica della stessa
registrazione, note lunghe/multilinea, dati danneggiati e storage non disponibile.

Con il server sulla porta 8000 e Chrome installato nel percorso standard di Windows:

`node tests/run-mood-browser.cjs`

Avvia Chrome headless con un profilo temporaneo isolato. La pagina di prova
`umore-browser.html` esegue salvataggio, modifica, selezione dei giorni, mesi, bozze,
ricaricamento e misure responsive. Il runner verifica anche il ricaricamento offline,
il movimento ridotto e l'avvio essenziale degli esercizi esistenti.
Lo screenshot viene scritto nella cartella temporanea di Windows.
I profili temporanei non contengono i dati del browser personale.

Non aprire direttamente la pagina di test dal tuo browser abituale: scrive registrazioni
dimostrative. Usa il runner che crea il profilo separato.

## Controlli ancora da fare su iPhone

- Aprire Umore dalla navbar e con lo swipe; scorrere fino al pulsante di salvataggio.
- Scrivere una nota lunga, chiudere la tastiera e controllare navbar e safe area.
- Salvare oggi e una giornata passata, modificare entrambe e riaprire la PWA.
- Provare il diario offline dopo un primo caricamento completo della PWA tramite HTTPS.
- Controllare il layout con testo ingrandito e la navigazione con VoiceOver.

## Dove rimangono le giornate

Il diario è salvato in localStorage, sotto la chiave `respira-mood-diary-v1`.
Le registrazioni salvate sopravvivono al ricaricamento e alla chiusura del browser,
finché il browser conserva i dati del sito. Le bozze non salvate restano solo in memoria.
Un indirizzo o una porta differenti hanno un archivio locale separato: per ritrovare il diario,
usa sempre lo stesso indirizzo dell'app. Non è ancora presente un backup cloud.

Punto di ripristino Git precedente all'implementazione: `ripristino-prima-umore-20261111`.
