# Windows recovery and verification

The Cloud recovery commits are preserved in the verified bundle and the local
archive/cloud-recovery branch. The recovered tip is
daa934dc57e9ff1ab918180515c8077ddebf65ca, with parent
28a004e5c5be74ae778ec3978317a95e591d5621. The import commit
e73b7dd25c1f6e7a889e3ebe92c1d02334dc0ebb has exactly the same Git tree as the
recovered tip. Its parent is an empty initial main commit, so the first pull
request shows the entire source.

## Local checks

On Windows, Node 24.22.1 and npm 11.16.0 passed npm ci --ignore-scripts,
npm run lint, TypeScript compilation, all nine tests, npm audit
--audit-level=moderate (zero vulnerabilities), VSCE packaging, and the VSIX
inspection. The five fixture hashes match the pinned upstream provenance.
The Windows-built VSIX and original have the same 11 ZIP entries and identical
uncompressed contents. Both pass ZIP CRC verification.

- Original VSIX SHA-256: 3cc4661b8376f024fc4f1b61eb409d5b65b1d86cbdb02bc7d084ed689084da57
- Windows VSIX SHA-256: 18284a18b8975927114108cd9685a7a0f58005474d2483973903d2927af3f02f

Git attributes enforce LF on checkout, including when core.autocrlf is true.

## VS Code installation

The original VSIX installed in desktop VS Code 1.146.0 with separate
user-data and extensions directories. The process was launched with JAVA_HOME
and JDK_HOME cleared and Java unavailable on PATH. The editor window opened
schema.tuprel. The subsequent PR review validated the CI VSIX in a new isolated
profile. See [desktop verification and captures](VERIFICATION.md#windows-desktop-vs-code).
The extension manifest has no activation entry point.

The official formatter issue is documented separately in
[FORMATTER-ISSUE.md](FORMATTER-ISSUE.md).
