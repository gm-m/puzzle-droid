# Piano operativo UI/UX — Puzzle Droid

## Obiettivo

Rendere Puzzle Droid più moderna, professionale, coerente e accessibile senza modificare la logica di analisi, i flussi puzzle e Woodpecker, i dati persistiti, i formati di backup o le route pubbliche.

## Stato di avanzamento

Ultimo aggiornamento: 30 agosto 2026.

Legenda:

- `[x]` attività completata;
- `[ ]` attività da completare;
- le attività parzialmente avviate restano non selezionate e riportano quanto già realizzato.

### Fase 0 — Analisi e baseline

- [x] Analizzare architettura, schermate, componenti e flussi UX esistenti.
- [x] Individuare criticità visive, responsive e di accessibilità.
- [x] Verificare la baseline con build, unit test ed E2E esistenti.
- [x] Allineare le suite unit test alla configurazione Angular zoneless reale.
- [ ] Creare la matrice visuale completa a 360, 390, 768, 1024 e 1440 px.
- [ ] Aggiungere fixture deterministiche dedicate a PGN, puzzle e dashboard Woodpecker.

### Fase 1 — Fondazioni visive e accessibilità globale

- [x] Introdurre token globali per palette, superfici, testo, stati semantici, spaziature, radius, ombre e motion.
- [x] Definire varianti light e dark dei nuovi token.
- [x] Introdurre focus ring globale coerente.
- [x] Aggiungere il supporto a `prefers-reduced-motion`.
- [x] Impostare lingua italiana, titolo applicazione, meta description, theme color e viewport con safe area.
- [x] Aggiungere skip link e destinazione focusabile per il contenuto principale.
- [x] Rendere gli input file PGN e backup raggiungibili da tastiera.
- [ ] Completare la migrazione di tutti i colori hard-coded ai token.
- [ ] Rimuovere gli override dark mode di compatibilità e gli `!important` residui.
- [ ] Uniformare completamente button, input, select, textarea, checkbox, switch, badge e card.

### Fase 2 — Shell e navigazione

- [x] Realizzare una prima revisione visuale della sidebar con identità Puzzle Droid.
- [x] Rendere lo stato della voce attiva riconoscibile anche tramite `aria-current`, bordo e superficie.
- [x] Aggiungere `aria-expanded` e `aria-controls` al trigger mobile.
- [x] Permettere la chiusura di menu e selettore partite tramite Escape.
- [x] Escludere il selettore partite chiuso dalla navigazione tramite `inert` e `aria-hidden`.
- [x] Completare focus trap e ripristino del focus per drawer e pannelli modali.
- [x] Sostituire il glifo del menu con il componente SVG definitivo.
- [x] Integrare la dashboard nello stesso linguaggio visuale e navigazionale della shell.

### Fase 3 — Analisi e Puzzle

- [x] Aggiungere gli stili base mancanti per stato puzzle, progresso e dialog informativo Woodpecker.
- [x] Aggiungere una superficie coerente alle impostazioni engine.
- [x] Tradurre i principali testi engine in italiano.
- [x] Esporre stato engine, messaggi puzzle e feedback FEN/PGN tramite live region appropriate.
- [x] Aggiungere stato espanso e associazioni accessibili a varianti engine, impostazioni e quick menu.
- [x] Aumentare l'area interattiva dei principali controlli compatti.
- [x] Eliminare le tre istanze responsive di `AnalysisPanelComponent`.
- [x] Separare semanticamente e visualmente area engine, board, stato puzzle e cronologia mosse.
- [x] Mostrare badge e loading indicator dell'engine senza aprire le impostazioni.
- [x] Rendere visibile il pulsante per aprire l'elenco partite, mantenendo la gesture come scorciatoia.
- [x] Spostare il salvataggio bookmark tra le azioni della posizione.
- [x] Implementare dialog accessibili con focus iniziale, focus trap e ritorno del focus.
- [x] Sostituire emoji e glifi con icone SVG coerenti.
- [x] Stabilizzare la toolbar puzzle durante auto-mosse e transizioni di stato con azioni icon-only accessibili.
- [x] Estendere la navigazione cronologia a tutta larghezza con controlli compatti raggruppati ai lati e compattare `Elenco partite` su mobile.
- [x] Centralizzare su mobile titolo partita, indicatore compatto del tratto ed elenco partite nel topbar, evitando duplicazioni nel pannello Analisi.
- [x] Aggiungere la modalità memoria visiva con osservazione numerica configurabile (default 2 secondi), pezzi nascosti interattivi, risposta comunicata tramite SAN, riapparizione opzionale e rivelazione registrata come assistenza.

