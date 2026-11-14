import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { permitsServer } from '../../extensions/vscode/src/documents';

const good = 'model User {\n    id Int @id\n}\n';
const malformed = 'model User{ id Int @id }';

function diagnostics(document: vscode.TextDocument): readonly vscode.Diagnostic[] {
    return vscode.languages.getDiagnostics(document.uri).filter(item => item.source === 'tuprel');
}

async function until(predicate: () => boolean, description: string): Promise<void> {
    for (let attempt = 0; attempt < 200; attempt++) {
        if (predicate()) {
            return;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Timed out: ' + description);
}

async function change(document: vscode.TextDocument, text: string): Promise<void> {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), text);
    assert(await vscode.workspace.applyEdit(edit));
}

function format(document: vscode.TextDocument): Thenable<vscode.TextEdit[] | undefined> {
    return vscode.commands.executeCommand('vscode.executeFormatDocumentProvider', document.uri,
        {tabSize: 2, insertSpaces: false});
}

export async function run(): Promise<void> {
    const root = process.env.TUPREL_TEST_ROOT!;
    const file = path.join(root, 'schema.tuprel');
    await fs.writeFile(file, '/* 🧪 */ $\r\n' + good.replaceAll('\n', '\r\n'));
    const first = await vscode.workspace.openTextDocument(file);
    assert.equal(first.languageId, 'tuprel');
    await vscode.window.showTextDocument(first);
    const extension = vscode.extensions.getExtension('tuprel.tuprel-vscode');
    assert(extension);
    await extension.activate();

    if (process.env.TUPREL_TEST_MODE === 'delayed') {
        const pending = format(first);
        await until(() => existsSync(path.join(root, 'mock.request')), 'server received formatting request');
        await change(first, malformed);
        assert.deepEqual(await pending ?? [], []);
        assert.equal(first.getText(), malformed);
        assert.equal(diagnostics(first).length, 0);
        const pid = Number(await fs.readFile(path.join(root, 'mock.pid'), 'utf8'));
        await vscode.workspace.getConfiguration('tuprel.server').update(
            'javaPath', undefined, vscode.ConfigurationTarget.Global);
        await vscode.commands.executeCommand('tuprel.restartLanguageServer');
        await until(() => {
            try { process.kill(pid, 0); return false; } catch (error) {
                return (error as NodeJS.ErrnoException).code === 'ESRCH';
            }
        }, 'Java process terminated');
        console.log('PASS: delayed diagnostics and edits discarded, Java process terminated after stop');
        return;
    }

    if (process.env.TUPREL_TEST_MODE === 'restricted') {
        assert.equal(vscode.workspace.isTrusted, false);
        assert.deepEqual(await format(first) ?? [], []);
        assert.equal(diagnostics(first).length, 0);
        const snippet = await vscode.workspace.openTextDocument({language: 'tuprel', content: ''});
        await vscode.window.showTextDocument(snippet);
        await vscode.commands.executeCommand('editor.action.insertSnippet', {langId: 'tuprel', name: 'Model'});
        assert.match(snippet.getText(), /model .*\{/);
        console.log('PASS: ' + process.env.TUPREL_TEST_MODE + ' workspace preserves syntax and snippets and disables the formatter');
        return;
    }

    await until(() => diagnostics(first).some(item => item.code === 'TUPREL-SCHEMA-LEX-001'), 'lexical diagnostic');
    const lexical = diagnostics(first).find(item => item.code === 'TUPREL-SCHEMA-LEX-001')!;
    assert.deepEqual([lexical.range.start.line, lexical.range.start.character], [0, 9]);
    assert.match(lexical.message, /Unexpected character/);
    await change(first, 'model');
    await until(() => diagnostics(first).some(item => String(item.code).startsWith('TUPREL-SCHEMA-PARSE-')), 'syntax diagnostic');
    assert.equal(permitsServer(true, undefined, ['tuprel-test']), false);
    assert.equal(permitsServer(true, 'ssh-remote', ['file']), false);
    const provider = vscode.workspace.registerTextDocumentContentProvider('tuprel-test', {
        provideTextDocumentContent: () => 'model User {}',
    });
    try {
        const virtual = await vscode.workspace.openTextDocument(vscode.Uri.parse('tuprel-test:/virtual.tuprel'));
        assert.equal(virtual.languageId, 'tuprel');
        assert.deepEqual(await format(virtual) ?? [], []);
        await format(first);
        assert.deepEqual(diagnostics(virtual), []);
    } finally {
        provider.dispose();
    }
    console.log('PASS: virtual document supports syntax without Java features; virtual workspace launch is denied');
    const second = await vscode.workspace.openTextDocument({language: 'tuprel', content: 'model Other { id Missing @id }'});
    await vscode.window.showTextDocument(second);
    await until(() => diagnostics(second).some(item => String(item.code).startsWith('TUPREL-SCHEMA-SEM-')), 'semantic diagnostic');
    assert.deepEqual(await format(second) ?? [], []);
    await change(first, 'model Invalid {}');
    await change(first, malformed);
    await until(() => diagnostics(first).length === 0, 'cleared diagnostics');
    await vscode.window.showTextDocument(first);
    await vscode.commands.executeCommand('editor.action.formatDocument');
    assert.equal(first.getText().replaceAll('\r\n', '\n'), good);
    assert.deepEqual(await format(first) ?? [], []);
    assert(diagnostics(second).length > 0);
    console.log('PASS: official lexical, syntax and semantic diagnostics, unsaved fixes, UTF-16, document isolation and Format Document');

    await change(first, '/* 🧪\n * keep this\n\n */\nmodel User{\n id Int @id\n}\n');
    const expected = '/* 🧪\n * keep this\n\n */\nmodel User {\n    id Int @id\n}\n';
    const editor = vscode.workspace.getConfiguration('editor');
    const languageScope = vscode.ConfigurationTarget.Global;
    await editor.update('formatOnSave', true, languageScope);
    assert(await first.save());
    assert.equal((await fs.readFile(file, 'utf8')).replaceAll('\r\n', '\n'), expected);
    await change(first, 'model User {}');
    assert(await first.save());
    assert.equal(await fs.readFile(file, 'utf8'), 'model User {}');
    await editor.update('formatOnSave', false, languageScope);
    console.log('PASS: Format on Save preserves comments and leaves invalid schemas unchanged');

    await vscode.window.showTextDocument(second);
    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
    await until(() => second.isClosed && diagnostics(second).length === 0, 'closed diagnostics');
    const config = vscode.workspace.getConfiguration('tuprel.server');
    await config.update('javaPath', path.join(root, process.platform === 'win32' ? 'java.exe' : 'java'), languageScope);
    await vscode.commands.executeCommand('tuprel.restartLanguageServer');
    assert.deepEqual(await format(first) ?? [], []);
    assert.equal(first.languageId, 'tuprel');
    await config.update('javaPath', undefined, languageScope);
    await vscode.commands.executeCommand('tuprel.restartLanguageServer');
    assert.deepEqual(await format(first) ?? [], []);
    console.log('PASS: closing clears diagnostics and missing or invalid Java retains syntax');
}
