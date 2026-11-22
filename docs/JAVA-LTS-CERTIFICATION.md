# VS Code Extension Host — D2 staging certification

Editor base: `27a7e291771255254be8b438e803dc6f330ce21a`.
Server revision: `3436cc4f2d0ec227f7130ebd2c4650dba601e82b`, from
[TUPREL PR #124](https://github.com/tuprel/tuprel/pull/124).
The server's Windows/Linux Java 17/21/25 matrix passed before this editor
work began. Java 21 remains the public product minimum. Phase E activation,
Marketplace publication and a bundled runtime are excluded.

## What this certifies

The workflow builds the pinned official `installDist` once per platform with
JDK 21 and strict dependency verification. It copies the installation outside
the checkout, into a path with spaces. The same server libraries and VSIX
are reused in the three Windows/Linux cells. Each cell uses explicit absolute
Java and distribution paths in a fresh user profile. macOS retains its existing
Java 21 Extension Host coverage; macOS Java 17/25 are not certified here.

The host installs the packaged VSIX and executes its installed JavaScript,
not the TypeScript source. Tests cover official diagnostics, UTF-16 positions,
clearing after unsaved edits, isolation between documents, formatting and
Format on Save, restricted workspaces, virtual documents, snippets and delayed
responses. The existing ownership and snapshot assertions remain intact.

The current extension deliberately exposes diagnostics and formatting only.
Completion, hover and Go to Definition are server capabilities, tested in the
Java PR; this certification does not add editor providers for them.

## JVM selection, refusal and recovery

Each cell checks the actual selected JVM version before starting the host.
Inside the real Extension Host, OS process observation verifies that its
direct Java child uses the configured executable and installed classpath.
Windows uses process metadata from CIM; Linux checks `/proc`, including the
executable identity. These observations complement the successful stdio
requests; a configuration string alone is not accepted as execution proof.
macOS retains a process command-line check rather than the Linux `/proc` proof.

A real Java 11 runtime must reject the installed major-61 server. The host is
then configured with that incompatible executable: the process must exit,
formatting becomes unavailable, and language recognition and snippets remain.
Restoring the selected JVM and running **TUPREL: Restart Language Server** must
restore diagnostics, clearing after edits and canonical formatting. Both the
original and recovered server processes must terminate after shutdown.

The existing user-facing startup warning directs the user to check the Java 21
executable and official distribution in User Settings. Those public requirement
messages are preserved until Phase E. The tests exercise startup failure and
recovery; they do not claim a pixel-level inspection of the notification UI.
Syntax tests separately validate the TextMate grammar and packaged assets;
the host checks language recognition and snippet insertion, not rendered colours.

VS Code may minimize a server formatting edit into several editor edits. The
recovery test applies the returned edits and asserts the exact canonical text,
instead of assuming the editor API preserves the server's edit count.

## Reproduce

```sh
npm ci --ignore-scripts
npm run lint
npm audit --audit-level=moderate
npm run package
python tools/check-vsix.py
```

Set the following variables, then run `npm run test:host`:

- `TUPREL_TEST_JAVA`: absolute path to the cell's Java 17, 21 or 25 executable.
- `TUPREL_TEST_BAD_JAVA`: absolute path to the negative fixture's Java 11 executable.
- `TUPREL_TEST_DISTRIBUTION`: absolute path to the copied official installation.
- `TUPREL_TEST_SERVER_REVISION`: the full server SHA above.
- `TUPREL_TEST_CELL`: `java17`, `java21` or `java25`.
- Optional `TUPREL_TEST_VSCODE`: an existing VS Code desktop executable.

The default host is pinned VS Code 1.85.2. Linux runs under `xvfb-run -a`.
The mock used only for delayed-response tests also compiles with release 17;
it is never substituted for the official-server positive or recovery proofs.

Evidence in `artifacts/d2-java*/` records the JVM, server revision, complete
library SHA-256 inventory, VSIX SHA-256 and observed server processes. The
workflow uploads it for review. The final PR records executed cells and job
links; a queued, failed or unexecuted cell is not certified.
