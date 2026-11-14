import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { realpath, stat } from 'node:fs/promises';
import * as path from 'node:path';

export async function launch(javaPath: string, distributionPath: string): Promise<ChildProcessWithoutNullStreams> {
    if (!path.isAbsolute(javaPath) || !path.isAbsolute(distributionPath)
        || path.basename(javaPath).toLowerCase() !== (process.platform === 'win32' ? 'java.exe' : 'java')) {
        throw new Error('Configure absolute paths to Java 21 and the TUPREL server distribution.');
    }
    const java = await realpath(javaPath);
    const lib = await realpath(path.join(distributionPath, 'lib'));
    for (const entry of [java, path.join(lib, 'tuprel-language-server.jar'), path.join(lib, 'tuprel-schema.jar')]) {
        if (!(await stat(entry)).isFile()) {
            throw new Error('Incomplete Java or TUPREL server installation.');
        }
    }
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
        if (['JAVA_TOOL_OPTIONS', 'JDK_JAVA_OPTIONS', '_JAVA_OPTIONS', 'CLASSPATH'].includes(key.toUpperCase())) {
            delete env[key];
        }
    }
    const child = spawn(java, ['-cp', path.join(lib, '*'), 'dev.tuprel.lsp.TuprelLanguageServer'], {
        cwd: lib,
        env,
        shell: false,
        windowsHide: true,
        stdio: 'pipe',
    });
    // Never forward JVM stderr, which can include local paths and inherited environment details.
    child.stderr.resume();
    return new Promise((resolve, reject) => {
        child.on('error', reject);
        child.once('spawn', () => resolve(child));
    });
}

export async function stopProcess(child: ChildProcessWithoutNullStreams): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) {
        return;
    }
    await new Promise<void>(resolve => {
        const timer = setTimeout(() => {
            child.kill('SIGKILL');
        }, 1000);
        child.once('exit', () => {
            clearTimeout(timer);
            resolve();
        });
        child.stdin.end();
    });
}
