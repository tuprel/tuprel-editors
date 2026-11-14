package dev.tuprel.schema;

import java.util.List;
import java.util.stream.Collectors;

/** Read-only probe against a separately compiled, pinned official frontend. */
public final class FormatterAudit {
    private static String meaning(String text) {
        return Lexer.lex(SourceText.of("probe", text)).tokens().stream()
                .filter(t -> t.kind() != Lexer.TokenKind.COMMENT)
                .map(t -> t.kind() + ":" + t.value()).collect(Collectors.joining("|"));
    }
    public static void main(String[] args) {
        String relation = "model User { id UUID @id posts Post[] }\nmodel Post { id UUID @id userId UUID user User @relation(fields: [userId], references: [id]) @@index([userId]) }";
        List<String> cases = List.of(
                "model Product{\nid UUID @id\nname String\n price Decimal\n}",
                "// comment\nmodel Product {\n id UUID @id\n name String\n}",
                "model Product {\n id UUID /* between */ @id\n name String @default(\"{/*x*/}//\")\n}",
                "/* block\n * detail\n */\nmodel Product { id UUID @id }",
                "// escapes\nmodel Product { id UUID @id name String @default(\"a\\\"b\\\\c\\n\\u0041\") }",
                relation, "// relations\n" + relation,
                "// CRLF\r\nmodel Product {\r\n id UUID @id\r\n}\r\n", "",
                "model Product {", "model Product {}",
                "model Product {\n id UUID /* multiline\n detail */ @id\n name String\n}");
        SchemaFormatter formatter = new SchemaFormatter();
        int index = 0;
        for (String text : cases) {
            boolean valid = new SchemaCompiler().compile(SourceText.of("probe", text)).isValid();
            SchemaFormatResult result = formatter.format(SourceText.of("probe", text));
            if (!valid) {
                if (result.formattedText().isPresent()) throw new AssertionError("Invalid input formatted");
                System.out.println(index++ + " INVALID_REFUSED");
                continue;
            }
            String once = result.formattedText().orElseThrow();
            SchemaFormatResult twice = formatter.format(SourceText.of("probe", once));
            boolean semantics = meaning(text).equals(meaning(once));
            List<String> commentsBefore = Lexer.lex(SourceText.of("probe", text)).tokens().stream()
                    .filter(t -> t.kind() == Lexer.TokenKind.COMMENT).map(Lexer.Token::text).toList();
            List<String> commentsAfter = Lexer.lex(SourceText.of("probe", once)).tokens().stream()
                    .filter(t -> t.kind() == Lexer.TokenKind.COMMENT).map(Lexer.Token::text).toList();
            boolean idempotent = twice.formattedText().map(once::equals).orElse(false);
            System.out.println(index++ + " semantics=" + semantics + " idempotent=" + idempotent
                    + " exactComments=" + commentsBefore.equals(commentsAfter));
        }
    }
}