### Fase 4 — Libreria e avvio allenamento

- [x] Rendere il selettore della vista libreria un gruppo di pulsanti con stato `aria-pressed`.
- [x] Aggiungere caption e scope alla tabella delle partite.
- [x] Aggiungere un controllo da tastiera esplicito per aprire ogni partita della tabella.
- [x] Migliorare focus e stati del pulsante di upload PGN.
- [x] Riorganizzare le card PGN distinguendo azioni primarie, secondarie e distruttive.
- [x] Rendere `Riprendi` la CTA dominante quando è disponibile una sessione.
- [x] Applicare progressive disclosure alle opzioni puzzle, Woodpecker e Micro-Set.
- [x] Mantenere una ricerca principale e spostare gli altri criteri nei filtri avanzati.
- [x] Aggiungere stato occupato, esito per file ed errori di parsing all'upload PGN.
- [x] Ridisegnare bookmark, edit inline, conferma eliminazione ed empty state.
- [x] Separare la vista dettaglio PGN dalla chrome della Libreria e compattare modalità e azioni secondarie.

### Fase 5 — Dashboard e Impostazioni

- [x] Migrare i principali colori di rischio e stato della dashboard ai token semantici.
- [x] Rendere le righe interattive della dashboard attivabili anche tramite Space.
- [x] Allineare visivamente controlli, switch, backup e reset delle Impostazioni ai nuovi token.
- [x] Rendere chiaramente visibile il focus sugli switch.
- [x] Aggiungere feedback live alle operazioni di backup.
- [x] Riorganizzare le Impostazioni nelle sezioni Aspetto, Scacchiera e Dati e backup.
- [x] Aggiungere conferma accessibile al reset delle impostazioni.
- [x] Aggiungere stato loading e risultato dettagliato all'import del backup.
- [x] Rendere la dashboard più orientata alla prossima azione utile.
- [x] Consolidare KPI e informazioni ripetute mantenendo tutti i dati disponibili.

### Fase 6 — Componenti riutilizzabili, accessibilità e motion

- [x] Implementare le prime correzioni semantiche e keyboard-only a basso rischio.
- [x] Standardizzare globalmente focus e riduzione delle animazioni.
- [x] Creare `AppIcon` con set SVG locale.
- [x] Creare `AppDialog` per dialog informativi e conferme.
- [x] Creare `AppToast` con chiusura manuale e varianti semantiche.
- [x] Creare `StatusBadge`, `EmptyState` e `LoadingIndicator` riutilizzabili.
- [x] Completare l'accessibilità della scacchiera con nome, orientamento, tratto e alternativa testuale.
- [ ] Verificare l'intero ordine di focus con tastiera.
- [ ] Completare micro-interazioni e motion dei componenti definitivi.

### Fase 7 — Verifica finale

- [x] Eseguire la build di produzione con esito positivo.
- [x] Portare la suite unit test a 16 test superati su 16.
- [x] Portare la suite Playwright a 3 test superati su 3.
- [x] Eseguire gli E2E in directory temporanee senza sovrascrivere gli artefatti locali dell'utente.
- [x] Verificare il diff con `git diff --check`.
- [ ] Aggiungere test E2E specifici per viewport mobile e tablet.
- [ ] Verificare zoom al 200%, portrait, landscape e modalità board 3D.
- [ ] Eseguire audit contrasto light/dark e WCAG 2.2 AA.
- [ ] Eseguire una sessione keyboard-only completa su tutte le route.
- [ ] Eseguire la verifica manuale con NVDA o TalkBack quando disponibile.
- [ ] Valutare e ridurre i warning relativi ai budget CSS e bundle senza modificare le soglie di sicurezza.

