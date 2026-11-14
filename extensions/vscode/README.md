# TUPREL for Visual Studio Code

Open `schema.tuprel` to get TUPREL syntax highlighting, bracket matching,
automatic pairs, declaration indentation, comment shortcuts and snippets.
No JDK, CLI or database is required.

Type `model`, `enum`, `generator` or `datasource` and press Ctrl+Space to select
a snippet. Colors follow your active theme. Editor settings control auto-closing,
indentation width and snippet suggestions.

## Install

Run **Extensions: Install from VSIX…** and select `tuprel-vscode-0.1.0.vsix`,
or use `code --install-extension tuprel-vscode-0.1.0.vsix`.

## Release scope

Version 0.1.0 supplies lexical editing support only. It does not provide
formatting, Format on Save, diagnostics, contextual completion, hover, outline
or navigation. Highlighting does not imply validity. Future language intelligence
will reuse the official Java frontend, following separate formatter and LSP
validation. No parser or formatter is duplicated in TypeScript.

The extension contributes static assets only. It works in untrusted and virtual
workspaces, performs no file writes or network requests, executes no project
commands and collects no telemetry. It does not change your Java installation.

Language source: https://github.com/tuprel/tuprel

Apache-2.0 license. Original T icon; no third-party branding or implementation copied.
