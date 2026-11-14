# Review evidence

Local environment: Linux, Node 24.22.1, npm 11.9.0, OpenJDK 21.0.13.

- Clean `npm ci --ignore-scripts`: passed.
- Strict TypeScript check (`npm run lint`): passed.
- Nine automated TextMate/Oniguruma integration tests: passed.
- Full development dependency audit: zero vulnerabilities at verification time.
- VSCE package creation and ZIP asset/manifest inspection: passed.
- Official formatter probe: nine valid cases idempotent, non-comment token values
  preserved; three invalid inputs refused. Exact multiline comment content changed
  in two cases. Formatter integration remains gated on a separate core fix.

Raw output is in `docs/evidence/`. `artifacts/SHA256SUMS` records the packaged VSIX.
The dependency lock intentionally overrides minimatch to 11.0.8: the VSCE 4.1.1
range selected an advisory-affected release. Packaging and fixture tests pass with
that override. No installation hooks or native signing binary are executed.

## Checks still pending

GitHub Actions has been configured for Windows, Linux and macOS on Node 22/24,
but has not run: the remote repository was not created. These are local results,
not remote CI evidence. No PR URL is available.

VS Code is not installed in this environment. A clean editor installation,
visual/theme review, actual editor shortcuts and UI behavior have not been
verified here. TextMate tests and VSIX inspection do not replace that review.
No IntelliJ ZIP, Plugin Verifier result or LSP integration is claimed.

The main repository was cloned for inspection only, with no file changes,
branch pushes or effects on PRs #101, #102 or #103.
