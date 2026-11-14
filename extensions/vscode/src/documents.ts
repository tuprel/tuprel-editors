import * as vscode from 'vscode';

export const documentSelector: vscode.DocumentSelector = [
    { language: 'tuprel', scheme: 'file' },
    { language: 'tuprel', scheme: 'untitled' },
];

export function permitsServer(trusted: boolean, remote: string | undefined, schemes: readonly string[]): boolean {
    return trusted && remote === undefined && schemes.every(scheme => scheme === 'file');
}

export function isCurrent(document: vscode.TextDocument, version: number): boolean {
    return !document.isClosed && document.version === version && vscode.workspace.textDocuments.includes(document);
}
