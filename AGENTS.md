# AGENTS.md

## Verification
- Build: `npm run build` (SCSS budget warnings are pre-existing).
- Unit tests: `npm run test:ci`. Chrome is not installed on this machine; point Karma at Playwright's Chromium:
  `CHROME_BIN="C:\Users\Admin\AppData\Local\ms-playwright\chromium-1208\chrome-win64\chrome.exe" npm run test:ci`
- All unit tests are expected to pass. `LibraryPanelComponent` is OnPush: in specs change inputs with `fixture.componentRef.setInput(...)`, not by assigning properties.
- Library persistence lives in IndexedDB (`LibraryStorageService`); see `IMPROVEMENTS.md` for the library UX/performance plan and its status.
- The machine can run out of memory when `ng serve`, Karma and builds run at the same time: run them sequentially.
- Killing the shell that runs `ng serve` can leave the node process alive (port stays busy): check with `netstat -ano | rg ":4300"` and stop the PID.
- PGN parsing lives in `src/app/utils/pgn-parser.ts` (`pgnParser`), shared by the workspace (`test.ts`) and Puzzle Rush (`/rush`, `components/puzzle-rush/`; run logic in `puzzle-rush-run.ts`, records in `PuzzleRushRecordsService`).
- Promotions: `ChessBoardComponent` shows the piece picker and emits `BoardMove.promotion`; puzzles always ask (auto-queen applies to analysis only).
- Grid layouts: use `grid-template-columns: minmax(0, 1fr)` on grids containing `nowrap` text, otherwise the track grows to the text width and causes horizontal scrolling on mobile.
