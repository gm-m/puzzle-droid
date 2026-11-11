# AGENTS.md

## Verification
- Build: `npm run build` (SCSS budget warnings are pre-existing).
- Unit tests: `npm run test:ci`. Chrome is not installed on this machine; point Karma at Playwright's Chromium:
  `CHROME_BIN="C:\Users\Admin\AppData\Local\ms-playwright\chromium-1208\chrome-win64\chrome.exe" npm run test:ci`
- Known pre-existing failures (NG0100 in LibraryPanelComponent "primary card action" tests).
