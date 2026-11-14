# Original MVP recovery

The original environment survived at `/workspace/tuprel-editors`. Its local Git
branch was `feat/vscode-syntax`, with no commits and no remote. There was no
original HEAD to recover. Commit `28a004e` was created during recovery to capture
the original source; it must not be described as a pre-existing commit.

All 39 entries in the original review ZIP matched the original working files
byte-for-byte before adding recovery documentation. Evidence is in
`docs/evidence/recovery/original-comparison.json`. No implementation was rebuilt.
The original VSIX and original ZIP are preserved separately under
`/workspace/tuprel-recovery/original`.

Original artifact SHA-256:

- VSIX: `3cc4661b8376f024fc4f1b61eb409d5b65b1d86cbdb02bc7d084ed689084da57`
- ZIP: `eeae085a15af2a1438bb307126fe68df2fa2ea68d708fe0619f045994add9b84`

Executed again: deterministic install with scripts disabled, TypeScript check,
nine tests (nine passed, zero failed), npm audit (zero vulnerabilities), and
inspection of the original VSIX (11 files, required assets present, no executable
payload). Fresh logs are in `docs/evidence/recovery`. Packaging was not rerun:
the downloadable VSIX is the original artifact.

Fixture revisions:

- Main fixtures: `ae3776c28c328c7f6472df1f32f832d17b9f282a`.
- PR #103: `8ee68e75be0852a32c704915dccc90709335168b`.

Each fixture also has its upstream path and content hash in fixtures/provenance.json.

## Transfer to another session

Download the recovery ZIP, extract it, then clone its bundled Git history:

```sh
git clone --branch feat/vscode-syntax tuprel-editors.bundle tuprel-editors
cd tuprel-editors
npm ci --ignore-scripts
npm test
```

The recovery package also includes a source snapshot, original artifacts, fresh
evidence and SHA256SUMS. Verify hashes before installing. Workspace paths alone
do not transfer files between sessions: download the ZIP and attach it to the
next session or retain it locally.

## Remote preparation only

No repository, branch push, remote CI run or marketplace publication was made.
After explicit authorization, the owner can create the approved repository and
push the recovered history:

```sh
gh repo create tuprel/tuprel-editors --public --description 'TUPREL editor tooling'
git remote add origin https://github.com/tuprel/tuprel-editors.git
git push -u origin feat/vscode-syntax
```

Choose and initialize a reviewed base branch before opening the first PR. Do not
push editor code into the core repository. The existing workflow is prepared but
remote CI remains pending. Isolated VS Code installation and visual validation
also remain pending; no screenshots or activation results are claimed here.
The official VS Code download was staged while exploring validation options,
but no editor was launched and no personal settings were changed.

Recommendation: ready for recovery review and isolated installation, not yet a
fully validated first merge. Keep LSP, formatting, diagnostics and IntelliJ out
of this MVP. See FORMATTER-ISSUE.md for the separately reproduced core issue.
