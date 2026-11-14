"""Check the exact package allowlist and the bundled client payload."""
import json
from pathlib import Path
from zipfile import ZipFile

source_root = Path('extensions/vscode')
project = json.loads((source_root / 'package.json').read_text(encoding='utf-8'))
artifact = Path('artifacts') / f"{project['name']}-{project['version']}.vsix"
with ZipFile(artifact) as archive:
    names = set(archive.namelist())
    assets = {
        'language-configuration.json', 'syntaxes/tuprel.tmLanguage.json',
        'snippets/tuprel.json', 'icons/tuprel-light.svg', 'icons/tuprel-dark.svg',
        'dist/extension.js', 'dist/THIRD-PARTY-LICENSES.txt',
    }
    required = {'[Content_Types].xml', 'extension.vsixmanifest', 'extension/package.json',
                'extension/readme.md', 'extension/LICENSE.txt', 'extension/changelog.md'}
    required |= {f'extension/{name}' for name in assets}
    assert names == required, (required - names, names - required)
    assert archive.testzip() is None
    manifest = json.loads(archive.read('extension/package.json'))
    assert manifest['main'] == './dist/extension.js'
    assert manifest['contributes']['languages'][0]['extensions'] == ['.tuprel']
    for name in assets:
        assert archive.read(f'extension/{name}') == (source_root / name).read_bytes(), name
    legal = archive.read('extension/dist/THIRD-PARTY-LICENSES.txt')
    assert b'Microsoft' in legal
    print(f'PASS: {len(names)} files, bundled client and license notices verified')
