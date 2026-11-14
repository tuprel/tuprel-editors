# TUPREL for Visual Studio Code

TUPREL opens .tuprel schemas with highlighting, icons, snippets, comments,
bracket pairs and indentation. These features work without Java. In a trusted
local workspace, an explicitly configured Java server adds official diagnostics
and document formatting.

## Install and connect the server

1. Install the review VSIX with **Extensions: Install from VSIX…**.
2. Install a Java 21 JDK separately. The extension never installs Java.
3. In a checkout of [tuprel/tuprel](https://github.com/tuprel/tuprel) at
   commit ad0c9c6898f5d924f725b6a6c49ac78ade272849 or a compatible revision,
   build the server yourself. On Windows run
   gradlew.bat :tuprel-language-server:installDist. On macOS or Linux run
   ./gradlew :tuprel-language-server:installDist.
4. Set two absolute paths in VS Code **User Settings**. Use java.exe on
   Windows and java on macOS or Linux. The distribution path is the
   directory containing lib/, typically
   tuprel-language-server/build/install/tuprel-language-server.

```json
{
  "tuprel.server.javaPath": "/absolute/path/to/jdk-21/bin/java",
  "tuprel.server.distributionPath": "/absolute/path/to/tuprel-language-server"
}
```

Use forward slashes in Windows JSON paths, or escape backslashes. Choose a
distribution and JDK you trust and keep them outside untrusted projects.
The client does not search PATH or the workspace. Restart manually with
**TUPREL: Restart Language Server** after repairing an installation.
If a server cannot start or exits unexpectedly, highlighting and snippets
remain available. Check that your configured Java runs, that the distribution
contains its lib jars and that the workspace is trusted and local.

## Diagnostics and formatting

Open a file containing:

```tuprel
model Product {
    id UUID @id
    name MissingType
}
```

The Problems panel displays the compiler's unknown-type error and its
TUPREL-SCHEMA-SEM code. Change MissingType to String to clear the error
without saving. The server also reports lexer and parser errors. Type
model, enum, generator or datasource and use **Insert Snippet** to expand
an existing syntax snippet.

Use **Format Document** from the Command Palette. To opt into Format on Save,
enable it in VS Code. For TUPREL only:

```json
{
  "[tuprel]": {
    "editor.defaultFormatter": "tuprel.tuprel-vscode",
    "editor.formatOnSave": true
  }
}
```

Formatting follows RFC-001: four spaces and LF, so the official replacement
can convert CRLF to LF. VS Code controls the encoding and line-ending mode
used when writing a file. An invalid document or an unavailable server
produces no changes. The extension discards results if the document changes
or closes while formatting is in progress.

## Workspace restrictions

Restricted Mode, virtual workspaces and remote extension hosts retain
declarative syntax and snippets. The extension starts Java only in a
trusted local context. User settings control both launch paths. Transport
uses local stdio. The extension collects no telemetry and runs no build or
migration commands. Diagnostics and formatting are provided by the official
Java implementation. Contextual completion, hover and navigation are future
phases.

Apache-2.0. Third-party notices are included with the bundled runtime.
