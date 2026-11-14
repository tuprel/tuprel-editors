import { downloadAndUnzipVSCode, resolveCliPathFromVSCodeExecutablePath } from '@vscode/test-electron';
import { execFileSync, spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

async function run(): Promise<void> {
    const executable = process.env.TUPREL_TEST_VSCODE ?? await downloadAndUnzipVSCode({version: '1.85.2'});
    const java = process.env.TUPREL_TEST_JAVA;
    const distribution = process.env.TUPREL_TEST_DISTRIBUTION;
    if (!java || !distribution || !path.isAbsolute(java) || !path.isAbsolute(distribution)) {
        throw new Error('Set TUPREL_TEST_JAVA and TUPREL_TEST_DISTRIBUTION to explicit absolute paths.');
    }
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tuprel-host-'));
    const extensions = path.join(root, 'extensions');
    const artifact = path.resolve('artifacts/tuprel-vscode-0.1.0.vsix');
    const mock = path.join(root, 'mock');
    const mockLib = path.join(mock, 'lib');
    const officialLib = path.join(distribution, 'lib');
    const gson = (await fs.readdir(officialLib)).find(name => /^gson-.*\.jar$/.test(name));
    if (!gson) throw new Error('Could not locate Gson in the pinned server distribution.');
    await fs.mkdir(mockLib, {recursive: true});
    for (const name of [gson, 'tuprel-schema.jar']) {
        await fs.copyFile(path.join(officialLib, name), path.join(mockLib, name));
    }
    const suffix = process.platform === 'win32' ? '.exe' : '';
    const classes = path.join(mock, 'classes');
    await fs.mkdir(classes);
    execFileSync(path.join(path.dirname(java), 'javac' + suffix), [
        '--release', '21', '-cp', path.join(mockLib, gson), '-d', classes, 'tests/host/TuprelLanguageServer.java',
    ], {stdio: 'inherit'});
    execFileSync(path.join(path.dirname(java), 'jar' + suffix), [
        '--create', '--file', path.join(mockLib, 'tuprel-language-server.jar'), '-C', classes, '.',
    ], {stdio: 'inherit'});
    for (const mode of ['trusted', 'restricted', 'delayed']) {
        const user = path.join(root, mode);
        const settings = path.join(user, 'User');
        const profile = ['--user-data-dir', user, '--extensions-dir', extensions];
        await fs.mkdir(settings, { recursive: true });
        await fs.writeFile(path.join(settings, 'settings.json'), JSON.stringify({
            'tuprel.server.javaPath': java,
            'tuprel.server.distributionPath': mode === 'delayed' ? mock : distribution,
            'security.workspace.trust.startupPrompt': 'never',
            'security.workspace.trust.emptyWindow': false,
            'telemetry.telemetryLevel': 'off',
            'extensions.autoUpdate': false,
            'extensions.autoCheckUpdates': false,
            'update.mode': 'none',
        }));
        if (mode === 'trusted') {
            const cli = resolveCliPathFromVSCodeExecutablePath(executable);
            await new Promise<void>((resolve, reject) => {
                const win = process.platform === 'win32';
                const args = ['--install-extension', artifact, ...profile];
                const child = spawn(win ? '"' + cli + '"' : cli,
                    win ? args.map(arg => '"' + arg + '"') : args,
                    {shell: win, stdio: 'inherit', windowsHide: true});
                child.once('error', reject);
                child.once('close', code => code === 0
                    ? resolve() : reject(new Error('VSIX installation failed: ' + code)));
            });
        }
        const installed = (await fs.readdir(extensions)).find(name => name.startsWith('tuprel.tuprel-vscode-0.1.0'));
        if (!installed) {
            throw new Error('The VSIX is missing from the isolated extensions directory.');
        }
        console.log('Isolated VS Code test profile: ' + user);
        await new Promise<void>((resolve, reject) => {
            const child = spawn(executable, [
                ...profile, '--no-sandbox', '--disable-gpu', '--skip-welcome', '--skip-release-notes',
                '--disable-updates', '--new-window',
                ...(mode !== 'restricted' ? ['--disable-workspace-trust'] : []),
                '--extensionDevelopmentPath=' + path.join(extensions, installed),
                '--extensionTestsPath=' + path.resolve('dist/tests/host/suite.js'),
            ], {stdio: 'inherit', env: {...process.env, TUPREL_TEST_MODE: mode, TUPREL_TEST_ROOT: root}});
            const timer = setTimeout(() => child.kill('SIGKILL'), 120_000);
            child.once('error', reject);
            child.once('close', code => {
                clearTimeout(timer);
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error('VS Code host test failed in ' + mode + ' mode: ' + code));
                }
            });
        });
    }
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
