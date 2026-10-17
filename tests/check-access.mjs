import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { PERSONAL_ACCOUNTS_ENABLED, personalAccessUnavailable } from '../lib/app-access.ts';
assert.equal(PERSONAL_ACCOUNTS_ENABLED, false, 'A etapa de frontend deve permanecer em demonstração até a integração do login.');
globalThis.__zeloBlockedResponse = personalAccessUnavailable;
try {
  for (const name of ['finance', 'savings', 'profile']) {
    const source = 'const PERSONAL_ACCOUNTS_ENABLED = false; const personalAccessUnavailable = globalThis.__zeloBlockedResponse;\n' + readFileSync(new URL(`../app/api/${name}/route.ts`, import.meta.url), 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      transformers: { before: [() => node => ts.factory.updateSourceFile(node, node.statements.filter(statement => !ts.isImportDeclaration(statement)))] },
    }).outputText;
    const handlers = await import('data:text/javascript;base64,' + Buffer.from(output).toString('base64'));
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      if (typeof handlers[method] !== 'function') continue;
      const response = await handlers[method](new Request(`http://zelo.local/api/${name}`, { method, headers: { 'Content-Type': 'application/json' }, ...(method === 'GET' ? {} : { body: JSON.stringify({ email:'private@example.test' }) }) }));
      assert.equal(response.status, 503, `${name} ${method}`);
      assert.match(response.headers.get('cache-control'), /private.*no-store/);
      assert.match((await response.json()).error, /cadastro e login/);
    }
  }
  console.log('Modo demonstração: todas as operações pessoais bloqueadas antes da autenticação e do banco.');
} finally { delete globalThis.__zeloBlockedResponse; }
