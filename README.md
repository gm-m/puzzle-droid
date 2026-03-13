# ChessApp

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.2.2.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## GitHub Pages deployment

This repository is configured to deploy automatically to GitHub Pages using the `gh-pages` branch.

To generate a production build locally with the correct base URL for GitHub Pages, run:

```bash
npm run build:gh-pages
```

To enable the hosted site on GitHub:

1. Push the repository to GitHub.
2. Open `Settings > Pages` in the GitHub repository.
3. Set the source to `Deploy from a branch`.
4. Select the `gh-pages` branch and the `/ (root)` folder.
5. Save the configuration.

The workflow in `.github/workflows/deploy-gh-pages.yml` will publish the Angular build to `gh-pages` after each push to `main` or `master`, and it also creates a `404.html` fallback so Angular routes continue to work on GitHub Pages.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
