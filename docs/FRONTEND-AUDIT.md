# Official frontend inspection

Source: `tuprel/tuprel@ae3776c28c328c7f6472df1f32f832d17b9f282a`.
No upstream files were modified. Inspected Lexer, Parser, SemanticValidator,
SchemaCompiler, SchemaFormatter, SourceText and formatter tests.

The lexer reserves only model, enum, datasource, generator, true and false.
Identifiers use ASCII letters/underscore and then ASCII digits. Numbers are
integers (including negative integers); Decimal is a field type, not evidence
for a floating-point literal syntax. Strings use double quotes and support
backslash, quote, n/r/t and four-digit Unicode escapes. They stop at newline.
Comments are line and non-nested block comments. The grammar reflects these
facts; unsupported attributes do not receive the supported-attribute scope.

SemanticValidator recognizes String, Boolean, Short, Int, Long, Decimal, Float,
Double, UUID, Instant, LocalDateTime, LocalDate, LocalTime, Bytes and Json;
field attributes id/unique/default/relation/version and block index/unique.
Datasource properties are provider/url; generator property is package.
Syntax classification is not validation of argument combinations.

SchemaCompiler performs lexing, parsing, then semantic validation only if syntax
has no diagnostics. Formatting first validates and refuses invalid input.
Without comments, SchemaFormatter prints an AST. With comments it strips and
reindents lines and tokenizes some lines independently. The second path is not
an AST-based comment-preserving printer. It normalizes CRLF to LF and strips
whitespace inside multiline comments; preserving comment text is not guaranteed.

SourceText stores UTF-16 offsets but exposes one-based code-point columns.
A future LSP must derive positions from offsets and line starts, not subtract
one from the existing columns.

A read-only Java probe is included under tools. It compiles only the official
schema module plus the probe into a temporary directory. No Gradle wrapper,
database or network is invoked. On this environment `javac` is absent from PATH
but the JDK compiler module is present:

```sh
mkdir -p /tmp/tuprel-audit-classes
java -m jdk.compiler/com.sun.tools.javac.Main -d /tmp/tuprel-audit-classes \
  $(rg --files ../tuprel-source/tuprel-schema/src/main/java -g '*.java') \
  tools/FormatterAudit.java
java -cp /tmp/tuprel-audit-classes dev.tuprel.schema.FormatterAudit
```

Initial probe: nine valid cases preserved non-comment token values and were
idempotent; empty, syntax-invalid and semantic-invalid inputs were refused.
Exact comment-token comparisons failed in cases 3 and 11 (multiline comments):
leading whitespace inside the comment was changed. This is a confirmed comment
fidelity issue, even though non-comment tokens were preserved. A separate core
regression/fix PR is required before enabling automatic formatting. These checks
do not prove full semantic equivalence. See the
integration plan for the mandatory formatter gate before editor integration.
The current official ADR is Java 21; it remains unchanged.
