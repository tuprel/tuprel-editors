import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Registry, parseRawGrammar, INITIAL, type StateStack } from 'vscode-textmate';
import { loadWASM, OnigScanner, OnigString } from 'vscode-oniguruma';

const root = process.cwd();
const extension = path.join(root, 'extensions/vscode');
const read = (p: string) => fs.readFileSync(path.join(extension, p), 'utf8');
const wasm = fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
const ready = loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
async function tokenize(source: string) {
  await ready;
  const registry = new Registry({
    onigLib: Promise.resolve({createOnigScanner: (s: string[]) => new OnigScanner(s), createOnigString: (s: string) => new OnigString(s)}),
    loadGrammar: async () => parseRawGrammar(read('syntaxes/tuprel.tmLanguage.json'), 'tuprel.json')
  });
  const grammar = (await registry.loadGrammar('source.tuprel'))!;
  let state: StateStack = INITIAL;
  const tokens: {text: string; scopes: string[]}[] = [];
  for (const line of source.split(/\r\n|\n/)) {
    const result = grammar.tokenizeLine(line, state);
    state = result.ruleStack;
    tokens.push(...result.tokens.map(t => ({text: line.slice(t.startIndex, t.endIndex), scopes: t.scopes})));
  }
  registry.dispose();
  return tokens;
}
async function scope(source: string, text: string, expected: string) {
  const tokens = await tokenize(source);
  assert(tokens.some(t => t.text === text && t.scopes.includes(expected)), JSON.stringify(tokens));
}
test('declarations and identifiers', async () => {
  for (const keyword of ['model','enum','datasource','generator']) {
    await scope(`${keyword} Product {}`, keyword, 'keyword.declaration.tuprel');
    await scope(`${keyword} Product {}`, 'Product', 'entity.name.type.tuprel');
  }
  await scope('name String', 'name', 'variable.other.property.tuprel');
  await scope('owner User?', 'User', 'entity.name.type.tuprel');
});
test('all official scalar types retain type scopes in fields', async () => {
  for (const type of ['String','Boolean','Short','Int','Long','Decimal','Float','Double','UUID','Instant','LocalDateTime','LocalDate','LocalTime','Bytes','Json']) {
    await scope(`value ${type}`, type, 'storage.type.tuprel');
  }
});
test('only verified attributes and block attributes', async () => {
  for (const attribute of ['@id','@unique','@default','@relation','@version','@@index','@@unique']) {
    await scope(attribute, attribute, 'entity.other.attribute-name.tuprel');
  }
  const tokens = await tokenize('@map @@id @unknown');
  assert(!tokens.some(t => t.scopes.includes('entity.other.attribute-name.tuprel')));
});
test('booleans, negative integers, punctuation, optional and assignment', async () => {
  await scope('true false', 'true', 'constant.language.boolean.tuprel');
  await scope(' -42', '-42', 'constant.numeric.integer.tuprel');
  await scope('=', '=', 'keyword.operator.assignment.tuprel');
  await scope('?', '?', 'keyword.operator.optional.tuprel');
  for (const c of '{}[]()') await scope(c, c, 'punctuation.section.tuprel');
});
test('comments and strings isolate keywords and attribute-looking content', async () => {
  for (const source of ['// model User @id "x"', '/* model\n @id {} */', '"model { // /* @id 😀 é"']) {
    const tokens = await tokenize(source);
    assert(!tokens.some(t => t.scopes.some(s => s.startsWith('keyword.') || s.startsWith('entity.'))));
  }
  await scope('"a\\\"b\\\\c\\n\\u0041"', '\\"', 'constant.character.escape.tuprel');
  await scope('"\\q"', '\\q', 'invalid.illegal.escape.tuprel');
});
test('block comments resume; unterminated strings recover at newline', async () => {
  await scope('/* model */ model User {}', 'model', 'keyword.declaration.tuprel');
  await scope('"unfinished\nmodel User {}', 'model', 'keyword.declaration.tuprel');
});
test('LF and CRLF produce equivalent tokens; documents have independent state', async () => {
  const source = '/* é 😀\n model */\nmodel Product {\n id UUID @id\n}';
  assert.deepEqual(await tokenize(source), await tokenize(source.replaceAll('\n','\r\n')));
  await tokenize('/* unclosed');
  await scope('model Product {}', 'model', 'keyword.declaration.tuprel');
  assert.deepEqual(await tokenize(''), [{text:'',scopes:['source.tuprel']}]);
});
test('pinned upstream fixtures are unchanged and tokenize without modifying bytes', async () => {
  const entries = JSON.parse(fs.readFileSync('fixtures/provenance.json','utf8'));
  assert(entries.some((e: {pr?: number}) => e.pr === 103));
  for (const entry of entries) {
    const file = path.join('fixtures',entry.file);
    const before = fs.readFileSync(file);
    assert.equal(crypto.createHash('sha256').update(before).digest('hex'), entry.sha256);
    assert.match(entry.revision,/^[a-f0-9]{40}$/);
    await tokenize(before.toString());
    assert.deepEqual(fs.readFileSync(file), before);
  }
});
test('manifest preserves declarative support and restricts Java configuration', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.deepEqual(manifest.contributes.languages[0].extensions,['.tuprel']);
  assert.equal(manifest.main, "./dist/extension.js");
  assert.equal(manifest.dependencies, undefined);
  assert.equal(manifest.capabilities.untrustedWorkspaces.supported,'limited');
  assert.equal(manifest.capabilities.virtualWorkspaces.supported,'limited');
  for (const setting of Object.values(manifest.contributes.configuration.properties)) {
    assert.equal((setting as {scope: string}).scope, 'application');
  }
  for (const icon of Object.values(manifest.contributes.languages[0].icon)) assert(fs.existsSync(path.join(extension,icon as string)));
  const config = JSON.parse(read('language-configuration.json'));
  assert.deepEqual(config.comments,{lineComment:'//',blockComment:['/*','*/']});
  const snippets = JSON.parse(read('snippets/tuprel.json'));
  assert.deepEqual(Object.keys(snippets),['Model','Enum','Generator','Datasource']);
  assert(snippets.Generator.body.join('\n').includes('package ='));
});
