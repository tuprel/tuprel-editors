# Core issue draft: preserve multiline comment content in SchemaFormatter

Target: tuprel/tuprel, separate core branch/PR. Not filed remotely or fixed here.
Reproduced against ae3776c28c328c7f6472df1f32f832d17b9f282a using the official
schema frontend. No core files changed. Formatting must remain unavailable in
this extension until the core regression is addressed.

Input:

```tuprel
/* block
 * detail
 */
model Product { id UUID @id }
```

Current output:

```tuprel
/* block
* detail
*/
model Product { id UUID @id }
```

Unexpected: leading spaces inside the block comment disappear. The formatter's
comment path calls strip() on each line, changing comment-token content. The
same problem appears in multiline comments between field attributes. The probe
found no change to non-comment token values for these cases; this does not prove
full semantic equivalence or justify changing comments.

Expected: preserve comment content and order, including interior whitespace,
while formatting surrounding code. Refuse invalid schemas with no edits.

Regression tests required in tuprel-schema: exact comment-token equality for
standalone and inline multiline comments, tabs and intentional alignment,
comments between attributes, strings containing comment delimiters and escaped
quotes, relations/lists/arguments, CRLF/LF, empty and invalid input, second-pass
idempotence and semantic equivalence excluding positions.

Reproduction: compile the pinned schema sources plus tools/FormatterAudit.java
as documented in FRONTEND-AUDIT.md. Cases 3 and 11 report exactComments=false.
The newly executed visible-whitespace example is saved in
`docs/evidence/recovery/formatter-reproduction.txt`. No Java code from core is
copied into or modified by the extension.
