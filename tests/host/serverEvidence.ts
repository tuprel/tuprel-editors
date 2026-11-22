import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

interface ServerProcess {
    pid: number;
    parent: number;
    executable: string;
    command: string;
}

export async function servers(): Promise<ServerProcess[]> {
    if (process.platform === 'win32') {
        const powershell = path.join(process.env.SystemRoot!, 'System32/WindowsPowerShell/v1.0/powershell.exe');
        const output = execFileSync(powershell, ['-NoProfile', '-NonInteractive', '-Command',
            `Get-CimInstance Win32_Process -Filter "ParentProcessId=${process.pid}" | Select-Object ProcessId,ParentProcessId,ExecutablePath,CommandLine | ConvertTo-Json -Compress`,
        ], {encoding: 'utf8', windowsHide: true, timeout: 10_000});
        const value = output.trim() ? JSON.parse(output) : [];
        return (Array.isArray(value) ? value : [value]).filter(item =>
            item.CommandLine?.includes('dev.tuprel.lsp.TuprelLanguageServer')).map(item => ({
            pid: item.ProcessId, parent: item.ParentProcessId,
            executable: item.ExecutablePath, command: item.CommandLine,
        }));
    }
    if (process.platform === 'linux') {
        const children: ServerProcess[] = [];
        for (const name of await fs.readdir('/proc')) {
            if (!/^\d+$/.test(name)) continue;
            let status: string;
            try { status = await fs.readFile(`/proc/${name}/status`, 'utf8'); }
            catch { continue; } // Another process may exit during enumeration.
            if (!new RegExp(`^PPid:\\s+${process.pid}$`, 'm').test(status)) continue;
            const command = (await fs.readFile(`/proc/${name}/cmdline`, 'utf8')).replaceAll('\0', ' ');
            if (!command.includes('dev.tuprel.lsp.TuprelLanguageServer')) continue;
            children.push({pid: Number(name), parent: process.pid,
                executable: await fs.realpath(`/proc/${name}/exe`), command});
        }
        return children;
    }
    const output = execFileSync('/bin/ps', ['-axo', 'pid=,ppid=,command='], {encoding: 'utf8', timeout: 10_000});
    return output.split('\n').flatMap(line => {
        const match = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(line);
        return match && Number(match[2]) === process.pid && match[3].includes('dev.tuprel.lsp.TuprelLanguageServer')
            ? [{pid: Number(match[1]), parent: Number(match[2]), executable: process.env.TUPREL_TEST_JAVA!, command: match[3]}] : [];
    });
}

export async function recordServer(): Promise<number> {
    const selected = await servers();
    assert.equal(selected.length, 1, 'one official server must be a direct child of the Extension Host');
    const server = selected[0];
    const expected = await fs.realpath(process.env.TUPREL_TEST_JAVA!);
    const actual = await fs.realpath(server.executable);
    assert.equal(process.platform === 'win32' ? actual.toLowerCase() : actual,
        process.platform === 'win32' ? expected.toLowerCase() : expected, 'selected JVM must match the OS process');
    const lib = await fs.realpath(path.join(process.env.TUPREL_TEST_DISTRIBUTION!, 'lib'));
    assert(server.command.includes(lib), 'server must use the installed distribution classpath');
    assert(server.command.includes('-cp'), 'the extension must launch its stdio classpath entry point');
    await fs.appendFile(path.join(process.env.TUPREL_TEST_ROOT!, 'servers.jsonl'), JSON.stringify(server) + '\n');
    console.log('PASS: OS process identity matches the configured JVM and installed stdio server (PID ' + server.pid + ')');
    return server.pid;
}

export async function exited(pid: number): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt++) {
        try { process.kill(pid, 0); }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ESRCH') return;
            throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('The previous language server process survived shutdown: ' + pid);
}