## Modifiche già applicate

I primi interventi hanno interessato:

- `src/styles.scss` per token, temi, focus, skip link e reduced motion;
- `src/index.html` e `src/app/app.html` per metadati e navigazione assistiva;
- shell principale per brand, stato attivo, focus trap, ripristino del focus e comportamento Escape;
- pannello Analisi per stili puzzle/engine, terminologia e stati ARIA;
- Libreria per upload con esito per file, filtri avanzati, bookmark e tabella accessibile;
- Impostazioni per controlli, switch, feedback e conferma tramite `AppDialog`;
- dashboard per prossima azione, KPI consolidati, stati semantici e tastiera;
- componenti UI condivisi `AppDialog`, `AppToast`, `StatusBadge`, `EmptyState` e `LoadingIndicator`;
- scacchiera con nome, orientamento, tratto e descrizione testuale della posizione;
- test unitari ed E2E aggiornati.

La logica Stockfish, i flussi puzzle e Woodpecker, le route, il formato backup e le chiavi di persistenza non sono stati modificati.

## Stato iniziale

L'applicazione dispone già di una base funzionale solida:

- shell con sidebar desktop e drawer mobile;
- viste Analisi, Libreria e Impostazioni;
- scacchiera, barra di valutazione e analisi Stockfish;
- modalità puzzle, Micro-Set e Woodpecker;
- libreria PGN, tattiche famose e bookmark;
- dashboard statistiche;
- tema chiaro/scuro;
- test unitari ed E2E sui flussi principali.

Le criticità principali sono la frammentazione visiva, la quantità di colori e stili hard-coded, la duplicazione responsive del pannello analisi, una gerarchia debole delle azioni e alcune lacune di accessibilità e feedback.

## Problemi individuati

### Alta priorità

1. Design token globali insufficienti e tema scuro basato su override selettivi.
2. Pannello Analisi renderizzato in tre istanze differenti per desktop e mobile.
3. Focus visibile non uniforme e dialog/drawer/menu senza gestione completa della tastiera.
4. Stato engine, upload PGN e import backup poco visibili.
5. Gerarchia insufficiente tra azioni primarie, secondarie e distruttive.
6. Terminologia mista italiano/inglese.
7. Icone basate su emoji e caratteri dipendenti dal sistema operativo.
8. Flusso Libreria sovraccarico di controlli simultanei.

### Media priorità

1. Spaziature, radius, ombre e tipografia non uniformi.
2. Dashboard visivamente separata dalla shell principale.
3. Bookmark e selettore partite poco reperibili nell'area Analisi.
4. Impostazioni presentate come lista piatta.
5. Ricerca generale e filtri avanzati mostrati contemporaneamente.
6. Empty state e toast non standardizzati.
7. Breakpoint e strategie responsive non uniformi.

### Bassa priorità

1. Preview visive per temi e set pezzi.
2. Empty state illustrati.
3. Animazioni avanzate di KPI e grafici.
4. Branding decorativo aggiuntivo.
5. Visual regression testing automatico.

## Linee guida visive

### Direzione

Interfaccia da strumento professionale di studio scacchistico: precisa, sobria, data-rich e priva di decorazioni inutili.

### Palette

- neutri slate per superfici e testo;
- blu/indigo per navigazione e azioni principali;
- ambra/arancio per Woodpecker e progresso training;
- emerald per successo;
- amber per avvisi;
- rose/red per errori e azioni distruttive;
- varianti foreground, border e background dedicate a entrambi i temi.

### Tipografia

- stack locale `system-ui`, senza font remoti;
- scala 12, 14, 16, 20, 24 e 32 px;
- peso 500 per controlli, 600 per sottotitoli e 700 per titoli;
- font monospace solo per FEN, mosse e dati tecnici.

### Spaziatura e superfici

- scala basata su 4/8 px;
- radius principali 8, 12 e 16 px;
- ombre leggere riservate a drawer, dialog, toast e toolbar elevate;
- card normali definite principalmente da superficie e bordo.

