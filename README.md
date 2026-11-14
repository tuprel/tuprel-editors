# TUPREL Editor Extensions

Editor tooling for the [TUPREL language](https://github.com/tuprel/tuprel).
This repository contains the first VS Code syntax release. It is prepared for
`tuprel/tuprel-editors`; remote repository creation and marketplace publication
have not been performed.

## Install locally

Download `tuprel-vscode-0.1.0.vsix` from the review artifacts. In VS Code, run
**Extensions: Install from VSIX…**, select the file and open `schema.tuprel`.
Alternatively:

```sh
code --install-extension artifacts/tuprel-vscode-0.1.0.vsix
```

The language mode should show **TUPREL**. No JDK, CLI, database or configuration
is required. Try `fixtures/upstream/spring-products-api.tuprel`.

## Available in 0.1.0

- Automatic `.tuprel` association, light/dark file icons and theme-driven scopes.
- Declaration, type, attribute, identifier, literal, comment and punctuation colors.
- Bracket matching, pair insertion, surrounding pairs and declaration indentation.
- Editor line/block comment shortcuts.
- `model`, `enum`, `generator` and `datasource` snippets (use Ctrl+Space to select).

User settings govern indentation width, auto-closing and snippet suggestions.
The extension does not override them. Highlighting is lexical: it does not prove
that a schema is valid. Built-in types and attributes follow the pinned official
frontend; identifiers inside strings/comments never become declaration tokens.

**Not available yet:** formatting, Format on Save, diagnostics, contextual
completion, hover, outline, definition navigation or an IntelliJ plugin.
Do not configure this version as a formatter. The snippets are the only completion
contribution. No second parser or formatter is implemented in TypeScript.

## Build and verify

Use Node.js 22.12+ and npm. Node 24 is also covered by CI.

```sh
npm ci --ignore-scripts
npm run lint
npm test
npm audit --audit-level=moderate
npm run package
```

The VSIX is written to `artifacts/`. Only declarative extension assets are
packaged; TypeScript tests, dependencies and fixtures stay outside the extension.
The grammar runs in VS Code's native TextMate engine; TypeScript is used for
integration tests, with no activation script or extension host process required.
`npm ci --ignore-scripts` avoids dependency install hooks; packaging does not sign,
publish, download a language server or run a project command.

Fixtures copied from TUPREL retain their upstream Apache-2.0 license. Their exact paths,
revisions and hashes are recorded in `fixtures/provenance.json`, including PR #103.
Synthetic lexer edge cases live in the tests and need not be semantically valid.

## Security

No network requests, telemetry, Java execution, schema upload, file writes,
project commands or database connections occur when using this extension.
It supports untrusted and virtual workspaces because it only contributes static
editor resources. Build-time npm dependencies are locked and checked in CI.
No publishing tokens are required or stored.

## Review and next steps

See [verification evidence](docs/VERIFICATION.md), the
[frontend audit](docs/FRONTEND-AUDIT.md) and the
[integration plan](docs/INTEGRATION-PLAN.md). Stop after review of this release;
subsequent stages belong in separate PRs. Nothing here changes TUPREL main,
PRs #101–#103, or ADR-0002.

Licensed under Apache-2.0. The T icon is original to this extension.
