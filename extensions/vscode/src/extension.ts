import * as vscode from 'vscode';
import { documentSelector, permitsServer } from './documents';
import { Session } from './session';

let session: Session | undefined;
let queue = Promise.resolve();
let disposed = false;

function enqueue(action: () => Promise<void>): Promise<void> {
    queue = queue.then(action).catch(() => {
        if (!disposed) {
            void vscode.window.showWarningMessage('TUPREL language server could not complete the operation. Syntax remains available.');
        }
    });
    return queue;
}

async function stop(): Promise<void> {
    const previous = session;
    session = undefined;
    await previous?.stop();
}

async function restart(): Promise<void> {
    await stop();
    const schemes = (vscode.workspace.workspaceFolders ?? []).map(folder => folder.uri.scheme);
    if (disposed || !permitsServer(vscode.workspace.isTrusted, vscode.env.remoteName, schemes)) {
        return;
    }
    const settings = vscode.workspace.getConfiguration('tuprel.server');
    const java = settings.inspect<string>('javaPath')?.globalValue;
    const distribution = settings.inspect<string>('distributionPath')?.globalValue;
    if (!java || !distribution) {
        void vscode.window.showInformationMessage(
            'TUPREL syntax is available. Configure Java 21 and the official server distribution in User Settings for language intelligence.');
        return;
    }
    const current = new Session(java, distribution, () => {
        void enqueue(async () => {
            if (session === current) {
                await stop();
                void vscode.window.showWarningMessage(
                    'TUPREL language server stopped. Check the Java 21 installation and run TUPREL: Restart Language Server.');
            }
        });
    });
    session = current;
    try {
        await current.start();
    } catch {
        await stop();
        void vscode.window.showWarningMessage(
            'TUPREL language server could not start. Check the Java 21 executable and official server distribution in User Settings.');
    }
}

export function activate(context: vscode.ExtensionContext): Promise<void> {
    context.subscriptions.push(
        vscode.commands.registerCommand('tuprel.restartLanguageServer', () => enqueue(restart)),
        vscode.workspace.onDidGrantWorkspaceTrust(() => { void enqueue(restart); }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => { void enqueue(restart); }),
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('tuprel.server')) {
                void enqueue(restart);
            }
        }),
    );
    if (!vscode.workspace.textDocuments.some(document => vscode.languages.match(documentSelector, document))) {
        const listener = vscode.workspace.onDidOpenTextDocument(document => {
            if (vscode.languages.match(documentSelector, document)) {
                listener.dispose();
                void enqueue(restart);
            }
        });
        context.subscriptions.push(listener);
        return Promise.resolve();
    }
    return enqueue(restart);
}

export function deactivate(): Promise<void> {
    disposed = true;
    return enqueue(stop);
}
