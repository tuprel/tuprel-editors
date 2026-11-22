import { downloadAndUnzipVSCode, resolveCliPathFromVSCodeExecutablePath } from '@vscode/test-electron';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
    const incompatible = process.env.TUPREL_TEST_BAD_JAVA;
    if (!incompatible || !path.isAbsolute(incompatible)) throw new Error('Set TUPREL_TEST_BAD_JAVA to an actual Java 11 executable.');
    const identity = spawnSync(java, ['-XshowSettings:properties', '-version'], {encoding: 'utf8', timeout: 10_000});
    const version = /java.specification.version = (17|21|25)\b/.exec(identity.stdout + identity.stderr)?.[1];
    if (identity.status !== 0 || !version || (process.env.TUPREL_TEST_CELL && process.env.TUPREL_TEST_CELL !== 'java' + version)) {
        throw new Error('The selected JVM does not match the certification cell.');
    }
    const badIdentity = spawnSync(incompatible, ['-XshowSettings:properties', '-version'], {encoding: 'utf8', timeout: 10_000});
    if (badIdentity.status !== 0 || !/java.specification.version = 11\b/.test(badIdentity.stdout + badIdentity.stderr)) {
        throw new Error('The incompatible-JVM fixture must actually run Java 11.');
    }
    const refusal = spawnSync(incompatible, ['-cp', path.join(distribution, 'lib', '*'), 'dev.tuprel.lsp.TuprelLanguageServer'],
        {encoding: 'utf8', timeout: 10_000});
    if (refusal.status === null || refusal.status === 0 || refusal.error || !refusal.stderr?.includes('UnsupportedClassVersionError')) {
        throw new Error('The installed server must refuse the real incompatible JVM.');
    }
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'tuprel-host-external consumer '));
    const extensions = path.join(root, 'extensions');
    const artifact = path.resolve('artifacts/tuprel-vscode-0.1.0.vsix');
    const inventory: Record<string, string> = {};
    for (const name of (await fs.readdir(path.join(distribution, 'lib'))).sort()) {
        inventory[name] = createHash('sha256').update(await fs.readFile(path.join(distribution, 'lib', name))).digest('hex');
    }
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
        '--release', '17', '-cp', path.join(mockLib, gson), '-d', classes, 'tests/host/TuprelLanguageServer.java',
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
    const evidence = path.resolve('artifacts', 'd2-' + (process.env.TUPREL_TEST_CELL ?? 'local'));
    await fs.mkdir(evidence, {recursive: true});
    await fs.copyFile(path.join(root, 'servers.jsonl'), path.join(evidence, 'servers.jsonl'));
    const finalNames = (await fs.readdir(path.join(distribution, 'lib'))).sort();
    if (JSON.stringify(finalNames) !== JSON.stringify(Object.keys(inventory))) throw new Error('Server distribution inventory changed.');
    for (const name of finalNames) {
        if (createHash('sha256').update(await fs.readFile(path.join(distribution, 'lib', name))).digest('hex') !== inventory[name]) {
            throw new Error('Installed server bytes changed during the Extension Host proof.');
        }
    }
    await fs.writeFile(path.join(evidence, 'identity.json'), JSON.stringify({
        serverRevision: process.env.TUPREL_TEST_SERVER_REVISION,
        jvm: identity.stdout + identity.stderr, incompatibleJvm: badIdentity.stdout + badIdentity.stderr,
        incompatibleRefused: true, version, inventory,
        vsix: createHash('sha256').update(await fs.readFile(artifact)).digest('hex'),
    }, null, 2) + '\n');
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
