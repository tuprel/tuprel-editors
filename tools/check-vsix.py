"""Verify the actual review artifact, including its manifest and grammar."""
import json
from pathlib import Path
from zipfile import ZipFile

artifact = Path('artifacts/tuprel-vscode-0.1.0.vsix')
with ZipFile(artifact) as archive:
    names = set(archive.namelist())
    required = {'[Content_Types].xml', 'extension.vsixmanifest',
                'extension/package.json', 'extension/language-configuration.json',
                'extension/syntaxes/tuprel.tmLanguage.json',
                'extension/snippets/tuprel.json', 'extension/icons/tuprel-light.svg',
                'extension/icons/tuprel-dark.svg', 'extension/readme.md',
                'extension/LICENSE.txt'}
    assert required <= names, required - names
    assert not any('node_modules/' in n or n.endswith(('.jar', '.js', '.exe')) for n in names)
    manifest = json.loads(archive.read('extension/package.json'))
    assert manifest['contributes']['languages'][0]['extensions'] == ['.tuprel']
    assert 'main' not in manifest
    for packaged, source in [('extension/syntaxes/tuprel.tmLanguage.json', 'syntaxes/tuprel.tmLanguage.json'),
                              ('extension/snippets/tuprel.json', 'snippets/tuprel.json')]:
        assert archive.read(packaged) == (Path('extensions/vscode') / source).read_bytes()
    print(f'PASS: {len(names)} packaged files; required assets present; no executable payload')
