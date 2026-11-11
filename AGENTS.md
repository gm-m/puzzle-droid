# AGENTS.md

## Verification
- Build: `npm run build` (SCSS budget warnings are pre-existing).
- Unit tests: `npm run test:ci`. Chrome is not installed on this machine; point Karma at Playwright's Chromium:
  `CHROME_BIN="C:\Users\Admin\AppData\Local\ms-playwright\chromium-1208\chrome-win64\chrome.exe" npm run test:ci`
- All unit tests are expected to pass. `LibraryPanelComponent` is OnPush: in specs change inputs with `fixture.componentRef.setInput(...)`, not by assigning properties.
- Library persistence lives in IndexedDB (`LibraryStorageService`); see `IMPROVEMENTS.md` for the library UX/performance plan and its status.
- The machine can run out of memory when `ng serve`, Karma and builds run at the same time: run them sequentially.