### Controlli

- altezza minima 40 px desktop e target touch da almeno 44 px;
- varianti primary, secondary, ghost, success e danger;
- stati hover, active, focus-visible, disabled e loading;
- icone SVG coerenti da 18/20 px.

### Motion

- 120 ms per feedback immediati;
- 180–220 ms per drawer, dialog e disclosure;
- animazioni limitate a opacity, transform e progress;
- pieno supporto a `prefers-reduced-motion`.

## Flussi da preservare

- route `/analysis`, `/library`, `/settings` e dashboard con `pgnId`;
- inizializzazione e calcolo Stockfish;
- logica puzzle, autoplay e navigazione mosse;
- Woodpecker, review queue e analytics;
- struttura dei dati localStorage;
- upload PGN e backup JSON;
- preferenze della scacchiera;
- gesture laterali esistenti come scorciatoie opzionali.

## Flussi da ottimizzare

- accesso ai bookmark dall'area Analisi;
- accesso visibile all'elenco partite oltre alla gesture;
- selezione, configurazione e ripresa di un PGN;
- ricerca e filtri della Libreria;
- feedback engine, upload e import;
- navigazione mobile e gestione del focus;
- gerarchia della dashboard.

## Componenti e primitive da creare

1. `AppIcon`: set locale di SVG coerenti.
2. `AppDialog`: dialog accessibile con Escape, focus iniziale e ripristino del focus.
3. `AppToast`: varianti info, success, warning ed error con chiusura manuale.
4. `StatusBadge`: stato engine, puzzle, rischio e sessione.
5. `EmptyState`: icona, titolo, descrizione e CTA opzionale.
6. `LoadingIndicator`: spinner inline per engine, upload e import.
7. Stili condivisi per button, field, card e toolbar.

# Fasi operative

## Fase 0 — Baseline e contratto di regressione

### Inventario dei comportamenti

- **Obiettivo:** proteggere i flussi prima del refactoring.
- **Priorità:** alta.
- **Dipendenze:** nessuna.
- **Risultato atteso:** test sui percorsi Analisi, Libreria, Bookmark, Impostazioni e Woodpecker.
- **Rischi:** test troppo legati al markup corrente.
- **Verifica:** selettori basati su ruoli, nomi accessibili e risultati funzionali.

### Baseline responsive

- **Obiettivo:** individuare overflow e collisioni sticky.
- **Priorità:** alta.
- **Dipendenze:** inventario comportamenti.
- **Risultato atteso:** matrice a 360, 390, 768, 1024 e 1440 px.
- **Rischi:** dati dashboard non deterministici.
- **Verifica:** fixture locale PGN/Woodpecker.

## Fase 1 — Fondazioni visive e accessibilità globale

### Design token

- **Descrizione:** introdurre token per colori semantici, tipografia, spacing, radius, ombre, z-index e motion.
- **Obiettivo:** creare un'unica fonte di verità per light e dark mode.
- **Priorità:** alta.
- **Dipendenze:** baseline.
- **Risultato atteso:** nuovi componenti automaticamente compatibili con entrambi i temi.
- **Rischi:** regressioni di contrasto o specificità.
- **Verifica:** controllo light/dark e rimozione progressiva degli override `!important`.

### Primitive interattive

- **Descrizione:** uniformare button, input, textarea, select, checkbox, switch, badge e focus ring.
- **Obiettivo:** coerenza immediata tra schermate.
- **Priorità:** alta.
- **Dipendenze:** design token.
- **Risultato atteso:** stessi stati e dimensioni per controlli equivalenti.
- **Rischi:** interferenze con Chessground.
- **Verifica:** isolamento esplicito della DOM della scacchiera.

### Accessibilità documento

- **Descrizione:** lingua italiana, titolo corretto, meta description, skip link, focus globale e reduced motion.
- **Obiettivo:** correggere le fondamenta semantiche.
- **Priorità:** alta.
- **Dipendenze:** design token.
- **Risultato atteso:** documento correttamente identificato e navigabile da tastiera.
- **Rischi:** duplicazione del landmark principale.
- **Verifica:** un solo contenuto principale per route e skip link funzionante.

