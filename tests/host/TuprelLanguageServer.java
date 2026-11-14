package dev.tuprel.lsp;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import java.io.BufferedInputStream;
import java.io.EOFException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

public final class TuprelLanguageServer {
    private static final Gson JSON = new GsonBuilder().serializeNulls().create();
    private static final BufferedInputStream INPUT = new BufferedInputStream(System.in);

    public static void main(String[] args) throws Exception {
        Path control = Path.of(System.getenv("TUPREL_TEST_ROOT"));
        Files.writeString(control.resolve("mock.pid"), Long.toString(ProcessHandle.current().pid()));
        JsonObject delayed = null;
        String uri = null;
        int version = 0;
        for (JsonObject message; (message = read()) != null;) {
            String method = message.get("method").getAsString();
            JsonObject params = message.getAsJsonObject("params");
            switch (method) {
                case "initialize" -> respond(message,
                    "{\"capabilities\":{\"textDocumentSync\":{\"openClose\":true,\"change\":1},\"documentFormattingProvider\":true}}");
                case "textDocument/didOpen" -> {
                    JsonObject document = params.getAsJsonObject("textDocument");
                    uri = document.get("uri").getAsString();
                    version = document.get("version").getAsInt();
                }
                case "textDocument/formatting" -> {
                    delayed = message;
                    Files.writeString(control.resolve("mock.request"), "received");
                }
                case "textDocument/didChange" -> {
                    if (delayed != null) {
                        JsonObject notification = JSON.fromJson("""
                            {"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{
                              "diagnostics":[{"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},
                                "message":"stale","code":"STALE","source":"tuprel"}]}}
                            """, JsonObject.class);
                        notification.getAsJsonObject("params").addProperty("uri", uri);
                        notification.getAsJsonObject("params").addProperty("version", version);
                        write(notification);
                        respond(delayed, """
                            [{"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":1}},"newText":"!"}]
                            """);
                        delayed = null;
                    }
                }
                case "shutdown" -> respond(message, "null");
                case "exit" -> {
                    Files.writeString(control.resolve("mock.exit"), "graceful");
                    return;
                }
                default -> { }
            }
        }
    }

    private static JsonObject read() throws IOException {
        StringBuilder header = new StringBuilder();
        while (!header.toString().endsWith("\r\n\r\n")) {
            int value = INPUT.read();
            if (value < 0) {
                if (header.isEmpty()) return null;
                throw new EOFException();
            }
            header.append((char) value);
        }
        int length = Integer.parseInt(header.toString().split("\r\n")[0].split(": ")[1]);
        return JSON.fromJson(new String(INPUT.readNBytes(length), StandardCharsets.UTF_8), JsonObject.class);
    }

    private static void respond(JsonObject request, String result) throws IOException {
        JsonObject response = new JsonObject();
        response.addProperty("jsonrpc", "2.0");
        response.add("id", request.get("id"));
        response.add("result", com.google.gson.JsonParser.parseString(result));
        write(response);
    }

    private static void write(JsonObject message) throws IOException {
        byte[] bytes = JSON.toJson(message).getBytes(StandardCharsets.UTF_8);
        System.out.write(("Content-Length: " + bytes.length + "\r\n\r\n").getBytes(StandardCharsets.US_ASCII));
        System.out.write(bytes);
        System.out.flush();
    }
}
