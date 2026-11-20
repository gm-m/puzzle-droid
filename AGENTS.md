# AGENTS.md

## Verification
- Build: `npm run build` (SCSS budget warnings are pre-existing).
- Unit tests: `npm run test:ci` (Vitest and jsdom).
- End-to-end tests: `npm run e2e` (Vitest and Playwright's Chromium). Install Chromium once with `npx playwright install chromium`.
- All unit tests are expected to pass. `LibraryPanelComponent` is OnPush: in specs change inputs with `fixture.componentRef.setInput(...)`, not by assigning properties.
- Library persistence lives in IndexedDB (`LibraryStorageService`); see `IMPROVEMENTS.md` for the library UX/performance plan and its status.
- The machine can run out of memory when `ng serve`, Vitest and builds run at the same time. Run them sequentially.
- Killing the shell that runs `ng serve` can leave the node process alive (port stays busy): check with `netstat -ano | rg ":4300"` and stop the PID.
- PGN parsing lives in `src/app/utils/pgn-parser.ts` (`pgnParser`), shared by the workspace (`test.ts`) and Puzzle Rush (`/rush`, `components/puzzle-rush/`; run logic in `puzzle-rush-run.ts`, records in `PuzzleRushRecordsService`).
- Promotions: `ChessBoardComponent` shows the piece picker and emits `BoardMove.promotion`; puzzles always ask (auto-queen applies to analysis only).
- Grid layouts: use `grid-template-columns: minmax(0, 1fr)` on grids containing `nowrap` text, otherwise the track grows to the text width and causes horizontal scrolling on mobile.
