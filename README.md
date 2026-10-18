# Zelo — finanças pessoais

Organize receitas e despesas, entenda seu mês e dê espaço aos seus planos.

## Estado desta branch

**`newdesign` — demonstração somente leitura, com dados fictícios. Login e cadastro em manutenção.**

Esta atualização entrega o novo design. **Login, criação de contas, sessões e integração do fluxo com o banco de dados ainda serão implementados/integrados.** Os acessos de login e cadastro exibem avisos de manutenção, sem campos ou coleta de dados. O controle pessoal permanece desabilitado.

A base financeira e o histórico do MVP estão na [`main`](https://github.com/ocaiofirmino/zelo-financas/tree/main). Esta branch já contém esquema, migrações e código de API para SQLite/Cloudflare D1; isso não equivale a um cadastro integrado e pronto para uso.

## O que esta atualização entrega

- Página inicial com a paleta original, tipografia Manrope, layout responsivo e animações com suporte a movimento reduzido.
- Apresentação de Meu mês, Cofrinhos, Cartões e Extrato com capturas reais do produto e valores fictícios.
- Simulador de aportes mensais com gráfico SVG e projeção em 12 meses, sem rendimentos.
- Refinamento visual do painel financeiro, tabelas e navegação.
- Avisos de login e cadastro em manutenção em um painel lateral animado; no celular, ocupam a tela inteira.
- Navegação pública somente leitura: não é possível criar, editar, excluir ou marcar lançamentos; alterar limites; registrar aportes/retiradas; ou editar o perfil. Essas funções ficam reservadas às futuras contas autenticadas.
- Filtros, consulta de meses, detalhes dos cofrinhos e exportação dos exemplos continuam disponíveis.
- Os acessos diretos `/login` e `/cadastro` exibem a página inicial com o painel correspondente. A interface antiga não é mais renderizada.
- FAQ sobre funcionalidades e limitações da demonstração.

## O que já existe além do design

O projeto inclui regras financeiras em centavos, parcelas, categorias, metas/limites e exportação de extratos em Excel/CSV/CSV para Power BI. Há também interfaces e regras de cofrinhos e perfil. Na demonstração, os exemplos podem ser consultados, mas não alterados. Não há movimentação de dinheiro nem persistência em uma conta pessoal.

A flag `PERSONAL_ACCOUNTS_ENABLED` está em `false`. As APIs pessoais de finanças, cofrinhos e perfil permanecem bloqueadas antes de acessar autenticação e banco.

## Próximas etapas

1. Implementar cadastro real, autenticação, sessões, saída, confirmação de e-mail e recuperação de senha.
2. Integrar a identidade de cada conta às APIs e ao banco; revisar/aplicar as migrações e validar leitura/gravação.
3. Conectar perfil, lançamentos e cofrinhos ao usuário autenticado e testar o isolamento entre contas.
4. Validar o fluxo completo em ambiente de teste antes de liberar o controle pessoal.
5. Preparar configuração de produção, tratamento de falhas e backup/restauração dos dados.

## Executar a demonstração local

Requer Node.js 22.13 ou superior e npm. A demo Vite funciona sem configurar banco ou autenticação.

```bash
cd demo
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Abra o endereço informado no terminal. `/` mostra a página inicial, `/demo` abre o painel e `/login` ou `/cadastro` abrem os painéis de acesso. Para conferir o perfil, use `/demo?view=profile`.

```bash
cd demo
npm run build
```

O comando verifica TypeScript e compila a demonstração. A execução do aplicativo completo na raiz depende do ambiente Workers/D1; não é necessária para avaliar este design.

## Verificações

Nesta atualização passaram a compilação da demo com TypeScript, ESLint dos componentes alterados e as verificações de finanças, exportação, cofrinhos, perfil e bloqueio de acesso pessoal. Os avisos de manutenção, o fechamento do painel e os bloqueios de criação/edição na demonstração são conferidos no Chromium. Isso não valida autenticação ou persistência reais, que não foram integradas.

Os testes de regras podem ser executados na raiz, com as dependências instaladas:

```bash
npm run test:finance
npm run test:export
npm run test:savings
npm run test:profile
npm run test:access
```

## Arquivos principais

| Arquivo | Função |
| --- | --- |
| `app/landing.tsx` e `app/landing.css` | Página inicial, prévias, simulação e navegação. |
| `app/login-drawer.tsx` e `app/login-drawer.css` | Avisos de login/cadastro em manutenção, sem formulários. |
| `app/welcome.tsx` | Entrada compartilhada; endereços de acesso usam os novos painéis. |
| `app/finance-full.tsx` | Interface e navegação do painel financeiro. |
| `app/local-polish.css` | Refinamento visual do painel. |
| `lib/app-access.ts` | Bloqueio do acesso pessoal durante a etapa visual. |
| `db/`, `drizzle/` e `app/api/` | Base de persistência a integrar com o novo fluxo. |
| `demo/` | Demonstração local independente de backend. |

As capturas do produto usam dados fictícios. O código publicado não inclui bancos locais, registros pessoais, dependências, backups ou artefatos de revisão visual.
