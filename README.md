# TUPREL Editor Extensions

[TUPREL for VS Code](extensions/vscode/README.md) provides syntax support,
official compiler diagnostics and formatting for .tuprel schemas. The Java
language server is built and installed separately from
[tuprel/tuprel](https://github.com/tuprel/tuprel).

## Develop and test

Use Node.js 22.12+ or 24 and npm. The bundled client uses
vscode-languageclient 9.0.1, the Microsoft MIT-licensed release compatible
with the existing VS Code 1.85 minimum. Current 11.x releases require
VS Code 1.91. TypeScript targets ES2022 for VS Code's Node 18 extension
host. esbuild bundles the production graph, including its locked protocol,
JSON-RPC and utility dependencies, with their licenses. No npm install
is required on an end user's machine.

```sh
npm ci --ignore-scripts
npm run lint
npm test
npm audit --audit-level=moderate
npm run package
python tools/check-vsix.py
```

The Extension Host test installs the built VSIX into a fresh profile.
Build the official server from ad0c9c6898f5d924f725b6a6c49ac78ade272849
with strict verification. Set TUPREL_TEST_JAVA and
TUPREL_TEST_DISTRIBUTION to absolute paths, then run npm run test:host.
Set TUPREL_TEST_VSCODE to test an existing desktop binary. The default
downloads the pinned VS Code 1.85.2 for testing. The CI builds the pinned
server and exercises the installed VSIX on Windows, macOS and Linux.

Fixtures retain their upstream Apache-2.0 license. See
[provenance](fixtures/provenance.json) and the
[integration plan](docs/INTEGRATION-PLAN.md).
