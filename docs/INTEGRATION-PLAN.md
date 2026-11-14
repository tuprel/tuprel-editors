# Staged integration contract

## PR 1 — syntax

This release owns declarative editor behavior only. TextMate regexes classify
text; they are not a schema parser. TypeScript tests exercise the same TextMate
and Oniguruma engines as VS Code. Review the local VSIX before proceeding.

## Formatter prerequisite — independent core PR

Run and expand `tools/FormatterAudit.java` against the pinned official frontend.
Require valid compilation before formatting, equivalent AST values ignoring source
spans, stable comment content/order, and byte-identical second formatting. Add
regression tests in the core repo and submit a separate fix PR if comments are
changed. Include multiline comments between attributes, leading/trailing spaces
inside comments, escaped quotes/backslashes/Unicode, comment delimiters in
strings, relations, list defaults, named arguments, CRLF/LF, empty and invalid
files. An invalid document must yield diagnostics and no edits. Do not enable
Format on Save until this gate passes. The current probe is preliminary, not the
full acceptance suite.

## PR 2 — tuprel-language-server in tuprel/tuprel

Evaluate Eclipse LSP4J (maintained Java implementation with typed JSON-RPC) against
other maintained JVM libraries. Pin a version only after checking its transitive
licenses, vulnerabilities and Java bytecode floor. No dependency is selected yet.
The frontend API is `SchemaCompiler.compile(SourceText)` and
`SchemaFormatter.format(SourceText)`; no database or CLI subprocess is necessary.

Proposed initial protocol:

- stdio JSON-RPC framing; stdout exclusively protocol, stderr for redacted logs.
- `initialize`: advertise UTF-16, full document sync, open/close, formatting.
- `didOpen`/`didChange`: URI + version + full in-memory text; no filesystem read.
- immutable per-document snapshots; cancellation and monotonic versions; discard
  diagnostics when the current version differs. Include diagnostic version.
- `didClose`: release snapshot, clear diagnostics and cancel work.
- `publishDiagnostics`: preserve official codes and severity; LEX/PARSE versus SEM
  appear in code/source. Convert UTF-16 span offsets to zero-based UTF-16 lines
  and characters, handling CRLF together; never reuse code-point columns.
- formatting: snapshot, validate, format, return a full-document TextEdit only for
  valid input. Preserve newline policy explicitly; invalid => no edits. Reject
  obsolete work before returning. The client also checks document version before
  applying results; the basic LSP formatting response carries no document version.
- `shutdown` then `exit`, including parent termination and EOF cleanup; bounded
  worker resources; no background JVM left running.

No arbitrary commands, project hooks, network, migrations, telemetry or implicit
writes. Java launch paths are explicit user settings; disable project-resolved
execution in untrusted workspaces. Do not silently download or change a JDK.

ADR-0002 currently requires Java 21 in core. Java 17 compatibility therefore
remains an explicit architecture decision: audit frontend bytecode/API usage and
choose a reviewed Java 17-compatible distribution or keep intelligence disabled
with a clear explanation on Java 17. Syntax remains available. Do not edit the
ADR as a side effect of tooling work.

## PR 3 — VS Code intelligence

B3 uses the official Microsoft client with explicit Java and distribution
paths in User Settings and local workspace trust. The adapter owns the
full-text notifications so each tracked document can receive a session-wide
monotonic wire version, including after a document closes and reopens.
Diagnostics match that version and the current editor document. Formatting
returns only edits whose editor snapshot is still current. Format on Save
follows the user's VS Code settings.

See the [extension README](../extensions/vscode/README.md) for installation,
configuration and limitations. The official server is built from
ad0c9c6898f5d924f725b6a6c49ac78ade272849 in the Extension Host workflow.

## PR 4 — IntelliJ native baseline

Create `extensions/intellij` with IntelliJ Platform SDK, FileType, Language,
lexer-based native highlighting, commenter and brace matcher. The syntax lexer
classifies tokens only; do not port the parser to Kotlin. Use shared pinned
fixtures. Base syntax must work in free IntelliJ builds without a commercial LSP
API. A later adapter may launch the official Java engine via a bundled LSP client
or a reviewed bridge; JetBrains commercial LSP support is optional.

Select actual supported IDE versions only after platform compatibility tests;
no compatibility matrix is claimed now. Require Plugin Verifier on the selected
free/commercial builds, fixture tests and a clean IDE ZIP installation. Keep IDE
runtime Java requirements separate from the user's project JDK.

## PR 5 — distribution

Run clean VS Code installs on Windows/Linux/macOS, UI/theme checks, extension
host tests and uninstall verification. Test Intel/ARM where applicable. Publish
neither marketplace automatically. Require reviewed artifacts, checksums, license
notices and release notes before separate publication authorization.
