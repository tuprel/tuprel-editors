const fs = require('node:fs');
const path = require('node:path');
const lock = require('../package-lock.json');
const names = Object.entries(lock.packages)
    .filter(([name, pkg]) => name.startsWith('node_modules/') && !pkg.dev)
    .map(([name]) => name);
const notices = names.map(name => {
    const directory = path.join(__dirname, '..', name);
    const metadata = JSON.parse(fs.readFileSync(path.join(directory, 'package.json')));
    const file = fs.readdirSync(directory).find(item => /^licen[cs]e(?:\.|$)/i.test(item));
    if (!file) throw new Error('Missing bundled license: ' + name);
    return [metadata.name + '@' + metadata.version + ' (' + metadata.license + ')',
        fs.readFileSync(path.join(directory, file), 'utf8').trimEnd()].join('\n\n');
});
fs.writeFileSync(path.join(__dirname, '../extensions/vscode/dist/THIRD-PARTY-LICENSES.txt'),
    notices.join('\n\n' + '-'.repeat(72) + '\n\n') + '\n');
