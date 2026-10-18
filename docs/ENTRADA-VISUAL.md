# Demonstração pública do Zelo

A `newdesign` apresenta o frontend em modo **somente leitura**, com dados fictícios. A página inicial mantém a paleta original, o simulador de aportes e a apresentação dos recursos.

## Acesso e manutenção

- `/login` e `/cadastro` abrem a página inicial com um painel lateral indicando **Em manutenção**.
- Não são exibidos campos de nome, telefone, e-mail ou senha. Nenhuma conta é criada ou autenticada.
- O botão principal da página inicial leva à demonstração. O acesso pessoal no painel também informa a manutenção.
- O painel fecha por X, Esc ou clique fora; no celular, ocupa a tela inteira. As animações respeitam movimento reduzido.

## O que pode ser explorado

`/demo` e `/app` exibem exemplos de finanças pessoais, lançamentos, cartões, cofrinhos, demonstrativo e perfil. Filtros, troca do mês, consulta de detalhes e exportação de exemplos estão disponíveis. `/demo?view=savings`, por exemplo, abre diretamente os cofrinhos tanto na demo estática quanto no aplicativo completo.

Não é permitido criar, editar, excluir ou mudar a situação de lançamentos; alterar limites; criar/editar/arquivar cofrinhos; registrar/remover aportes ou retiradas; ou editar dados/foto do perfil. A rota direta de edição de perfil também abre somente a consulta. Ctrl/Cmd+K não abre o formulário de lançamento.

Os bloqueios ficam na interface e nos controladores de alterações. `lib/app-access.ts` mantém `PERSONAL_ACCOUNTS_ENABLED = false`; as APIs pessoais respondem 503 antes de acessar autenticação ou banco.

## Próxima etapa

Implementar e integrar cadastro, login e sessões à identidade do usuário e à persistência. Só depois liberar a criação e a edição de registros próprios para contas autenticadas.