## Fase 2 — Shell e navigazione

### Sidebar desktop

- **Descrizione:** aggiungere brand, icone, stato attivo non basato solo sul colore e contesto engine.
- **Obiettivo:** migliorare identità e orientamento.
- **Priorità:** alta.
- **Dipendenze:** fase 1.
- **Risultato atteso:** navigazione riconoscibile senza cambiare route.
- **Rischi:** riduzione spazio scacchiera.
- **Verifica:** nessun overflow e larghezza stabile.

### Header e drawer mobile

- **Descrizione:** aggiungere `aria-expanded`, chiusura Escape, focus management e target touch adeguati.
- **Obiettivo:** mantenere una navigazione compatta ma accessibile.
- **Priorità:** alta.
- **Dipendenze:** sidebar.
- **Risultato atteso:** drawer utilizzabile con touch e tastiera.
- **Rischi:** conflitti con gesture laterali.
- **Verifica:** mouse, touch, Tab, Shift+Tab ed Escape.

### Dashboard coerente con la shell

- **Descrizione:** uniformare header, breadcrumb e link di ritorno.
- **Obiettivo:** continuità visiva e navigazionale.
- **Priorità:** media.
- **Dipendenze:** shell.
- **Risultato atteso:** dashboard percepita come parte della stessa app.
- **Rischi:** duplicazione struttura shell.
- **Verifica:** riuso di layout o stili comuni.

## Fase 3 — Analisi e Puzzle

### Layout responsive unico

- **Descrizione:** separare area engine e area mosse evitando tre istanze complete del pannello.
- **Obiettivo:** eliminare stato UI duplicato.
- **Priorità:** alta.
- **Dipendenze:** baseline e fase 1.
- **Risultato atteso:** una sola istanza per funzione, riordinata tramite Grid.
- **Rischi:** regressioni nei numerosi input/output.
- **Verifica:** test eventi e resize senza perdita di stato.

### Gerarchia workspace

- **Descrizione:** dare priorità a scacchiera, stato corrente e navigazione; strumenti secondari in pannelli distinti.
- **Obiettivo:** ridurre il carico cognitivo.
- **Priorità:** alta.
- **Dipendenze:** layout unico.
- **Risultato atteso:** desktop equilibrato e mobile con stato puzzle prima della board.
- **Rischi:** board troppo grande o piccola.
- **Verifica:** dimensionamento rispetto alla viewport e assenza di overflow.

### Stato engine

- **Descrizione:** badge/spinner, profondità, valutazione e migliore mossa visibili senza aprire le impostazioni.
- **Obiettivo:** comunicare chiaramente l'attività del sistema.
- **Priorità:** alta.
- **Dipendenze:** gerarchia workspace.
- **Risultato atteso:** stato engine immediatamente comprensibile.
- **Rischi:** annunci live troppo frequenti.
- **Verifica:** annunciare solo transizioni significative.

### Azioni e strumenti

- **Descrizione:** tradurre i testi, spostare il bookmark tra le azioni della posizione e aggiungere un pulsante visibile per l'elenco partite.
- **Obiettivo:** migliorare reperibilità.
- **Priorità:** alta.
- **Dipendenze:** gerarchia workspace.
- **Risultato atteso:** nessuna funzione essenziale dipende da gesture o pannelli non correlati.
- **Rischi:** toolbar affollata.
- **Verifica:** una sola primaria e poche secondarie visibili.

### Stato puzzle e Woodpecker

- **Descrizione:** barra chiara con messaggio, progresso e azioni assistive.
- **Obiettivo:** rendere evidente cosa fare e cosa accadrà dopo.
- **Priorità:** alta.
- **Dipendenze:** gerarchia workspace.
- **Risultato atteso:** feedback distinti per corretto, errore, attesa, completamento e review.
- **Rischi:** informazione affidata solo al colore.
- **Verifica:** testo e icona accompagnano sempre il colore.

## Fase 4 — Libreria e avvio allenamento

### Overview PGN

