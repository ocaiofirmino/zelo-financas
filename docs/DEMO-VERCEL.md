# Zelo: demonstração na Vercel

A branch **`demo/vercel`** contém uma versão estática e interativa para apresentar o projeto. Ela usa a interface real do Zelo com exemplos fictícios, sem login, banco de dados ou acesso às finanças pessoais. A versão original permanece na `main`.

## O que o visitante pode fazer

- Explorar o dashboard, lançamentos, cartão e demonstrativo, inclusive no celular.
- Adicionar, editar e excluir receitas e despesas de teste; marcar registros como pagos, recebidos ou previstos.
- Testar compras parceladas, metas de sobra e limites por categoria.
- Baixar extratos em Excel `.xlsx`, CSV e CSV organizado para importar no Power BI.
- Restaurar o estado inicial com **Reiniciar demonstração** ou recarregando a página.

As alterações ficam **apenas na memória da aba**. Cada visitante começa com os próprios exemplos; os testes não são compartilhados nem gravados em servidor ou `localStorage`. Fechar ou recarregar a aba descarta os testes. Os extratos já baixados continuam no dispositivo e têm `demonstracao` no nome.

O CSV para Power BI é uma tabela para importação. A demonstração não gera `.pbix` ou dashboards dentro do Power BI. O protótipo separado de login/cadastro não faz parte deste deploy.

## Configuração exata do projeto

Importe o repositório [ocaiofirmino/zelo-financas](https://github.com/ocaiofirmino/zelo-financas) na Vercel e use estes valores no projeto destinado à demonstração:

| Campo | Valor |
| --- | --- |
| Git branch usada no deploy | `demo/vercel` |
| Root Directory | `demo` |
| Framework Preset | **Vite** |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Node.js Version | **24.x** recomendado; o código aceita Node 22.13 ou superior |
| Include source files outside of the Root Directory in the Build Step | **Habilitado** |
| Environment Variables | Nenhuma necessária |

`demo/vercel.json` já define o framework, os comandos de instalação/build e a pasta de saída. Confira a raiz e os demais campos no painel; as configurações de build ficam em **Settings → Build and Deployment**. [Documentação oficial de build](https://vercel.com/docs/builds/configure-a-build).

O acesso aos arquivos fora da raiz é necessário porque `demo/src/main.tsx` usa a interface em `app/`, componentes em `components/`, regras em `lib/`, estilos de `vendor/` e imagens/fontes em `public/`. Essas pastas são compartilhadas por código, mas o resultado servido é apenas o build estático `demo/dist`. A Vercel documenta essa opção no [FAQ de monorepos](https://vercel.com/docs/monorepos/monorepo-faq#can-i-share-source-files-between-projects-are-shared-packages-supported).

Vercel disponibiliza Node **24.x e 22.x**. O intervalo aberto `>=22.13.0` de `demo/package.json` pode fazer a plataforma escolher 24.x mesmo quando outro valor é selecionado no painel; 24.x atende ao requisito do projeto. [Versões de Node e precedência de `engines`](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## Usar `demo/vercel` como branch de produção

No projeto da demonstração, abra **Settings → Environments → Production → Branch Tracking**, informe **`demo/vercel`** e salve. Assim, os próximos pushes nessa branch geram deploys de produção desse projeto, sem precisar mesclar as alterações na `main`. [Guia oficial para uma branch de produção diferente da padrão](https://vercel.com/kb/guide/can-i-use-a-non-default-branch-for-production).

Se a importação inicial usar `main`, o build pode falhar porque a pasta `demo/` está apenas em `demo/vercel`. Com o projeto criado, corrija a branch de produção e inicie um deployment selecionando **`demo/vercel`**. Confira a branch exibida nos detalhes do deployment antes de compartilhar o endereço.

A Vercel trata o primeiro deployment de um projeto novo como produção, mesmo quando ele usa outra branch. Depois, passa a seguir a configuração de branch de produção. [Documentação de ambientes](https://vercel.com/docs/deployments/environments#first-deployment).

## Executar e conferir localmente

Mantenha o repositório completo e entre na branch `demo/vercel`. Com **Node.js 22.13 ou superior** e npm, abra o terminal na raiz e execute:

```powershell
cd demo
npm.cmd ci
npm.cmd run dev
```

Abra o endereço mostrado no terminal. Para gerar e visualizar o mesmo build estático usado no deploy:

```powershell
npm.cmd run build
npm.cmd run preview
```

Em Linux e macOS, use `npm` em vez de `npm.cmd`. O build executa a verificação de tipos e o Vite; não execute `db:setup` ou os comandos de Cloudflare para essa demonstração. Basta instalar as dependências em `demo/`; não é necessário instalar o pacote da raiz para compilar a demo.

## Confira depois do deploy

1. O título da aba é **Zelo · Demonstração**, com a logo e o aviso de valores fictícios.
2. As quatro telas abrem; **Usar meus dados** não aparece.
3. Um lançamento de teste altera os totais. Recarregar restaura os exemplos.
4. **Reiniciar demonstração** também restaura metas, filtros, mês e tela inicial.
5. Os downloads XLSX/CSV funcionam e identificam a demonstração no nome do arquivo.
6. No celular, o cabeçalho mostra o menu hambúrguer e os formulários cabem na tela.

## Resolver erros comuns

| Sintoma | O que conferir |
| --- | --- |
| A pasta `demo` não foi encontrada | A branch do deployment deve ser `demo/vercel`, e Root Directory deve ser `demo`. |
| Erro ao importar `app/`, `lib/`, `components/` ou `vendor/` | Habilite a opção de incluir as fontes compartilhadas fora da Root Directory. |
| Build tenta executar Vinext, Wrangler ou preparar D1 | O comando está sendo executado pela raiz. Configure Root Directory como `demo` e Build Command como `npm run build`. |
| Node não atende aos requisitos | Use Node 24.x no painel e um Node local 22.13 ou superior. |
| Alterações de teste sumiram | É o comportamento esperado: a demonstração não persiste dados. |

## Validação desta entrega

Em **08/10/2026**, foram conferidos a instalação limpa, o TypeScript, o build estático e as regras de cálculos/exportações. A compilação também passou em uma cópia sem `node_modules` na raiz do repositório.

Na prévia local do build de produção, foram verificados:

- Cadastro, edição, mudança de situação e exclusão de um gasto de R$ 125,50.
- Compra de R$ 300,00 em três parcelas de R$ 100,00, com os vencimentos futuros.
- Alteração de meta e atualização do indicador de progresso.
- XLSX com duas abas e 16 registros no extrato de teste; CSV com 14 colunas e CSV para BI com 19 colunas.
- Reinício e recarga restaurando os exemplos, com resultado inicial de R$ 3.118,30 e meta de R$ 1.500,00.
- Navegação pelo menu móvel, layout sem transbordamento horizontal e console sem avisos ou erros.
- Nenhuma requisição à API financeira ou resposta 404 durante a demonstração.

Essas verificações cobrem o build local. Depois da publicação, confira o endereço da Vercel usando o roteiro acima.

## Escopo desta versão

Esta entrega serve para experimentar e apresentar o produto. Para uso pessoal persistente ou acesso de usuários reais, será necessário implementar a autenticação e escolher/configurar o backend e o banco da versão pública. Nenhum segredo, credencial de banco ou variável de ambiente é necessário na demonstração.
