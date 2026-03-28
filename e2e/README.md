# E2E tests

## Setup

Install dependencies:

```bash
npm install
```

Install Playwright browser binaries:

```bash
npx playwright install chromium
```

## Run

Headless:

```bash
npm run e2e
```

Headed:

```bash
npm run e2e:headed
```

Debug:

```bash
npm run e2e:debug
```

The Playwright config starts the Angular dev server automatically on `http://127.0.0.1:4200`.