- **Descrizione:** rendere `Apri` o `Riprendi` dominante e spostare preview, dashboard e rimozione tra le secondarie.
- **Obiettivo:** chiarire il prossimo passo.
- **Priorità:** alta.
- **Dipendenze:** fase 1.
- **Risultato atteso:** card meno affollate e ripresa in un click.
- **Rischi:** azioni percepite come rimosse.
- **Verifica:** tutte le azioni restano disponibili da tastiera.

### Dettaglio PGN

- **Descrizione:** organizzare modalità, CTA, opzioni allenamento, Micro-Set e partite tramite progressive disclosure.
- **Obiettivo:** ridurre le informazioni simultanee.
- **Priorità:** alta.
- **Dipendenze:** overview.
- **Risultato atteso:** configurazione più leggibile.
- **Rischi:** opzioni avanzate troppo nascoste.
- **Verifica:** disclosure chiaramente nominata.

### Ricerca e filtri

- **Descrizione:** una ricerca generale visibile e filtri avanzati in disclosure.
- **Obiettivo:** eliminare la presenza simultanea di cinque controlli di ricerca.
- **Priorità:** media.
- **Dipendenze:** dettaglio PGN.
- **Risultato atteso:** schermata compatta senza perdita di capacità.
- **Rischi:** click aggiuntivo per utenti esperti.
- **Verifica:** stato disclosure mantenuto durante il lavoro.

### Elenco partite accessibile

- **Descrizione:** azioni semantiche nella tabella, caption, scope e card mobile.
- **Obiettivo:** supportare tastiera e screen reader.
- **Priorità:** alta.
- **Dipendenze:** dettaglio PGN.
- **Risultato atteso:** selezione equivalente su desktop e mobile.
- **Rischi:** duplicazione markup.
- **Verifica:** Tab, Enter e Space.

### Upload ed empty state

- **Descrizione:** input file raggiungibile, formati supportati, caricamento, esito per file ed errori di parsing.
- **Obiettivo:** aumentare fiducia durante l'importazione.
- **Priorità:** alta.
- **Dipendenze:** toast e loading indicator.
- **Risultato atteso:** nessun caricamento silenzioso.
- **Rischi:** maggiore stato nel workspace.
- **Verifica:** file valido, vuoto, multiplo e non valido.

## Fase 5 — Dashboard e Impostazioni

### Dashboard orientata all'azione

- **Descrizione:** mantenere “Cosa fare adesso” in alto, rendere “Riprendi review” primaria e consolidare metriche ripetute.
- **Obiettivo:** chiarire il prossimo esercizio utile.
- **Priorità:** media.
- **Dipendenze:** fase 1.
- **Risultato atteso:** dashboard meno lunga e più decisionale.
- **Rischi:** perdita percepita di dettaglio.
- **Verifica:** dati ancora disponibili nelle disclosure.

### KPI e trend

- **Descrizione:** uniformare card, progress bar, badge e grafici con equivalenti testuali.
- **Obiettivo:** aumentare leggibilità e accessibilità.
- **Priorità:** media.
- **Dipendenze:** dashboard.
- **Risultato atteso:** confronto cicli più immediato.
- **Rischi:** animazioni eccessive.
- **Verifica:** comprensione senza animazioni e senza colore.

### Impostazioni per sezioni

- **Descrizione:** separare Aspetto, Scacchiera e Dati e backup.
- **Obiettivo:** creare una gerarchia prevedibile.
- **Priorità:** media.
- **Dipendenze:** fase 1.
- **Risultato atteso:** schermata leggibile e scalabile.
- **Rischi:** troppe card per pochi controlli.
- **Verifica:** gruppi compatti e heading coerenti.

### Reset e backup

- **Descrizione:** conferma per reset, stato occupato import e feedback live.
- **Obiettivo:** proteggere azioni sensibili.
- **Priorità:** alta.
- **Dipendenze:** dialog, toast e loading indicator.
- **Risultato atteso:** nessuna azione irreversibile accidentale.
- **Rischi:** conferme eccessive.
- **Verifica:** conferma solo per operazioni distruttive.

## Fase 6 — Accessibilità e micro-interazioni

### Semantica e tastiera

