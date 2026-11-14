import * as vscode from 'vscode';
import {
    CloseAction, DocumentFormattingRequest, ErrorAction, LanguageClient,
    PublishDiagnosticsNotification, State,
} from 'vscode-languageclient/node';
import { documentSelector, isCurrent } from './documents';
import { launch, stopProcess } from './serverProcess';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';

interface Snapshot {
    document: vscode.TextDocument;
    editorVersion: number;
    wireVersion: number;
}

export class Session {
    private readonly client: LanguageClient;
    private readonly snapshots = new Map<string, Snapshot>();
    private readonly resources: vscode.Disposable[] = [];
    private readonly diagnostics = vscode.languages.createDiagnosticCollection('tuprel');
    private process?: ChildProcessWithoutNullStreams;
    private nextVersion = 0;
    private closed = false;

    constructor(java: string, distribution: string, failed: () => void) {
        // Own synchronization to correlate versioned diagnostics across close/reopen.
        // The stock client's diagnostic middleware receives diagnostics after version is discarded.
        this.client = new LanguageClient('tuprel', 'TUPREL', async () => {
            const child = await launch(java, distribution);
            if (this.closed) {
                await stopProcess(child);
                throw new Error("TUPREL session already stopped.");
            }
            this.process = child;
            return { reader: child.stdout, writer: child.stdin };
        }, {
            documentSelector: [],
            initializationFailedHandler: () => false,
            errorHandler: {
                error: () => ({ action: ErrorAction.Shutdown, handled: true }),
                closed: () => ({ action: CloseAction.DoNotRestart, handled: true }),
            },
        });
        this.client.onNotification(PublishDiagnosticsNotification.type, params => {
            const snapshot = this.snapshots.get(params.uri);
            if (snapshot && params.version === snapshot.wireVersion
                && isCurrent(snapshot.document, snapshot.editorVersion)) {
                this.diagnostics.set(snapshot.document.uri,
                    params.diagnostics.map(value => this.client.protocol2CodeConverter.asDiagnostic(value)));
            }
        });
        this.client.onRequest('workspace/applyEdit', () => ({ applied: false }));
        this.client.onRequest('window/showDocument', () => ({ success: false }));
        this.client.onRequest('client/registerCapability', () => undefined);
        this.client.onRequest('client/registerFeature', () => undefined);
        this.resources.push(this.client.onDidChangeState(event => {
            if (event.newState === State.Stopped && !this.closed) {
                failed();
            }
        }));
    }

    async start(): Promise<void> {
        let timeout: NodeJS.Timeout | undefined;
        const deadline = new Promise<never>((_, reject) => {
            timeout = setTimeout(() => {
                this.process?.kill('SIGKILL');
                reject(new Error('TUPREL server initialization timed out.'));
            }, 10_000);
        });
        try {
            await Promise.race([this.client.start(), deadline]);
        } finally {
            clearTimeout(timeout);
        }
        const sync = this.client.initializeResult?.capabilities.textDocumentSync;
        const encoding = this.client.initializeResult?.capabilities.positionEncoding;
        if (typeof sync !== 'object' || sync.change !== 1 || !sync.openClose
            || (encoding !== undefined && encoding !== 'utf-16')) {
            throw new Error('Expected the official TUPREL server with full document synchronization.');
        }
        const track = (document: vscode.TextDocument, changed: boolean): void => {
            if (!vscode.languages.match(documentSelector, document)) {
                return;
            }
            const uri = document.uri.toString();
            const previous = this.snapshots.get(uri);
            if (changed && previous?.document !== document) {
                return;
            }
            const snapshot = {document, editorVersion: document.version, wireVersion: ++this.nextVersion};
            this.snapshots.set(uri, snapshot);
            this.diagnostics.delete(document.uri);
            const textDocument = {uri, version: snapshot.wireVersion};
            const text = document.getText();
            if (changed) {
                void this.notify('textDocument/didChange', {textDocument, contentChanges: [{text}]});
            } else {
                void this.notify('textDocument/didOpen', {textDocument: {...textDocument, languageId: 'tuprel', text}});
            }
        };
        this.resources.push(
            vscode.workspace.onDidOpenTextDocument(document => track(document, false)),
            vscode.workspace.onDidChangeTextDocument(event => {
                if (event.contentChanges.length > 0) {
                    track(event.document, true);
                }
            }),
            vscode.workspace.onDidCloseTextDocument(document => {
                const uri = document.uri.toString();
                if (this.snapshots.get(uri)?.document === document) {
                    this.snapshots.delete(uri);
                    this.diagnostics.delete(document.uri);
                    void this.notify('textDocument/didClose', {textDocument: {uri}});
                }
            }),
        );
        for (const document of vscode.workspace.textDocuments) {
            track(document, false);
        }
        if (this.client.initializeResult?.capabilities.documentFormattingProvider) {
            this.resources.push(vscode.languages.registerDocumentFormattingEditProvider(documentSelector, {
                provideDocumentFormattingEdits: async (document, options, token) => {
                    const uri = document.uri.toString();
                    const snapshot = this.snapshots.get(uri);
                    if (this.closed || token.isCancellationRequested || snapshot?.document !== document
                        || !isCurrent(document, snapshot.editorVersion)) {
                        return [];
                    }
                    try {
                        const edits = await this.client.sendRequest(DocumentFormattingRequest.type,
                            {textDocument: {uri}, options}, token);
                        const converted = await this.client.protocol2CodeConverter.asTextEdits(edits, token);
                        if (this.closed || token.isCancellationRequested || this.snapshots.get(uri) !== snapshot
                            || !isCurrent(document, snapshot.editorVersion)) {
                            return [];
                        }
                        return converted;
                    } catch {
                        // Retain the editor text on cancellation, failed RPC or disconnected server.
                        return [];
                    }
                },
            }));
        }
    }

    private async notify(method: string, params: object): Promise<void> {
        try {
            await this.client.sendNotification(method, params);
        } catch {
            // Disconnect is reported through the connection state.
        }
    }

    async stop(): Promise<void> {
        this.closed = true;
        this.resources.forEach(resource => resource.dispose());
        this.snapshots.clear();
        this.diagnostics.dispose();
        try {
            await this.client.dispose(1500);
        } finally {
            if (this.process) {
                await stopProcess(this.process);
            }
        }
    }
}
