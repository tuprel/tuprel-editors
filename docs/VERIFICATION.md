# VS Code MVP verification

## Remote CI

Both GitHub Actions runs passed all six jobs on the tested extension revision
bedd31a1206381a789053483a4509f2d66aa90aa. The matrix covers Windows, Ubuntu and
macOS with Node.js 22 and 24.

- [PR #1 workflow](https://github.com/tuprel/tuprel-editors/actions/runs/43590174071)
- [Branch push workflow](https://github.com/tuprel/tuprel-editors/actions/runs/43589490882)

Each job installs locked dependencies with scripts disabled, checks TypeScript,
audits dependencies, runs the nine tests, packages and inspects the VSIX, and
uploads the extension with SHA256SUMS.

The [Windows / Node 24 artifact](https://github.com/tuprel/tuprel-editors/actions/runs/43589490882/artifacts/14112145526)
was downloaded and checked against the GitHub artifact digest and its VSIX
checksum. The VSIX SHA-256 is
439f72c93b63c3c4028b3ef6f127da8ff3a69c68166770558a397ed04230b9cd.
All 11 files inside match the recovered Cloud VSIX byte for byte.

## Windows desktop VS Code

Tested the CI VSIX in portable VS Code 1.146.0 with fresh, separate user-data
and extension directories. JAVA_HOME and JDK_HOME were cleared and Java was
absent from PATH. The extension installed as tuprel.tuprel-vscode@0.1.0.
The window remained in Restricted Mode and the test used copies of the fixtures.

| Check | Observed result |
| --- | --- |
| File recognition and lifecycle | Spring Products API, complete and playground schemas opened with TUPREL in the status bar. Closing the edited scratch file returned to the complete schema with TUPREL still active. |
| Theme-driven highlighting | Declarations, scalar and custom types, attributes and strings rendered in [Light Modern](evidence/windows/complete-light.jpg) and [Dark Modern](evidence/windows/complete-dark.jpg). The [playground](evidence/windows/playground.jpg) also showed relation types and attributes. |
| Snippets | Insert Snippet listed datasource, enum, generator and model. The [model snippet](evidence/windows/snippet.jpg) expanded and selected its name placeholder. The other three were observed in the picker. |
| Comments | Ctrl+/ inserted a line comment and Shift+Alt+A wrapped selected text in a block comment. Both received comment highlighting in [the editor](evidence/windows/comments.jpg). |
| Pairs and indentation | Typing opening braces, parentheses and quotes inserted their closing pair. Enter between braces produced a four-space body and an aligned closing brace. The [editor capture](evidence/windows/pairs-indent.jpg) and saved scratch file confirmed the result. |
| Activation | The manifest contributes static assets and has no activation entry point. No Tuprel activation errors appeared in the inspected logs. The built-in VS Code agent host reported a startup timeout and the editor checks still passed. |

## Local build and formatter

On Windows, a fresh checkout passed the locked install, TypeScript check,
compilation, all nine tests, VSIX packaging and package inspection. The npm audit
reported zero vulnerabilities. The five fixture hashes were verified in a
checkout with core.autocrlf enabled. See [Windows recovery notes](WINDOWS-VERIFICATION.md)
and [historical Cloud logs](evidence/).

The official formatter probe found that two cases changed exact multiline
comment content. The [formatter issue](FORMATTER-ISSUE.md) records the separate
core reproduction.
