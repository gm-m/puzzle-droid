# Piano di miglioramento – UX e performance della libreria

Legenda: `[ ]` da fare · `[x]` fatto

## Fase 1 – Fix rapidi (alto impatto, basso rischio)

- [x] **1.1 Path asset tattiche famose relativo** – `fetch('/assets/pgn/...')` rompe con `--base-href /puzzle-droid/`; usare `assets/pgn/...`. (Il caricamento lazy è rimandato a 2.4: serve anche per la ripresa dalla dashboard Woodpecker.)
- [x] **1.2 Persistenza opzioni puzzle per collezione** – auto-prima mossa, auto-avanzamento, rotazione, Woodpecker, memoria visiva, Micro-Set vivono in `Map` del componente e si perdono a ogni cambio vista/riavvio.
- [x] **1.3 "Riprendi allenamento" rispetta il Micro-Set** – `onResumeItem` non passa `batchConfig`.
- [x] **1.4 Errore di quota visibile** – `persistLibraryItems` ignora silenziosamente i `QuotaExceededError`: l'utente crede di aver importato il file e lo perde al riavvio.
- [x] **1.5 Un solo layout per la lista partite** – tabella desktop e card mobile sono entrambe nel DOM (una nascosta via CSS); renderizzare solo quella attiva via `matchMedia`.
- [x] **1.6 Validazione Micro-Set** – "Da" > "A" consentito, "Da" senza max, clamp durante la digitazione.
- [x] **1.7 Conferma rimozione PGN con `app-dialog`** al posto di `window.confirm` (coerente con i bookmark, migliore su WebView Android).
- [ ] **1.8 Conferma eliminazione sessione Woodpecker con `app-dialog`** (usa ancora `window.confirm` in `test.ts`).

## Fase 2 – Parsing e memoria

- [x] **2.1 Parsing in un solo passaggio** – oggi ogni partita passa da `chess.js.loadPgn` 2-3 volte (+ replay). Usare `history({ verbose: true })` (`after` = FEN) e `getComments()` dalla stessa istanza. Benchmark sui 35 puzzle inclusi: ~780 ms → ~290 ms (desktop).
- [x] **2.2 Eliminare la crescita O(n²) di `uciHistory`** – ogni posizione copia tutta la storia; `onGameClick` ricopia tutto di nuovo.
- [x] **2.3 Persistenza su IndexedDB** – PGN raw fuori da `localStorage` (limite ~5 MB), metadati separati, niente riscrittura completa a ogni keystroke. Migrazione automatica dal vecchio `localStorage`, backup export/import aggiornati, stato di caricamento in libreria.
- [x] **2.4 Parsing lazy** – all'avvio solo header + conteggio mosse stimato (~0,7 ms per 35 partite vs ~290 ms); le mosse vengono analizzate al primo accesso alla partita.
- [ ] **2.5 Web Worker per l'import** – il parsing completo in fase di upload resta sul main thread.

## Fase 3 – Rendering della libreria

- [ ] **3.1 Signals + OnPush in `LibraryPanelComponent`** – `filteredGameEntries()`/`resultOptions()` ricalcolati a ogni change detection → `computed()` con indice di ricerca precalcolato.
- [ ] **3.2 Debounce della ricerca partite.**
- [ ] **3.3 Rendering incrementale** ("Mostra altre N") per collezioni grandi.

## Fase 4 – UX della libreria

- [ ] **4.1 Card semplificate** – una CTA primaria, azioni secondarie raggruppate, azioni distruttive solo nella vista di dettaglio.
- [ ] **4.2 Metadati aggregati nella card** (n. partite, progresso Woodpecker) invece di quelli della prima partita.
- [ ] **4.3 Rimuovere "Anteprima partite" inline** (duplica la vista di dettaglio).
- [ ] **4.4 Stato per puzzle nella lista** (risolto / sbagliato / mai tentato) dai dati Woodpecker.
- [ ] **4.5 Ricerca/ordinamento collezioni, rilevamento duplicati in import, risultati import chiudibili.**

## Fase 5 – Architettura

- [ ] **5.1 Estrarre `LibraryService`** da `test.ts` (parsing, persistenza, stato).
- [ ] **5.2 Lazy loading** di libreria/dashboard/impostazioni (`@defer`) per rientrare nel budget del bundle iniziale.
