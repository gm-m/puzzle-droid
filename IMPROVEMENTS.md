# Piano di miglioramento – UX e performance della libreria

Legenda: `[ ]` da fare · `[x]` fatto

## Fase 1 – Fix rapidi (alto impatto, basso rischio)

- [ ] **1.1 Path asset tattiche famose relativo** – `fetch('/assets/pgn/...')` rompe con `--base-href /puzzle-droid/`; usare `assets/pgn/...` e caricare solo all'apertura della libreria.
- [ ] **1.2 Persistenza opzioni puzzle per collezione** – auto-prima mossa, auto-avanzamento, rotazione, Woodpecker, memoria visiva, Micro-Set vivono in `Map` del componente e si perdono a ogni cambio vista/riavvio.
- [ ] **1.3 "Riprendi allenamento" rispetta il Micro-Set** – `onResumeItem` non passa `batchConfig`.
- [ ] **1.4 Errore di quota visibile** – `persistLibraryItems` ignora silenziosamente i `QuotaExceededError`: l'utente crede di aver importato il file e lo perde al riavvio.
- [ ] **1.5 Un solo layout per la lista partite** – tabella desktop e card mobile sono entrambe nel DOM (una nascosta via CSS); renderizzare solo quella attiva via `matchMedia`.
- [ ] **1.6 Validazione Micro-Set** – "Da" > "A" consentito, "Da" senza max, clamp durante la digitazione.
- [ ] **1.7 Conferma rimozione PGN con `app-dialog`** al posto di `window.confirm` (coerente con i bookmark, migliore su WebView Android).

## Fase 2 – Parsing e memoria

- [ ] **2.1 Parsing in un solo passaggio** – oggi ogni partita passa da `chess.js.loadPgn` 2-3 volte (+ replay). Usare `history({ verbose: true })` (`after` = FEN) e `getComments()` dalla stessa istanza.
- [ ] **2.2 Eliminare la crescita O(n²) di `uciHistory`** – ogni posizione copia tutta la storia; `onGameClick` ricopia tutto di nuovo.
- [ ] **2.3 Persistenza su IndexedDB** – PGN raw fuori da `localStorage` (limite ~5 MB), metadati separati, niente riscrittura completa a ogni keystroke.
- [ ] **2.4 Parsing lazy / Web Worker** – solo header all'avvio, mosse al primo accesso; parsing fuori dal main thread.

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