- **Descrizione:** landmark, heading, tab ARIA, focus order, Escape e ripristino focus.
- **Obiettivo:** completare i flussi senza mouse.
- **Priorità:** alta.
- **Dipendenze:** componenti definitivi.
- **Risultato atteso:** nessun focus perso o impropriamente intrappolato.
- **Rischi:** conflitti tra shortcut mosse e form.
- **Verifica:** sessione keyboard-only su tutte le route.

### Scacchiera

- **Descrizione:** nome accessibile, orientamento, tratto e alternativa testuale tramite stato e cronologia.
- **Obiettivo:** fornire contesto anche fuori dalla rappresentazione visuale.
- **Priorità:** media.
- **Dipendenze:** layout Analisi.
- **Risultato atteso:** board non anonima alle tecnologie assistive.
- **Rischi:** limiti keyboard di Chessground.
- **Verifica:** non dichiarare piena accessibilità finché il movimento keyboard non è supportato.

### Motion e feedback

- **Descrizione:** transizioni coerenti per drawer, dialog, toast, progress e disclosure.
- **Obiettivo:** migliorare la qualità percepita senza rallentare l'uso.
- **Priorità:** media.
- **Dipendenze:** UI definitiva.
- **Risultato atteso:** animazioni brevi e funzionali.
- **Rischi:** motion ridondante.
- **Verifica:** nessuna animazione blocca input e reduced motion rispettata.

## Fase 7 — Verifica finale

### Test automatici

- **Descrizione:** build, unit test ed E2E desktop/mobile.
- **Obiettivo:** impedire regressioni funzionali.
- **Priorità:** alta.
- **Dipendenze:** tutte le fasi.
- **Risultato atteso:** suite verde.
- **Rischi:** selettori legati al vecchio markup.
- **Verifica:** `npm run build`, `npm test`, `npm run e2e`.

### Matrice responsive

- **Descrizione:** portrait, landscape, zoom 200%, viewport piccoli e desktop ampi.
- **Obiettivo:** uniformità cross-device.
- **Priorità:** alta.
- **Dipendenze:** test automatici.
- **Risultato atteso:** nessun overflow o controllo coperto.
- **Rischi:** proporzioni speciali della board 3D.
- **Verifica:** test separati 2D e 3D.

### Audit WCAG 2.2 AA

- **Descrizione:** contrasto, focus, nomi accessibili, tab order, live region, target touch e reduced motion.
- **Obiettivo:** livello AA realistico per l'interfaccia attorno alla scacchiera.
- **Priorità:** alta.
- **Dipendenze:** matrice responsive.
- **Risultato atteso:** nessun problema critico automatico o manuale.
- **Rischi:** limiti intrinseci della libreria scacchiera.
- **Verifica:** audit automatico e controllo manuale con tecnologie assistive quando disponibili.

## Ordine di esecuzione

1. Baseline e test di regressione.
2. Token, temi e primitive.
3. Shell e navigazione.
4. Analisi e Puzzle.
5. Libreria.
6. Dashboard e Impostazioni.
7. Accessibilità e motion trasversali.
8. QA finale.

## Criteri di qualità finali

1. Nessun overflow orizzontale da 320 px in su.
2. Azioni principali identificabili immediatamente.
3. Stati hover, active, focus e disabled coerenti.
4. Parità qualitativa light/dark.
5. Contrasto testo e focus conforme WCAG AA.
6. Target touch principali da almeno 44×44 px.
7. Drawer, dialog e menu utilizzabili con tastiera ed Escape.
8. Focus restituito al trigger dopo la chiusura.
9. Nessuna funzione essenziale dipendente solo da gesture.
10. Caricamenti ed errori con feedback visibile e accessibile.
11. Terminologia italiana coerente.
12. Icone uniformi.
13. Scacchiera sempre elemento dominante.
14. Flusso Riprendi mantenuto a un click.
15. Upload, bookmark, backup e training invariati funzionalmente.
16. Build, unit test ed E2E verdi.
17. `prefers-reduced-motion` rispettato.
18. Nessuna modifica ai formati di persistenza.
